/**
 * 无扩展名残留定位（只读）
 * 区分两种情况：
 *  - 磁盘文件名也无扩展名 → 需要重命名 + 改 name/local
 *  - 仅数据 name 缺扩展名，磁盘文件名正常 → 只需补 name
 */
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve('public/data')
const PUB = path.resolve('public')
const EX = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)$/i

let nameNoExt = 0
let diskAlsoNoExt = 0
let onlyNameMissing = 0
let diskMissing = 0
const samples = { disk: [], nameOnly: [] }
const byProv = new Map()

for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (!a.local) continue
        if (EX.test(a.name || '')) continue // name 已有扩展名，正常
        nameNoExt++
        const rel = a.local.replace(/\\/g, '/')
        const bn = path.basename(rel)
        const key = d.name
        byProv.set(key, (byProv.get(key) || 0) + 1)

        const abs = path.join(PUB, rel)
        if (!fs.existsSync(abs)) {
          diskMissing++
          continue
        }
        if (EX.test(bn)) {
          onlyNameMissing++
          if (samples.nameOnly.length < 8) samples.nameOnly.push(`${key}/${c.name} | name=${a.name} | 磁盘=${bn}`)
        } else {
          diskAlsoNoExt++
          if (samples.disk.length < 8) samples.disk.push(`${key}/${c.name} | ${bn}`)
        }
      }
    }
  }
}

console.log('=== name 字段缺扩展名的附件 ===')
console.log(`  总计              ${nameNoExt}`)
console.log(`  磁盘也无扩展名    ${diskAlsoNoExt}  → 需重命名文件 + 改 name/local`)
console.log(`  仅 name 缺(磁盘有)${onlyNameMissing}  → 只需补 name 字段`)
console.log(`  磁盘文件不存在    ${diskMissing}  → 断链，需单独查`)
console.log('\n  按省份分布:')
for (const [k, v] of [...byProv.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${k}: ${v}`)

if (samples.disk.length) {
  console.log('\n  磁盘也无扩展名样本:')
  for (const s of samples.disk) console.log(`    ${s}`)
}
if (samples.nameOnly.length) {
  console.log('\n  仅 name 缺扩展名样本:')
  for (const s of samples.nameOnly) console.log(`    ${s}`)
}
