/**
 * 甘肃组工网栏目结构探测（只读）
 * 首页可发现公告但混杂新闻稿，且 col/col46 猜测路径 404。
 * 本脚本从首页提取真实栏目链接，找出「通知公告/招考招录」类栏目页。
 */
import { fetchPage } from './lib/fetcher.mjs'

const BASE = 'http://www.gszg.gov.cn/'
const res = await fetchPage(BASE, { timeout: 25000 })
console.log(`首页 status=${res.status} len=${res.buf?.length} enc=${res.encoding}`)
if (!res.ok) process.exit(1)

const html = res.text

// 1) 所有栏目型链接（col/colNN 或 /col 或 频道目录）
const colLinks = new Map()
for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
  const text = (m[2] || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const hm = /href\s*=\s*["']([^"']+)["']/i.exec(m[1])
  if (!hm || !text) continue
  let abs
  try { abs = new URL(hm[1].trim(), res.finalUrl).toString() } catch { continue }
  if (/col|channel|list|index/i.test(abs) || /通知|公告|招考|招录|招聘|选调|人才|公示|遴选/.test(text)) {
    if (!colLinks.has(abs)) colLinks.set(abs, text.slice(0, 30))
  }
}
console.log(`\n=== 栏目型链接 (${colLinks.size}) ===`)
for (const [u, t] of [...colLinks.entries()].slice(0, 40)) {
  console.log(`  [${t}] ${u.replace(BASE, '').slice(0, 60)}`)
}

// 2) 页面中出现的 /col/colNN 形式路径
const colPaths = [...new Set((html.match(/\/?col\/col\d+(?:\/index\.s?html?)?/g) || []))]
console.log(`\n=== col/colNN 路径 (${colPaths.length}) ===`)
console.log('  ' + colPaths.slice(0, 30).join('\n  '))

// 3) 试探常见栏目页，找出真正含公告列表的
console.log(`\n=== 候选栏目页试探 ===`)
const CANDS = [
  ...colPaths.slice(0, 12).map((p) => new URL(p.startsWith('/') ? p : `/${p}`, BASE).toString()),
  `${BASE}col/col46/index.html`,
  `${BASE}col/col47/index.html`,
  `${BASE}tzgg/`,
  `${BASE}zkgg/`,
]
for (const u of [...new Set(CANDS)].slice(0, 14)) {
  const r = await fetchPage(u, { timeout: 18000 })
  if (!r.ok) { console.log(`  ✗ ${r.error}  ${u.replace(BASE, '')}`); continue }
  const anchors = [...r.text.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => (m[1] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= 10 && /公告|招录|招聘|选调|遴选|拟录用|拟聘|公示/.test(t))
  console.log(`  ✓ ${String(r.buf.length / 1024 | 0).padStart(4)}KB 公告式链接 ${String(anchors.length).padStart(3)}  ${u.replace(BASE, '')}`)
  for (const a of anchors.slice(0, 3)) console.log(`        - ${a.slice(0, 44)}`)
}
