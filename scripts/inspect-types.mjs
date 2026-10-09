/**
 * 查看类型异常字段的实际值，为修复确定规则。只读。
 */
import fs from 'node:fs'
import path from 'node:path'

const B = path.resolve('public/data')

for (const f of ['130000.json', '230000.json', '440000.json']) {
  const d = JSON.parse(fs.readFileSync(path.join(B, f), 'utf8'))
  console.log(`\n${'='.repeat(66)}`)
  console.log(`${d.name} (${f})`)
  console.log(`  省级 adcode: ${JSON.stringify(d.adcode)} (${typeof d.adcode})`)
  const cities = d.cities || []
  console.log(`  城市 adcode 样本:`)
  for (const c of cities.slice(0, 4)) {
    console.log(`    ${JSON.stringify(c.adcode)} (${typeof c.adcode})  ${c.name}  公告 ${(c.recruitments || []).length}`)
  }

  // year 异常样本
  const badYears = []
  for (const c of cities) {
    for (const r of c.recruitments || []) {
      if (typeof r.year !== 'number') badYears.push({ city: c.name, year: r.year, t: typeof r.year, date: r.date, title: (r.title || '').slice(0, 34) })
    }
  }
  const kinds = new Map()
  for (const b of badYears) kinds.set(`${b.t}:${JSON.stringify(b.year)}`, (kinds.get(`${b.t}:${JSON.stringify(b.year)}`) || 0) + 1)
  console.log(`  year 异常 ${badYears.length} 条，取值分布:`)
  for (const [k, v] of [...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${String(v).padStart(3)}  ${k}`)
  console.log(`  year 异常样本（前 5）:`)
  for (const b of badYears.slice(0, 5)) {
    console.log(`    year=${JSON.stringify(b.year)} date=${b.date || '(空)'} | ${b.title}`)
  }
}
