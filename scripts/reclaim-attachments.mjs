/**
 * 附件回补：用修复后的容器回退逻辑重扫「可疑集」，补回主采集阶段漏抓的附件。
 *
 * 可疑集 = manifest 中 containerHit=true 但 links=0 的公告页（占可达页 47.2%）。
 * 根因：旧 sliceContainer 命中极小错误容器（如导航条），把正文附件排除。
 * 修复后 extractBodyAttachments 在容器内 0 附件时回退全页，可找回这批附件。
 *
 * 安全：
 *  - 同域名限速；单文件 ≤15MB；总体积预算可控
 *  - 下载前校验文件头为真实文档，拒绝 HTML 错误页
 *  - 与现有附件按 URL 去重，绝不覆盖同名文件（冲突追加序号）
 *  - 断点续传；DRY-RUN 只测命中不下载
 *
 * 用法：node scripts/reclaim-attachments.mjs [--limit=N] [--budget-mb=200] [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage, extractBodyAttachments, looksLikeDocument, sanitize, filenameFromUrl } from './lib/fetcher.mjs'
import { normalizeFilename } from './lib/naming.mjs'
import { loadDone, createAppender, loadJSON, saveJSON } from './lib/state.mjs'

const args = process.argv.slice(2)
const getArg = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d }
const LIMIT = parseInt(getArg('limit', '0'), 10)
const BUDGET_MB = parseFloat(getArg('budget-mb', '220'))
const MAX_FILE_MB = parseFloat(getArg('max-file-mb', '15'))
const CONCURRENCY = parseInt(getArg('concurrency', '5'), 10)
const HOST_DELAY = parseInt(getArg('host-delay', '550'), 10)
const DRY_RUN = args.includes('--dry-run')
/** 只回补指定省份（逗号分隔的省 adcode，如 --provinces=130000），空=全部 */
const PROV_FILTER = getArg('provinces', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const DATA_DIR = path.resolve('public/data')
const ATT_DIR = path.resolve('public/attachments')

// 载入可疑集
const suspPath = path.resolve('scripts/.state/suspicious.json')
if (!fs.existsSync(suspPath)) { console.error('未找到 suspicious.json，请先运行 quantify-container-bug.mjs'); process.exit(1) }
let suspicious = JSON.parse(fs.readFileSync(suspPath, 'utf8'))
// 省份过滤：provFile 形如 "130000.json"，与 --provinces 的省 adcode 比较
if (PROV_FILTER.length) {
  suspicious = suspicious.filter((s) => PROV_FILTER.includes(String(s.provFile).replace('.json', '')))
}
if (LIMIT > 0) suspicious = suspicious.slice(0, LIMIT)

// 建立 url -> {provFile, cityAdcode, title, category, year} 映射，供回写定位
const urlIndex = new Map()
const provData = new Map() // provFile -> parsed json（懒加载）
function loadProv(provFile) {
  if (!provData.has(provFile)) {
    provData.set(provFile, JSON.parse(fs.readFileSync(path.join(DATA_DIR, provFile), 'utf8')))
  }
  return provData.get(provFile)
}
for (const s of suspicious) {
  const d = loadProv(s.provFile)
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      if (r.url === s.url) {
        urlIndex.set(s.url, { provFile: s.provFile, cityAdcode: Number(c.adcode), rec: r, provName: d.name })
        break
      }
    }
  }
}

// 现有 local URL 集合（全局去重，含已下载附件）
const existingLocalUrls = new Set()
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) for (const r of c.recruitments || []) for (const a of r.attachments || []) if (a.url && a.local) existingLocalUrls.add(a.url)
}

