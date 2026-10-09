/**
 * 阶段二：按配额择优下载附件
 *
 * 策略（应对 GitHub Pages 1GB 上限与省份分布不均）：
 *  1. 类别保底 —— 公务员/选调/事业单位/人才引进 四类各自优先入选，
 *     避免"事业单位"数量占优把其他三类挤出去
 *  2. 省份配额 —— 每省设上限，防止贵州(145)/广东(102)挤占西藏(4)/陕西(2)的名额
 *  3. 文档价值 —— 职位表/岗位表/简章/考试大纲 优先于 名单/公示
 *  4. 体积预算 —— 实时累计，超预算即停；单文件超上限跳过
 *
 * 下载前校验文件头，确保是真实文档而非 HTML 错误页。
 * 断点续传：已下载记录在 files-downloaded.txt。
 *
 * 用法：node scripts/download.mjs [--budget-mb=450] [--per-province=40] [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage, headersFor, sanitize, filenameFromUrl, looksLikeDocument } from './lib/fetcher.mjs'
import { normalizeFilename } from './lib/naming.mjs'
import { loadDone, createAppender, loadJSON, saveJSON } from './lib/state.mjs'

const args = process.argv.slice(2)
const getArg = (n, d) => {
  const h = args.find((a) => a.startsWith(`--${n}=`))
  return h ? h.slice(n.length + 3) : d
}
const HAS = (n) => args.includes(`--${n}`)

const BUDGET_MB = parseFloat(getArg('budget-mb', '450'))
const PER_PROVINCE = parseInt(getArg('per-province', '42'), 10)
/** 每省每类别上限，保证四类都有代表 */
const PER_PROV_CAT = parseInt(getArg('per-prov-cat', '14'), 10)
const MAX_FILE_MB = parseFloat(getArg('max-file-mb', '15'))
const CONCURRENCY = parseInt(getArg('concurrency', '5'), 10)
const HOST_DELAY_MS = parseInt(getArg('host-delay', '550'), 10)
const DRY_RUN = HAS('dry-run')

const ATT_DIR = path.resolve('public/attachments')
const DATA_DIR = path.resolve('public/data')
const queueFile = path.resolve('scripts/.state/download-queue.json')

if (!fs.existsSync(queueFile)) {
  console.error('未找到下载队列，请先运行 node scripts/analyze-manifest.mjs')
  process.exit(1)
}
const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'))

// ---------------------------------------------------------------------------
// 配额筛选
// ---------------------------------------------------------------------------
const CAT_ORDER = ['公务员', '选调生', '事业单位', '人才引进', '录用公示']
const provCount = new Map()
const provCatCount = new Map()
const selected = []

for (const c of queue) {
  const prov = c.prov
  const cat = c.category || '其他'
  const pk = prov
  const ck = `${prov}|${cat}`

  const pn = provCount.get(pk) || 0
  const cn = provCatCount.get(ck) || 0
  if (pn >= PER_PROVINCE) continue
  if (cn >= PER_PROV_CAT) continue

  provCount.set(pk, pn + 1)
  provCatCount.set(ck, cn + 1)
  selected.push(c)
}

// 按类别轮转重排，保证下载顺序上四类交替（预算中断时四类都有落地）
selected.sort((a, b) => {
  const ca = CAT_ORDER.indexOf(a.category) < 0 ? 9 : CAT_ORDER.indexOf(a.category)
  const cb = CAT_ORDER.indexOf(b.category) < 0 ? 9 : CAT_ORDER.indexOf(b.category)
  if (ca !== cb) return ca - cb
  return b.score - a.score
})

console.log(`=== 下载计划 ===`)
console.log(`  候选 ${queue.length} → 配额筛选后 ${selected.length} 个`)
console.log(`  配额：每省 ≤${PER_PROVINCE} 个 · 每省每类 ≤${PER_PROV_CAT} 个 · 单文件 ≤${MAX_FILE_MB}MB`)
console.log(`  总预算 ${BUDGET_MB} MB · 并发 ${CONCURRENCY} · 同域名间隔 ${HOST_DELAY_MS}ms${DRY_RUN ? ' · DRY-RUN' : ''}`)
const planProv = new Map()
const planCat = new Map()
for (const c of selected) {
  planProv.set(c.prov, (planProv.get(c.prov) || 0) + 1)
  planCat.set(c.category, (planCat.get(c.category) || 0) + 1)
}
console.log(`  覆盖 ${planProv.size} 省 · 分类 ${JSON.stringify(Object.fromEntries(planCat))}`)
console.log('')

