/**
 * 薄弱省份诊断：列出公告数最少的省份的官方入口(portals)与现有公告，
 * 为定向补充采集确定起点。只读。
 */
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve('public/data')
const WEAK = ['620000', '630000', '610000', '130000', '650000', '640000']

for (const code of WEAK) {
  const fp = path.join(DATA_DIR, `${code}.json`)
  if (!fs.existsSync(fp)) continue
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'))
  const recs = (d.cities || []).reduce((s, c) => s + (c.recruitments || []).length, 0)
  console.log(`\n${'='.repeat(72)}`)
  console.log(`${d.name} (${code}) · 城市 ${(d.cities || []).length} · 公告 ${recs} · 高校 ${(d.universities || []).length} · updatedAt ${d.updatedAt}`)

  console.log(`  --- 省级官方入口 (${(d.provincePortals || []).length}) ---`)
  for (const p of (d.provincePortals || []).slice(0, 10)) {
    console.log(`    [${p.category}] ${p.name} → ${p.url}`)
  }

  const cityPortals = new Map()
  for (const c of d.cities || []) for (const p of c.portals || []) cityPortals.set(p.url, `[${p.category}] ${p.name}`)
  console.log(`  --- 市级官方入口去重 (${cityPortals.size}) 前 12 ---`)
  for (const [u, n] of [...cityPortals.entries()].slice(0, 12)) console.log(`    ${n} → ${u}`)

  if (recs > 0) {
    console.log(`  --- 现有公告样本 (前 5) ---`)
    let shown = 0
    for (const c of d.cities || []) {
      for (const r of c.recruitments || []) {
        if (shown++ >= 5) break
        console.log(`    [${r.category}] ${r.year} ${r.date || '(无日期)'} ${r.title.slice(0, 36)}`)
        console.log(`      ${r.url}`)
      }
      if (shown >= 5) break
    }
  } else {
    console.log(`  --- 无公告，城市列表: ${(d.cities || []).map((c) => c.name).slice(0, 8).join('、')} ---`)
  }
}
