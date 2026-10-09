/**
 * 河北市级人社局站点探测（只读）
 *
 * 背景：河北 59 条公告全部无附件、49 条无日期。根因是省考试网 hebpta.com.cn
 * 为 Vue SPA（静态 HTML 是空壳，已确认无法静态抓取）。
 * 但数据中收录的市级人社局多为传统静态站，石家庄已实测可抓到公告。
 * 本脚本探测其余市级站点的列表页，判断能否为河北补充附件与日期。
 */
import { fetchPage } from './lib/fetcher.mjs'
import fs from 'node:fs'
import path from 'node:path'

const d = JSON.parse(fs.readFileSync(path.resolve('public/data/130000.json'), 'utf8'))

/** 汇总市级入口，按域名去重（排除已确认 SPA 的省考试网） */
const portals = new Map()
for (const c of d.cities || []) {
  for (const p of c.portals || []) {
    if (/hebpta\.com\.cn/.test(p.url)) continue // 已确认 SPA，跳过
    let host
    try { host = new URL(p.url).hostname } catch { continue }
    if (!portals.has(host)) portals.set(host, { city: c.name, cat: p.category, name: p.name, url: p.url })
  }
}

console.log(`=== 河北市级入口去重 ${portals.size} 个（已排除省考试网）===\n`)

/** 常见列表栏目路径，逐个试探 */
const COLUMN_SUFFIX = ['', 'zcfg/', 'gggs/', 'tzgg/', 'ksxx/', 'sydw/', 'sydwzp/', 'columns/', 'xxgk/', 'zwgk/']

const usable = []
for (const [host, p] of portals) {
  let origin
  try { origin = new URL(p.url).origin } catch { continue }

  // 先探首页，判断是否 SPA
  const home = await fetchPage(p.url, { timeout: 18000 })
  if (!home.ok) {
    console.log(`✗ ${p.city} ${p.name}`)
    console.log(`    首页不可达: ${home.error}  ${p.url.slice(0, 60)}`)
    continue
  }
  const isSpa = home.buf.length < 4000 && /<div\s+id\s*=\s*["']?(app|root|febs)/i.test(home.text)
  const anchors = [...home.text.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => (m[1] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= 8 && /公告|招聘|录用|选调|公示|简章|岗位/.test(t))
  console.log(`${isSpa ? '⚠SPA' : '✓'} ${p.city} ${p.name} [${(home.buf.length / 1024) | 0}KB] 公告式链接 ${anchors.length}`)
  for (const a of anchors.slice(0, 3)) console.log(`      - ${a.slice(0, 46)}`)
  if (!isSpa && anchors.length > 0) usable.push({ host, origin, city: p.city, name: p.name, sample: anchors.length })
}

console.log(`\n=== 可用静态站 ${usable.length} 个 ===`)
for (const u of usable) console.log(`  ${u.city} ${u.name} (${u.origin}) 公告链接 ${u.sample}`)

// 对可用站点试探列表栏目页
if (usable.length) {
  console.log(`\n=== 列表栏目试探（前 4 站）===`)
  for (const u of usable.slice(0, 4)) {
    console.log(`\n  ${u.city} ${u.origin}`)
    for (const suf of COLUMN_SUFFIX) {
      if (!suf) continue
      const url = `${u.origin}/${suf}`
      const r = await fetchPage(url, { timeout: 15000 })
      if (!r.ok) continue
      const cnt = [...r.text.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((m) => (m[1] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length >= 10 && /公告|招聘|录用|选调|公示|简章|拟聘/.test(t)).length
      if (cnt > 0) console.log(`    ✓ ${suf.padEnd(12)} 公告式链接 ${cnt}`)
    }
  }
}
