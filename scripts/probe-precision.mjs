/**
 * 精度与体积勘察（不写任何文件）
 *
 * 目的：DRY-RUN 显示 30 条公告发现 235 个附件（7.8/条），密度偏高，
 * 怀疑把侧栏/页脚的无关文档链接也抓进来了。本脚本对比"整页抽取"与
 * "正文容器内抽取"的附件数量，验证精度增益，并统计真实体积分布，
 * 为下载策略（每公告上限、总预算）提供依据。
 *
 * 用法：node scripts/probe-precision.mjs [样本数]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage, extractAttachmentLinks, looksLikeDocument } from './lib/fetcher.mjs'
import { headersFor } from './lib/fetcher.mjs'

const N = parseInt(process.argv[2] || '60', 10)
const DATA_DIR = path.resolve('public/data')

/**
 * 政务 CMS 常见正文容器特征（正则形式，按命中率排序）。
 * 命中任一即截取该容器内部 HTML 作为抽取范围。
 */
const CONTAINER_PATTERNS = [
  /<div[^>]+(?:id|class)\s*=\s*["'][^"']*(?:zoom|TRS_Editor|article-content|articleContent|content-detail|view\s|news-content|xl_content|article_content|main-content|detail-content|newscontent|news_content|content_con|txt-content)[^"']*["'][^>]*>/i,
  /<div[^>]+(?:id|class)\s*=\s*["'][^"']*(?:content|article|detail|main|view|text|body)[^"']*["'][^>]*>/i,
  /<article\b[^>]*>/i,
  /<td[^>]+(?:id|class)\s*=\s*["'][^"']*(?:content|article|zoom|text|view)[^"']*["'][^>]*>/i,
]

/** 截取正文容器：找到起始标签后做括号配对，返回内部 HTML */
function sliceContainer(html) {
  for (const re of CONTAINER_PATTERNS) {
    const m = re.exec(html)
    if (!m) continue
    const start = m.index
    const tagMatch = /^<(\w+)/.exec(m[0])
    if (!tagMatch) continue
    const tag = tagMatch[1].toLowerCase()

    // 从起始标签做同名标签配对，定位容器结束
    let depth = 0
    const scanRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
    scanRe.lastIndex = start
    let mm
    while ((mm = scanRe.exec(html)) !== null) {
      if (mm[1] === '/') {
        depth--
        if (depth === 0) {
          const end = Math.min(html.length, mm.index + mm[0].length)
          return { html: html.slice(start, end), pattern: re.source.slice(0, 40), start, end }
        }
      } else {
        // 自闭合不算
        if (!/\/>\s*$/.test(mm[0])) depth++
      }
    }
    // 配对失败但容器已定位：取起始后 60KB 作为近似正文
    return { html: html.slice(start, start + 60000), pattern: `${re.source.slice(0, 40)}(unpaired)`, start, end: start + 60000 }
  }
  return null
}

// ---------------------------------------------------------------------------
// 取样：跨省、跨域名，优先覆盖缺口大的省份
// ---------------------------------------------------------------------------
const pool = []
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      if (r.url) pool.push({ prov: d.name, city: c.name, title: r.title, cat: r.category, url: r.url })
    }
  }
}

// 按省份均匀取样，保证 31 省都被覆盖
const byProv = new Map()
for (const p of pool) {
  if (!byProv.has(p.prov)) byProv.set(p.prov, [])
  byProv.get(p.prov).push(p)
}
const sample = []
const perProv = Math.max(1, Math.ceil(N / byProv.size))
for (const [, items] of byProv) {
  // 省内按域名去重取样
  const seenHost = new Set()
  for (const it of items) {
    if (sample.length >= N) break
    let h = ''
    try {
      h = new URL(it.url).hostname
    } catch {
      continue
    }
    if (seenHost.has(h)) continue
    seenHost.add(h)
    sample.push(it)
    if (seenHost.size >= perProv) break
  }
}
console.log(`样本 ${sample.length} 条（覆盖 ${byProv.size} 省）\n`)

// ---------------------------------------------------------------------------
// 逐条勘察
// ---------------------------------------------------------------------------
const stats = {
  pageOk: 0,
  pageFail: 0,
  containerHit: 0,
  fullTotal: 0,
  bodyTotal: 0,
  sizes: [],
  sizeProbeOk: 0,
  sizeProbeFail: 0,
  perTaskBody: [],
  errors: {},
}