// 限速
const hostLast = new Map()
async function throttle(url) {
  let h = 'x'; try { h = new URL(url).hostname } catch {}
  const now = Date.now(); const wait = Math.max(0, (hostLast.get(h) || 0) + HOST_DELAY - now)
  hostLast.set(h, now + wait + 10); if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

let usedBytes = loadJSON('reclaim-budget.json', { bytes: 0 }).bytes
const budgetLock = { stopped: false }
const donePages = loadDone('reclaim-pages-done.txt')
const pageAppender = DRY_RUN ? { push() {}, flush() {} } : createAppender('reclaim-pages-done.txt')

const stat = { scanned: 0, pageOk: 0, pageFail: 0, hitWithAtt: 0, newAtt: 0, attFail: 0, errors: {} }
// 回写缓冲：provFile -> [{rec, newAtts:[{name,url,local}]}]
const writeback = new Map()

function recordWrite(idx, att) {
  if (!writeback.has(idx.provFile)) writeback.set(idx.provFile, [])
  let e = writeback.get(idx.provFile).find((x) => x.rec === idx.rec)
  if (!e) { e = { rec: idx.rec, cityAdcode: idx.cityAdcode, newAtts: [] }; writeback.get(idx.provFile).push(e) }
  e.newAtts.push(att)
}

async function processOne(s) {
  if (budgetLock.stopped) return
  if (donePages.has(s.url)) { return }
  const idx = urlIndex.get(s.url)
  if (!idx) return

  await throttle(s.url)
  const res = await fetchPage(s.url, { timeout: 25000 })
  stat.scanned++
  if (!res.ok) { stat.pageFail++; stat.errors[res.error] = (stat.errors[res.error] || 0) + 1; if (!DRY_RUN) pageAppender.push(s.url); return }
  stat.pageOk++

  const { links } = extractBodyAttachments(res.text, res.finalUrl)
  // 过滤掉已下载的
  const fresh = links.filter((l) => !existingLocalUrls.has(l.url))
  if (fresh.length === 0) { if (!DRY_RUN) pageAppender.push(s.url); return }

  stat.hitWithAtt++
  const rec = idx.rec
  const year = typeof rec.year === 'number' ? rec.year : null

  for (const l of fresh) {
    if (budgetLock.stopped) break
    await throttle(l.url)
    const dl = await fetchPage(l.url, { timeout: 30000 })
    if (!dl.ok || !dl.buf) { stat.attFail++; stat.errors['dl:' + (dl.error || 'x')] = (stat.errors['dl:' + (dl.error || 'x')] || 0) + 1; continue }
    if (dl.buf.length > MAX_FILE_MB * 1024 * 1024) { stat.attFail++; stat.errors['too-large'] = (stat.errors['too-large'] || 0) + 1; continue }
    if (!looksLikeDocument(dl.buf, l.url)) { stat.attFail++; stat.errors['not-a-document'] = (stat.errors['not-a-document'] || 0) + 1; continue }
    if ((usedBytes + dl.buf.length) / 1024 / 1024 > BUDGET_MB) { budgetLock.stopped = true; break }

    const rawName = sanitize(l.text) || sanitize(filenameFromUrl(l.url)) || 'attachment'
    let name = normalizeFilename(rawName, { fallbackYear: year })
    const dir = path.join(ATT_DIR, String(idx.cityAdcode))
    if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true })
    let target = path.join(dir, name)
    if (!DRY_RUN && fs.existsSync(target)) {
      const cur = fs.readFileSync(target)
      if (cur.length === dl.buf.length && cur.equals(dl.buf)) {
        const local = `attachments/${idx.cityAdcode}/${name}`
        recordWrite(idx, { name, url: l.url, local })
        usedBytes += dl.buf.length; stat.newAtt++
        continue
      }
      const stem = name.replace(/\.[^.]+$/, ''); const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
      let i = 2; while (fs.existsSync(target) && i < 30) { target = path.join(dir, `${stem}_${i}${ext}`); i++ }
      if (fs.existsSync(target)) { stat.attFail++; continue }
      name = path.basename(target)
    }
    if (!DRY_RUN) fs.writeFileSync(target, dl.buf)
    usedBytes += dl.buf.length
    const local = `attachments/${idx.cityAdcode}/${DRY_RUN ? name : path.basename(target)}`
    recordWrite(idx, { name: DRY_RUN ? name : path.basename(target), url: l.url, local })
    stat.newAtt++
    existingLocalUrls.add(l.url)
  }
  if (!DRY_RUN) pageAppender.push(s.url)
}

console.log(`=== 附件回补（${DRY_RUN ? 'DRY-RUN' : 'APPLY'}）===`)
console.log(`  可疑集 ${suspicious.length} 个 · 并发 ${CONCURRENCY} · 预算 ${BUDGET_MB}MB（已用 ${(usedBytes / 1024 / 1024).toFixed(1)}MB）`)

// 并发池
let cursor = 0, processed = 0
const t0 = Date.now()
async function worker() {
  while (cursor < suspicious.length) {
    if (budgetLock.stopped) return
    const i = cursor++
    try { await processOne(suspicious[i]) } catch (e) { stat.errors['ex:' + e.message.slice(0, 30)] = (stat.errors['ex:' + e.message.slice(0, 30)] || 0) + 1 }
    processed++
    if (processed % 30 === 0) {
      console.log(`  ${processed}/${suspicious.length} 页OK ${stat.pageOk} 命中有附件 ${stat.hitWithAtt} 新附件 ${stat.newAtt} 失败 ${stat.attFail} | ${(usedBytes / 1024 / 1024).toFixed(1)}MB | ${((Date.now() - t0) / 1000) | 0}s`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
pageAppender.flush?.()

// 回写 JSON
let wbRecs = 0, wbAtts = 0
if (!DRY_RUN) {
  for (const [provFile, entries] of writeback) {
    const d = loadProv(provFile)
    for (const e of entries) {
      e.rec.attachments = e.rec.attachments || []
      const known = new Set(e.rec.attachments.map((a) => a.url).filter(Boolean))
      for (const att of e.newAtts) {
        if (known.has(att.url)) continue
        e.rec.attachments.push({ name: att.name, url: att.url, local: att.local })
        known.add(att.url); wbAtts++
      }
      wbRecs++
    }
    d.updatedAt = new Date().toISOString().slice(0, 10)
    fs.writeFileSync(path.join(DATA_DIR, provFile), JSON.stringify(d, null, 2), 'utf8')
  }
  saveJSON('reclaim-budget.json', { bytes: usedBytes })
}

console.log(`\n=== 回补完成 ===`)
console.log(`  扫描 ${stat.scanned} · 页OK ${stat.pageOk} · 页失败 ${stat.pageFail}`)
console.log(`  命中「容器截错、实有附件」的公告 ${stat.hitWithAtt} 个`)
console.log(`  新附件 ${stat.newAtt} 个${DRY_RUN ? '（DRY-RUN 未落盘）' : ''} · 附件失败 ${stat.attFail}`)
if (!DRY_RUN) console.log(`  回写公告 ${wbRecs} 条 · 新增附件记录 ${wbAtts}`)
console.log(`  累计体积 ${(usedBytes / 1024 / 1024).toFixed(1)}MB / 预算 ${BUDGET_MB}MB${budgetLock.stopped ? ' ⚠️已达上限' : ''}`)
console.log('  失败分布:')
for (const [k, v] of Object.entries(stat.errors).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${String(v).padStart(4)}  ${k}`)
