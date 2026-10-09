/**
 * 数据完整性校验（只读）
 *  - 各省公告数 / 附件记录数 / 已落地数 / 无日期数
 *  - 附件文件体积与异常小文件
 *  - JSON 结构合法性
 *  - 数据与磁盘文件的一致性（local 指向的文件是否真实存在）
 */
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve('public/data')
const PUB = path.resolve('public')
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

let totRec = 0
let totAtt = 0
let totLocal = 0
let recWithLocal = 0
let noDate = 0
let badDate = 0
let missingFile = 0
const missingSamples = []
const rows = []
const catStat = new Map()

for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const fp = path.join(DATA_DIR, f)
  let d
  try {
    d = JSON.parse(fs.readFileSync(fp, 'utf8'))
  } catch (e) {
    console.log(`⚠️ ${f} JSON 损坏: ${e.message}`)
    continue
  }
  if (!d || !Array.isArray(d.cities)) {
    console.log(`⚠️ ${f} 结构异常`)
    continue
  }
  let pr = 0, pa = 0, pal = 0, pnd = 0
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      totRec++
      pr++
      catStat.set(r.category, (catStat.get(r.category) || 0) + 1)
      if (!r.date) { noDate++; pnd++ }
      else if (!DATE_RE.test(r.date)) badDate++
      let hasLocal = false
      for (const a of r.attachments || []) {
        totAtt++; pa++
        if (a.local) {
          totLocal++; pal++; hasLocal = true
          const abs = path.join(PUB, a.local)
          if (!fs.existsSync(abs)) {
            missingFile++
            if (missingSamples.length < 8) missingSamples.push(`${d.name}/${c.name} → ${a.local}`)
          }
        }
      }
      if (hasLocal) recWithLocal++
    }
  }
  rows.push({ prov: d.name, rec: pr, att: pa, local: pal, noDate: pnd, updatedAt: d.updatedAt })
}

console.log('=== 全局统计 ===')
console.log(`  公告总数            ${totRec}`)
console.log(`  附件记录总数        ${totAtt}`)
console.log(`  已落地(local)       ${totLocal}`)
console.log(`  有本地附件的公告    ${recWithLocal}`)
console.log(`  无日期公告          ${noDate}`)
console.log(`  日期格式异常        ${badDate}`)
console.log(`  local 指向文件缺失  ${missingFile}`)
if (missingSamples.length) {
  console.log('  缺失样本:')
  for (const s of missingSamples) console.log(`    ${s}`)
}

console.log('\n=== 按类别 ===')
for (const [k, v] of [...catStat.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(k).padEnd(10)} ${v}`)
}

console.log('\n=== 按省份（按已落地附件降序）===')
console.log('  省份                公告  附件  已落地  无日期  updatedAt')
for (const r of rows.sort((a, b) => b.local - a.local)) {
  console.log(
    `  ${r.prov.padEnd(16)} ${String(r.rec).padStart(4)} ${String(r.att).padStart(5)} ${String(r.local).padStart(6)} ${String(r.noDate).padStart(6)}  ${r.updatedAt || '-'}`,
  )
}

// 磁盘侧统计
const ATT_DIR = path.join(PUB, 'attachments')
let fileCount = 0
let totalBytes = 0
const tiny = []
const extCount = new Map()
const cityDirs = new Set()
for (const root of fs.readdirSync(ATT_DIR)) {
  const rp = path.join(ATT_DIR, root)
  if (!fs.statSync(rp).isDirectory()) continue
  cityDirs.add(root)
  for (const fn of fs.readdirSync(rp)) {
    const abs = path.join(rp, fn)
    const st = fs.statSync(abs)
    if (!st.isFile()) continue
    fileCount++
    totalBytes += st.size
    if (st.size < 800) tiny.push(`${root}/${fn} (${st.size}B)`)
    const ext = (path.extname(fn).slice(1) || 'none').toLowerCase()
    extCount.set(ext, (extCount.get(ext) || 0) + 1)
  }
}

console.log('\n=== 磁盘附件 ===')
console.log(`  文件数 ${fileCount} · 总体积 ${(totalBytes / 1024 / 1024).toFixed(1)} MB · 城市目录 ${cityDirs.size} 个`)
console.log(`  扩展名分布: ${[...extCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
if (tiny.length) {
  console.log(`  ⚠️ 异常小文件 ${tiny.length} 个:`)
  for (const t of tiny.slice(0, 10)) console.log(`    ${t}`)
}

// 未被任何公告引用的孤儿文件
const referenced = new Set()
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) for (const r of c.recruitments || []) for (const a of r.attachments || []) if (a.local) referenced.add(a.local.replace(/\\/g, '/'))
}
let orphans = 0
const orphanSamples = []
for (const root of fs.readdirSync(ATT_DIR)) {
  const rp = path.join(ATT_DIR, root)
  if (!fs.statSync(rp).isDirectory()) continue
  for (const fn of fs.readdirSync(rp)) {
    const rel = `attachments/${root}/${fn}`
    if (!referenced.has(rel)) {
      orphans++
      if (orphanSamples.length < 6) orphanSamples.push(rel)
    }
  }
}
console.log(`\n=== 引用一致性 ===`)
console.log(`  被公告引用的附件 ${referenced.size} 个 · 磁盘孤儿文件 ${orphans} 个`)
if (orphanSamples.length) for (const s of orphanSamples) console.log(`    孤儿: ${s}`)
