/**
 * 全量附件采集管线
 *
 * 流程：读取 31 省数据 → 遍历带官方链接的公告 → 抓取公告页 → 提取附件链接
 *       → 下载并校验为真实文档 → 落地 public/attachments/{市adcode}/ → 回写 JSON
 *
 * 约束：
 *  - 同域名并发 1、请求间隔 ≥ 600ms（政务站承受能力有限，避免触发封禁）
 *  - 单文件上限 20MB，总预算可配置（控制仓库体积）
 *  - 断点续传：已处理公告与已下载附件均记录在 scripts/.state/
 *  - 只下载官方原文中已出现的附件链接，绝不构造或猜测 URL
 *
 * 用法：node scripts/collect-attachments.mjs [--limit=N] [--provinces=110000,440000] [--budget-mb=400]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage, extractAttachmentLinks, filenameFromUrl, sanitize, looksLikeDocument } from './lib/fetcher.mjs'
import { loadDone, createAppender, loadJSON, saveJSON } from './lib/state.mjs'

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const getArg = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const HAS_FLAG = (name) => args.includes(`--${name}`)

const LIMIT = parseInt(getArg('limit', '0'), 10) // 0 = 不限
const PROV_FILTER = getArg('provinces', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const BUDGET_MB = parseFloat(getArg('budget-mb', '600'))
const MAX_FILE_MB = parseFloat(getArg('max-file-mb', '20'))
const HOST_DELAY_MS = parseInt(getArg('host-delay', '600'), 10)
const CONCURRENCY = parseInt(getArg('concurrency', '6'), 10)
const DRY_RUN = HAS_FLAG('dry-run')
/** 只发现附件链接并统计（用 HEAD 探测体积），不下载、不改数据 */
const DISCOVER_ONLY = HAS_FLAG('discover-only')
/** 每条公告最多落地多少个附件（0=不限），用于在体积预算内最大化覆盖面 */
const PER_TASK_CAP = parseInt(getArg('per-task-cap', '0'), 10)

const DATA_DIR = path.resolve('public/data')
const ATT_DIR = path.resolve('public/attachments')

// ---------------------------------------------------------------------------
// 类别优先级：缺口大的省份 + 核心四类优先，录用公示权重最低
// ---------------------------------------------------------------------------
const CAT_PRIORITY = {
  公务员: 0,
  选调生: 1,
  事业单位: 2,
  人才引进: 3,
  录用公示: 4,
}

// ---------------------------------------------------------------------------
// 加载任务队列
// ---------------------------------------------------------------------------
function buildTasks() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => /^\d+\.json$/.test(f))
    .filter((f) => (PROV_FILTER.length === 0 ? true : PROV_FILTER.includes(f.replace('.json', ''))))

  const tasks = []
  for (const f of files) {
    const provFile = f.replace('.json', '')
    const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
    const adcode = d.adcode || Number(provFile)
    for (const c of d.cities || []) {
      for (const r of c.recruitments || []) {
        if (!r.url) continue
        const hasLocal = (r.attachments || []).some((a) => a.local)
        tasks.push({
          provFile,
          provName: d.name,
          provAdcode: adcode,
          cityAdcode: c.adcode,
          cityName: c.name,
          title: r.title,
          category: r.category,
          year: r.year,
          url: r.url,
          existingCount: (r.attachments || []).length,
          hasLocal,
        })
      }
    }
  }

  // 排序：缺口大的省（无本地附件的公告）优先，再按类别优先级，最后按年份倒序
  tasks.sort((a, b) => {
    if (a.hasLocal !== b.hasLocal) return a.hasLocal ? 1 : -1
    const pa = CAT_PRIORITY[a.category] ?? 5
    const pb = CAT_PRIORITY[b.category] ?? 5
    if (pa !== pb) return pa - pb
    return (b.year || 0) - (a.year || 0)
  })

  return LIMIT > 0 ? tasks.slice(0, LIMIT) : tasks
}

// ---------------------------------------------------------------------------
// 同域名限速（每个 host 串行 + 间隔）
// ---------------------------------------------------------------------------
const hostLast = new Map()
async function throttleHost(url) {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    host = 'unknown'
  }
  const now = Date.now()
  const last = hostLast.get(host) || 0
  const wait = Math.max(0, last + HOST_DELAY_MS - now)
  hostLast.set(host, now + wait + 10)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

// ---------------------------------------------------------------------------
// 下载单个附件
// ---------------------------------------------------------------------------
function budgetState() {
  const s = loadJSON('budget.json', { bytes: 0 })
  return s
}