// ---------------------------------------------------------------------------
// 已有附件的 local 映射（避免重复下载同一 URL）
// ---------------------------------------------------------------------------
const existingLocal = new Map() // url -> local path
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (a.local && a.url) existingLocal.set(a.url, a.local)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 限速 + 预算
// ---------------------------------------------------------------------------
const hostLast = new Map()
async function throttle(url) {
  let h = 'unknown'
  try {
    h = new URL(url).hostname
  } catch {}
  const now = Date.now()
  const wait = Math.max(0, (hostLast.get(h) || 0) + HOST_DELAY_MS - now)
  hostLast.set(h, now + wait + 10)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

let usedBytes = 0
const budgetLock = { stopped: false }

// ---------------------------------------------------------------------------
// 下载单个附件
// ---------------------------------------------------------------------------
const doneFiles = loadDone('files-downloaded.txt')
// DRY-RUN 只做验证，不得写入断点续传记录（否则正式下载会误判为已完成）
const noopAppender = { push() {}, flush() {} }
const doneAppender = DRY_RUN ? noopAppender : createAppender('files-downloaded.txt')

/** 结果：provFile -> [{cityAdcode, pageUrl, attUrl, local, name}] */
const results = new Map()

function buildName(c, url) {
  // 优先锚文本（通常已含年份与文档名），否则 URL 推断
  let base = sanitize(c.text) || sanitize(filenameFromUrl(url)) || 'attachment'
  // 去掉序号前缀与多余空白
  base = base.replace(/^\s*[（(【\[]?\d+[）)】\].、:：]\s*/, '').trim() || base
  // 补扩展名
  if (!/\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)$/i.test(base)) {
    const em = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)(\?|$)/i.exec(url)
    if (em) base = `${base}.${em[1].toLowerCase()}`
  }
  // 若锚文本未含年份与省市，按项目规范「年份+省市+文档名」前缀补齐
  const year = c.year && c.year > 2000 ? c.year : null
  const hasYear = /^(19|20)\d{2}/.test(base)
  const shortProv = (c.prov || '').replace(/(壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)/g, '')
  const hasProv = shortProv ? base.includes(shortProv) : false
  const prefixParts = []
  if (year && !hasYear) prefixParts.push(`${year}年`)
  if (!hasProv) {
    if (shortProv) prefixParts.push(shortProv)
    // 直辖市省名与市名相同（如「北京市」），去市后缀后与省简称相等则不再叠加，
    // 避免拼出「北京北京」这类重复地区名
    const shortCity = (c.city || '').replace(/市$/, '')
    if (shortCity && shortCity !== shortProv && !base.includes(shortCity)) {
      prefixParts.push(shortCity)
    }
  }
  if (prefixParts.length) base = `${prefixParts.join('')}${base}`
  // 兜底：统一走 naming 模块规范化（含直辖市重复名去重、序号/噪声清理），保证与
  // scripts/normalize-names.mjs 产出一致，未来采集不再产生「北京北京」
  return normalizeFilename(sanitize(base)).slice(0, 110)
}

