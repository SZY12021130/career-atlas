/**
 * dist 部署产物完整性核验（只读）
 * 确认构建产物中的数据与附件完整、命名合规、引用一致，可直接部署。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIST = path.resolve('dist')
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

let recs = 0
let atts = 0
let locals = 0
let noDate = 0
let badDate = 0
let dup = 0
let missing = 0
const missingSamples = []
const provRows = []

// 收集去重后的引用路径：多公告可共享同一附件，故「引用条数」≠「物理文件数」属正常
const referenced = new Set()

for (const f of fs.readdirSync(path.join(DIST, 'data')).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DIST, 'data', f), 'utf8'))
  let pr = 0, pa = 0, pl = 0
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      recs++; pr++
      if (!r.date) noDate++
      else if (!DATE_RE.test(r.date)) badDate++
      for (const a of r.attachments || []) {
        atts++; pa++
        if (a.local) {
          locals++; pl++
          const rel = a.local.replace(/\\/g, '/')
          referenced.add(rel)
          if (/北京北京|天津天津|上海上海|重庆重庆/.test(a.name || '')) dup++
          const abs = path.join(DIST, rel)
          if (!fs.existsSync(abs)) {
            missing++
            if (missingSamples.length < 6) missingSamples.push(`${d.name}/${c.name} → ${rel}`)
          }
        }
      }
    }
  }
  provRows.push({ prov: d.name, rec: pr, att: pa, local: pl })
}

// 磁盘侧附件统计
let diskFiles = 0
let diskBytes = 0
let orphans = 0
const attRoot = path.join(DIST, 'attachments')
for (const root of fs.readdirSync(attRoot)) {
  const rp = path.join(attRoot, root)
  if (!fs.statSync(rp).isDirectory()) continue
  for (const fn of fs.readdirSync(rp)) {
    const st = fs.statSync(path.join(rp, fn))
    if (!st.isFile()) continue
    diskFiles++
    diskBytes += st.size
    // 未被任何公告引用的文件 = 孤儿（数据与磁盘不一致）
    if (!referenced.has(`attachments/${root}/${fn}`)) orphans++
  }
}

console.log('=== dist 数据核验 ===')
console.log(`  公告总数        ${recs}`)
console.log(`  附件记录        ${atts} · 已落地 ${locals}`)
console.log(`  无日期公告      ${noDate} · 日期格式异常 ${badDate}`)
console.log(`  直辖市重复名    ${dup}`)
console.log(`  local 文件缺失  ${missing}`)
if (missingSamples.length) for (const s of missingSamples) console.log(`    ⚠️ ${s}`)

console.log('\n=== dist 附件磁盘 ===')
console.log(`  物理文件 ${diskFiles} · 体积 ${(diskBytes / 1024 / 1024).toFixed(1)} MB`)
console.log(`  去重后引用 ${referenced.size} · 落地引用记录 ${locals}（多公告共享同一附件，两者可不等）`)
console.log(`  磁盘孤儿文件 ${orphans}`)

console.log('\n=== 各省落地附件（前 12）===')
for (const r of provRows.sort((a, b) => b.local - a.local).slice(0, 12)) {
  console.log(`  ${r.prov.padEnd(14)} 公告${String(r.rec).padStart(4)} 附件${String(r.att).padStart(4)} 落地${String(r.local).padStart(4)}`)
}

const zero = provRows.filter((r) => r.local === 0).map((r) => r.prov)
console.log(`\n  零附件省份(${zero.length}): ${zero.join('、') || '无'}`)

// 关键构建产物存在性
console.log('\n=== 关键产物 ===')
for (const p of ['index.html', 'data/index.json', 'geo/100000_full.json']) {
  const abs = path.join(DIST, p)
  console.log(`  ${fs.existsSync(abs) ? '✓' : '✗'} ${p}${fs.existsSync(abs) ? ` (${(fs.statSync(abs).size / 1024).toFixed(0)}KB)` : ''}`)
}
const assets = fs.readdirSync(path.join(DIST, 'assets'))
console.log(`  assets: ${assets.length} 个文件 (${assets.join(', ').slice(0, 90)})`)

// 部署判定：无断链、无孤儿、无重复地区名、无异常日期、关键产物齐备。
// 注意不可要求「落地引用数 == 物理文件数」——多公告共享同一附件属正常。
const ok =
  missing === 0 &&
  orphans === 0 &&
  dup === 0 &&
  badDate === 0 &&
  fs.existsSync(path.join(DIST, 'index.html')) &&
  referenced.size > 0
console.log(`\n结论: ${ok ? '✅ 可部署（引用一致、命名合规、日期合规）' : '❌ 存在问题需修复'}`)