/** 用 HEAD（失败则 GET Range）探测附件体积，不下载完整文件 */
async function probeSize(url) {
  await throttleHost(url)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: headersFor(url),
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    const cl = res.headers.get('content-length')
    if (res.ok && cl) return { bytes: parseInt(cl, 10), ok: true }
  } catch {
    /* 回退到 Range GET */
  }
  try {
    const res = await fetch(url, {
      headers: { ...headersFor(url), Range: 'bytes=0-0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    const cr = res.headers.get('content-range')
    if (cr) {
      const m = /\/(\d+)\s*$/.exec(cr)
      if (m) return { bytes: parseInt(m[1], 10), ok: true }
    }
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      return { bytes: buf.length, ok: true, full: true }
    }
  } catch {
    /* 探测失败按未知处理 */
  }
  return { bytes: 0, ok: false }
}

async function downloadAttachment(attUrl, cityAdcode, wantedName) {
  await throttleHost(attUrl)
  const res = await fetchPage(attUrl, { timeout: 30000 })
  if (!res.ok || !res.buf) return { ok: false, reason: res.error || 'fetch-failed' }

  const sizeMB = res.buf.length / 1024 / 1024
  if (sizeMB > MAX_FILE_MB) return { ok: false, reason: `too-large:${sizeMB.toFixed(1)}MB` }
  if (res.buf.length < 300) return { ok: false, reason: 'too-small' }
  if (!looksLikeDocument(res.buf, attUrl)) return { ok: false, reason: 'not-a-document' }

  const budget = budgetState()
  if ((budget.bytes + res.buf.length) / 1024 / 1024 > BUDGET_MB) return { ok: false, reason: 'budget-exceeded' }

  // 文件名：优先用公告页锚文本（含年份/名称），否则用 URL 推断
  const dir = path.join(ATT_DIR, String(cityAdcode))
  fs.mkdirSync(dir, { recursive: true })

  let base = sanitize(wantedName) || sanitize(filenameFromUrl(attUrl)) || 'attachment'
  // 去掉锚文本里可能带的序号前缀噪声
  base = base.replace(/^\s*[（(]?\d+[）).、:：]\s*/, '').trim() || base
  const extMatch = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)$/i.exec(base)
  const urlExtMatch = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)(\?|$)/i.exec(attUrl)
  if (!extMatch && urlExtMatch) base = `${base}.${urlExtMatch[1].toLowerCase()}`

  let target = path.join(dir, base)
  // 同名不同内容 → 追加序号，绝不覆盖已有文件
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target)
    if (existing.length === res.buf.length && existing.equals(res.buf)) {
      // 内容完全一致，视为已存在，直接复用
      return { ok: true, reused: true, local: toLocalRel(target), bytes: res.buf.length }
    }
    const stem = base.replace(/\.[^.]+$/, '')
    const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : ''
    let i = 2
    while (fs.existsSync(target) && i < 20) {
      target = path.join(dir, `${stem}_${i}${ext}`)
      i++
    }
    if (fs.existsSync(target)) return { ok: false, reason: 'name-collision' }
  }

  if (DRY_RUN) return { ok: true, dry: true, local: toLocalRel(target), bytes: res.buf.length }

  fs.writeFileSync(target, res.buf)
  budget.bytes += res.buf.length
  saveJSON('budget.json', budget)
  return { ok: true, local: toLocalRel(target), bytes: res.buf.length }
}

function toLocalRel(abs) {
  return path.relative(path.resolve('public'), abs).replace(/\\/g, '/')
}

// ---------------------------------------------------------------------------
// 处理单条公告
// ---------------------------------------------------------------------------
async function processTask(task, donePages, doneFiles, pageAppender, stat) {
  const pageKey = task.url
  if (donePages.has(pageKey)) {
    stat.skipped++
    return null
  }

  await throttleHost(pageKey)
  const page = await fetchPage(pageKey, { timeout: 25000 })
  if (!page.ok) {
    stat.pageFail++
    stat.errors[page.error] = (stat.errors[page.error] || 0) + 1
    pageAppender.push(`FAIL\t${pageKey}`)
    return null
  }

  stat.pageOk++
  const links = extractAttachmentLinks(page.text, page.finalUrl)

  const results = []
  for (const link of links) {
    const fileKey = `${task.cityAdcode}|${link.url}`
    if (doneFiles.has(fileKey)) continue
    doneFiles.add(fileKey)

    const dl = await downloadAttachment(link.url, task.cityAdcode, link.text)
    if (!dl.ok) {
      if (dl.reason === 'budget-exceeded') {
        stat.budgetHit = true
        return { links, results, budgetHit: true }
      }
      stat.attFail++
      stat.errors[dl.reason] = (stat.errors[dl.reason] || 0) + 1
      continue
    }
    stat.attOk++
    results.push({ url: link.url, local: dl.local, name: path.basename(dl.local), text: link.text })
    doneAppender.push(fileKey)
  }

  pageAppender.push(`OK\t${pageKey}`)
  return { links, results }
}