async function downloadOne(c) {
  if (budgetLock.stopped) return
  if (doneFiles.has(c.url)) return
  if (existingLocal.has(c.url)) {
    // 已在库中，直接登记复用
    recordResult(c, existingLocal.get(c.url), path.basename(existingLocal.get(c.url)), true)
    doneAppender.push(c.url)
    return
  }

  await throttle(c.url)
  const res = await fetchPage(c.url, { timeout: 30000 })
  if (!res.ok || !res.buf) {
    stat.fail++
    stat.errors[res.error || 'fetch-failed'] = (stat.errors[res.error || 'fetch-failed'] || 0) + 1
    return
  }
  if (res.buf.length > MAX_FILE_MB * 1024 * 1024) {
    stat.fail++
    stat.errors['too-large'] = (stat.errors['too-large'] || 0) + 1
    return
  }
  if (res.buf.length < 400) {
    stat.fail++
    stat.errors['too-small'] = (stat.errors['too-small'] || 0) + 1
    return
  }
  if (!looksLikeDocument(res.buf, c.url)) {
    stat.fail++
    stat.errors['not-a-document'] = (stat.errors['not-a-document'] || 0) + 1
    return
  }

  if ((usedBytes + res.buf.length) / 1024 / 1024 > BUDGET_MB) {
    // 大文件跳过，继续尝试后面的小文件，最大化覆盖面
    if (res.buf.length > 3 * 1024 * 1024) {
      stat.fail++
      stat.errors['over-budget-skipped'] = (stat.errors['over-budget-skipped'] || 0) + 1
      return
    }
    budgetLock.stopped = true
    return
  }

  const name = buildName(c, c.url)
  const dir = path.join(ATT_DIR, String(c.cityAdcode))
  fs.mkdirSync(dir, { recursive: true })

  let target = path.join(dir, name)
  if (fs.existsSync(target)) {
    const cur = fs.readFileSync(target)
    if (cur.length === res.buf.length && cur.equals(res.buf)) {
      recordResult(c, relOf(target), path.basename(target), true)
      usedBytes += res.buf.length
      doneAppender.push(c.url)
      return
    }
    const stem = name.replace(/\.[^.]+$/, '')
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
    let i = 2
    while (fs.existsSync(target) && i < 30) {
      target = path.join(dir, `${stem}_${i}${ext}`)
      i++
    }
    if (fs.existsSync(target)) {
      stat.fail++
      stat.errors['name-collision'] = (stat.errors['name-collision'] || 0) + 1
      return
    }
  }

  if (DRY_RUN) {
    recordResult(c, relOf(target), path.basename(target), false)
    usedBytes += res.buf.length
    stat.ok++
    doneAppender.push(c.url)
    return
  }

  fs.writeFileSync(target, res.buf)
  usedBytes += res.buf.length
  stat.ok++
  recordResult(c, relOf(target), path.basename(target), false)
  doneAppender.push(c.url)
}

function relOf(abs) {
  return path.relative(path.resolve('public'), abs).replace(/\\/g, '/')
}

function recordResult(c, local, name, reused) {
  const key = c.provFile
  if (!results.has(key)) results.set(key, [])
  results.get(key).push({ cityAdcode: c.cityAdcode, pageUrl: c.pageUrl, attUrl: c.url, local, name, reused, title: c.title })
  if (reused) stat.reused++
}

const stat = { ok: 0, fail: 0, reused: 0, errors: {} }

// ---------------------------------------------------------------------------
// 并发执行
// ---------------------------------------------------------------------------
let cursor = 0
let processed = 0
const t0 = Date.now()

async function worker() {
  while (cursor < selected.length) {
    if (budgetLock.stopped) return
    const i = cursor++
    try {
      await downloadOne(selected[i])
    } catch (e) {
      const k = `exception:${e.message}`.slice(0, 50)
      stat.errors[k] = (stat.errors[k] || 0) + 1
    }
    processed++
    if (processed % 25 === 0) {
      console.log(
        `  ${processed}/${selected.length}  下载OK ${stat.ok} 复用 ${stat.reused} 失败 ${stat.fail} | ${(usedBytes / 1024 / 1024).toFixed(1)}MB/${BUDGET_MB}MB | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
      )
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
doneAppender.flush()

console.log('\n=== 下载完成 ===')
console.log(`  新增落地 ${stat.ok} · 复用已有 ${stat.reused} · 失败 ${stat.fail}`)
console.log(`  实际体积 ${(usedBytes / 1024 / 1024).toFixed(1)} MB / 预算 ${BUDGET_MB} MB${budgetLock.stopped ? '  ⚠️ 已达预算上限' : ''}`)
console.log(`  耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
console.log('  失败原因:')
for (const [k, v] of Object.entries(stat.errors).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`    ${String(v).padStart(4)}  ${k}`)
}

// ---------------------------------------------------------------------------
// 回写各省 JSON（合并进对应公告的 attachments；同时补齐 date 字段）
// ---------------------------------------------------------------------------
saveJSON('download-results.json', {
  at: new Date().toISOString(),
  stat,
  usedMB: +(usedBytes / 1024 / 1024).toFixed(1),
  budgetHit: budgetLock.stopped,
  count: [...results.values()].reduce((s, a) => s + a.length, 0),
})

if (!DRY_RUN) {
  console.log('\n回写数据 JSON…')
  const writeBack = await import('./lib/writeback.mjs')
  const wb = writeBack.applyResults(DATA_DIR, results)
  console.log(
    `  更新公告 ${wb.updatedRecs} 条 · 新增附件记录 ${wb.newAtt} · 补齐日期 ${wb.datesFilled} 条 · 涉及 ${wb.provinces} 个省文件`,
  )
}