let done = 0
for (const s of sample) {
  done++
  const res = await fetchPage(s.url, { timeout: 22000 })
  if (!res.ok) {
    stats.pageFail++
    stats.errors[res.error] = (stats.errors[res.error] || 0) + 1
    continue
  }
  stats.pageOk++

  const fullLinks = extractAttachmentLinks(res.text, res.finalUrl)
  const cont = sliceContainer(res.text)
  const bodyLinks = cont ? extractAttachmentLinks(cont.html, res.finalUrl) : fullLinks
  if (cont) stats.containerHit++

  stats.fullTotal += fullLinks.length
  stats.bodyTotal += bodyLinks.length
  stats.perTaskBody.push(bodyLinks.length)

  // 对正文内附件探测体积（每条公告最多探 5 个，控制请求量）
  for (const l of bodyLinks.slice(0, 5)) {
    try {
      const h = await fetch(l.url, {
        method: 'HEAD',
        headers: headersFor(l.url),
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      })
      const cl = h.headers.get('content-length')
      if (h.ok && cl) {
        stats.sizes.push(parseInt(cl, 10))
        stats.sizeProbeOk++
      } else {
        stats.sizeProbeFail++
      }
    } catch {
      stats.sizeProbeFail++
    }
  }

  if (done % 15 === 0) {
    console.log(
      `  ${done}/${sample.length}  页面OK ${stats.pageOk} | 容器命中 ${stats.containerHit} | 整页链接 ${stats.fullTotal} → 正文链接 ${stats.bodyTotal}`,
    )
  }
}

// ---------------------------------------------------------------------------
// 报告
// ---------------------------------------------------------------------------
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(0) : '0')

console.log('\n=== 页面可达性 ===')
console.log(`  可达 ${stats.pageOk}/${sample.length} (${pct(stats.pageOk, sample.length)}%)`)
console.log(`  失败原因: ${Object.entries(stats.errors).map(([k, v]) => `${k}×${v}`).join(', ') || '无'}`)

console.log('\n=== 正文容器识别 ===')
console.log(`  命中率 ${stats.containerHit}/${stats.pageOk} (${pct(stats.containerHit, stats.pageOk)}%)`)

console.log('\n=== 精度对比（附件链接数）===')
console.log(`  整页抽取   ${stats.fullTotal} 个  (${(stats.fullTotal / Math.max(1, stats.pageOk)).toFixed(2)} 个/公告)`)
console.log(`  正文内抽取 ${stats.bodyTotal} 个  (${(stats.bodyTotal / Math.max(1, stats.pageOk)).toFixed(2)} 个/公告)`)
console.log(`  降噪率 ${pct(stats.fullTotal - stats.bodyTotal, stats.fullTotal)}%`)

const pt = stats.perTaskBody.sort((a, b) => a - b)
if (pt.length) {
  const q = (p) => pt[Math.min(pt.length - 1, Math.floor(pt.length * p))]
  console.log(`  每公告附件数分布: 中位数 ${q(0.5)} · P75 ${q(0.75)} · P90 ${q(0.9)} · 最大 ${pt[pt.length - 1]}`)
  console.log(`  零附件公告占比 ${pct(pt.filter((x) => x === 0).length, pt.length)}%`)
}

console.log('\n=== 体积分布（HEAD 探测）===')
if (stats.sizes.length) {
  const sz = stats.sizes.sort((a, b) => a - b)
  const MB = (b) => (b / 1024 / 1024).toFixed(2)
  const q = (p) => sz[Math.min(sz.length - 1, Math.floor(sz.length * p))]
  const avg = sz.reduce((a, b) => a + b, 0) / sz.length
  console.log(`  探测成功 ${stats.sizeProbeOk} · 失败 ${stats.sizeProbeFail}`)
  console.log(`  单文件: 平均 ${MB(avg)}MB · 中位 ${MB(q(0.5))}MB · P90 ${MB(q(0.9))}MB · P99 ${MB(q(0.99))}MB · 最大 ${MB(sz[sz.length - 1])}MB`)
  console.log(`  超 20MB 占比 ${pct(sz.filter((x) => x > 20 * 1024 * 1024).length, sz.length)}%`)

  // 全量外推
  const estTasks = pool.length
  const perTask = stats.bodyTotal / Math.max(1, stats.pageOk)
  const estAtt = Math.round(perTask * estTasks)
  console.log(`\n=== 全量外推（${estTasks} 条公告）===`)
  console.log(`  预计附件总数 ${estAtt} 个`)
  console.log(`  预计总体积 ${(estAtt * avg / 1024 / 1024).toFixed(0)} MB（按平均单文件 ${MB(avg)}MB）`)
  for (const cap of [2, 3, 4, 6]) {
    const capped = stats.perTaskBody.reduce((a, b) => a + Math.min(b, cap), 0)
    const ratio = capped / Math.max(1, stats.bodyTotal)
    console.log(`  每公告限 ${cap} 个 → 约 ${Math.round(estAtt * ratio)} 个 · ${(estAtt * ratio * avg / 1024 / 1024).toFixed(0)} MB`)
  }
}