// 供 processTask 内部使用（同作用域闭包变量的显式别名）
let doneAppender

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
const donePages = loadDone('pages-done.txt')
const doneFiles = loadDone('files-done.txt')
// DRY-RUN 只做验证，不得污染断点续传状态（否则正式跑会误判为已处理）
const noopAppender = { push() {}, flush() {} }
const pageAppender = DRY_RUN ? noopAppender : createAppender('pages-done.txt')
doneAppender = DRY_RUN ? noopAppender : createAppender('files-done.txt')

const stat = {
  tasks: 0,
  skipped: 0,
  pageOk: 0,
  pageFail: 0,
  attOk: 0,
  attFail: 0,
  budgetHit: false,
  errors: {},
}

const tasks = buildTasks()
stat.tasks = tasks.length

console.log(`采集任务：${tasks.length} 条公告（已处理 ${donePages.size} 条将被跳过）`)
console.log(`配置：并发 ${CONCURRENCY} · 同域名间隔 ${HOST_DELAY_MS}ms · 预算 ${BUDGET_MB}MB · 单文件 ≤${MAX_FILE_MB}MB${DRY_RUN ? ' · DRY-RUN' : ''}`)
console.log('')

// 并发池（按任务序号分片，同域名由 throttleHost 天然串行化）
let cursor = 0
let processed = 0
const t0 = Date.now()

async function worker() {
  while (cursor < tasks.length) {
    if (stat.budgetHit) return
    const i = cursor++
    const task = tasks[i]
    try {
      const out = await processTask(task, donePages, doneFiles, pageAppender, stat)
      if (out?.budgetHit) stat.budgetHit = true
      processed++
      if (processed % 25 === 0) {
        const el = ((Date.now() - t0) / 1000).toFixed(0)
        console.log(
          `  进度 ${processed}/${tasks.length}  页面OK ${stat.pageOk} 失败 ${stat.pageFail} | 附件OK ${stat.attOk} 失败 ${stat.attFail} | ${el}s`,
        )
      }
      if (out) yieldTaskResult(task, out)
    } catch (e) {
      stat.errors[`exception:${e.message}`.slice(0, 60)] = (stat.errors[`exception:${e.message}`.slice(0, 60)] || 0) + 1
    }
  }
}

// 结果收集器：把新下载的附件写回对应省 JSON（最后统一 flush）
const resultsByProv = new Map()
function yieldTaskResult(task, out) {
  if (!out.results || out.results.length === 0) return
  if (!resultsByProv.has(task.provFile)) resultsByProv.set(task.provFile, [])
  resultsByProv.get(task.provFile).push({ task, results: out.results })
}

const workers = Array.from({ length: CONCURRENCY }, () => worker())
await Promise.all(workers)

pageAppender.flush()
doneAppender.flush()

// ---------------------------------------------------------------------------
// 回写 JSON：把新附件合并进对应公告，绝不丢失既有数据
// ---------------------------------------------------------------------------
let updatedEntries = 0
let newAttRecords = 0
if (!DRY_RUN) {
  for (const [provFile, items] of resultsByProv) {
    const fp = path.join(DATA_DIR, provFile)
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'))
    for (const { task, results } of items) {
      const city = (d.cities || []).find((c) => c.adcode === task.cityAdcode)
      if (!city) continue
      const rec = (city.recruitments || []).find((r) => r.url === task.url && r.title === task.title)
      if (!rec) continue
      rec.attachments = rec.attachments || []
      const known = new Set(rec.attachments.map((a) => a.url))
      for (const r of results) {
        if (known.has(r.url)) {
          // 已有记录：仅补 local 字段
          const ex = rec.attachments.find((a) => a.url === r.url)
          if (ex && !ex.local) {
            ex.local = r.local
            updatedEntries++
          }
          continue
        }
        rec.attachments.push({ name: r.text ? sanitize(r.text) || r.name : r.name, url: r.url, local: r.local })
        known.add(r.url)
        newAttRecords++
      }
      updatedEntries++
    }
    d.updatedAt = new Date().toISOString().slice(0, 10)
    fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8')
  }
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
const budget = budgetState()
console.log('\n=== 采集完成 ===')
console.log(`  公告页  成功 ${stat.pageOk} · 失败 ${stat.pageFail} · 跳过(已处理) ${stat.skipped}`)
console.log(`  附件    新增 ${stat.attOk} · 失败 ${stat.attFail}`)
console.log(`  JSON    更新条目 ${updatedEntries} · 新增附件记录 ${newAttRecords}`)
console.log(`  累计已用体积 ${(budget.bytes / 1024 / 1024).toFixed(1)} MB / 预算 ${BUDGET_MB} MB${stat.budgetHit ? '  ⚠️ 已达预算上限，剩余任务未执行' : ''}`)
console.log(`  耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
console.log('\n  失败原因 TOP:')
for (const [k, v] of Object.entries(stat.errors).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`    ${String(v).padStart(4)}  ${k}`)
}

saveJSON('last-run.json', { at: new Date().toISOString(), stat, budgetBytes: budget.bytes })
