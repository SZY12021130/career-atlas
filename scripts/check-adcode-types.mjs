/**
 * adcode 类型一致性核查（只读）
 *
 * 前端 CityPage 用 `c.adcode === cityAdcode`（数字）严格比较定位城市，
 * 若数据里 adcode 是字符串，该省所有城市页都会落到「未找到该城市」。
 * 本脚本核查全库类型，并统计受影响的城市数。
 *
 * 必须用脚本文件运行 —— PowerShell 会破坏内联脚本里的 $ 转义。
 */
import fs from 'node:fs'
import path from 'node:path'

const B = path.resolve('public/data')
const files = fs.readdirSync(B).filter((x) => /^\d+\.json$/.test(x))
console.log(`扫描省份数据文件 ${files.length} 个\n`)

const bad = []
let totalCities = 0
let strCities = 0

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(B, f), 'utf8'))
  const cities = d.cities || []
  totalCities += cities.length

  const strCity = cities.filter((c) => typeof c.adcode !== 'number')
  const provBad = typeof d.adcode !== 'number'
  if (strCity.length || provBad) {
    bad.push({ name: d.name, file: f, strCity: strCity.length, total: cities.length, provBad })
    strCities += strCity.length
  }

  // 附带检查 recruitments.year 类型（此前发现河北 year 为 undefined）
  let badYear = 0
  for (const c of cities) {
    for (const r of c.recruitments || []) {
      if (typeof r.year !== 'number') badYear++
    }
  }
  if (badYear) console.log(`  ${d.name} (${f}): year 字段非数字 ${badYear} 条`)
}

console.log('\n=== adcode 类型异常省份 ===')
if (bad.length === 0) {
  console.log('  无 —— 全部为数字类型')
} else {
  for (const b of bad) {
    console.log(`  ⚠️ ${b.name} (${b.file}): ${b.strCity}/${b.total} 个城市 adcode 非数字${b.provBad ? ' · 省级 adcode 也非数字' : ''}`)
  }
}

console.log(`\n汇总：城市节点 ${totalCities} 个，其中 adcode 非数字 ${strCities} 个`)
console.log(`受影响城市页：${strCities} 个会显示「未找到该城市」`)

// index.json 一致性
const idx = JSON.parse(fs.readFileSync(path.join(B, 'index.json'), 'utf8'))
const badIdx = (idx.provinces || []).filter((p) => typeof p.adcode !== 'number')
console.log(`\nindex.json：${(idx.provinces || []).length} 省，adcode 非数字 ${badIdx.length} 个${badIdx.length ? ' → ' + badIdx.map((p) => p.name).join('、') : ''}`)
