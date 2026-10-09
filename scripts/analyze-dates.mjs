/**
 * 数据日期覆盖分析（只读）
 * 检查公告日期分布，确认「更新到 2026-10-01 前」的覆盖情况，
 * 并找出晚于截止日的异常数据（若采集误抓到未来日期）。
 */
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve('public/data')
const CUTOFF = '2026-10-01'

const byMonth = new Map()
const byYear = new Map()
let noDate = 0
let total = 0
let afterCutoff = []
let maxDate = ''

for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      total++
      if (!r.date) { noDate++; continue }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue
      const ym = r.date.slice(0, 7)
      byMonth.set(ym, (byMonth.get(ym) || 0) + 1)
      byYear.set(r.date.slice(0, 4), (byYear.get(r.date.slice(0, 4)) || 0) + 1)
      if (r.date > maxDate) maxDate = r.date
      if (r.date > CUTOFF) afterCutoff.push({ prov: d.name, city: c.name, title: r.title.slice(0, 30), date: r.date })
    }
  }
}

console.log(`=== 日期覆盖 ===`)
console.log(`  公告总数 ${total} · 有日期 ${total - noDate} · 无日期 ${noDate} (${((noDate / total) * 100).toFixed(0)}%)`)
console.log(`  最新公告日期 ${maxDate}`)
console.log(`  晚于截止日 ${CUTOFF} 的: ${afterCutoff.length} 条`)
for (const a of afterCutoff.slice(0, 10)) console.log(`    ${a.date} ${a.prov}/${a.city} ${a.title}`)

console.log(`\n=== 按年份 ===`)
for (const [k, v] of [...byYear.entries()].sort()) console.log(`  ${k}: ${v}`)

console.log(`\n=== 近 12 个月分布 ===`)
const months = [...byMonth.keys()].sort()
for (const m of months.slice(-12)) console.log(`  ${m}: ${byMonth.get(m)}`)
