/**
 * 断链定位：找出数据中 local 指向但磁盘上不存在的附件，
 * 以及磁盘上存在但未被任何数据引用的孤儿文件，尝试匹配二者以修复。
 */
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve('public/data')
const PUB = path.resolve('public')

const broken = []
const referenced = new Set()

for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (!a.local) continue
        referenced.add(a.local.replace(/\\/g, '/'))
        const abs = path.join(PUB, a.local)
        if (!fs.existsSync(abs)) {
          broken.push({ prov: d.name, provFile: f, city: c.name, cityAdcode: c.adcode, rec: r.title, name: a.name, local: a.local, url: a.url })
        }
      }
    }
  }
}

console.log(`=== 断链 ${broken.length} 条 ===`)
for (const b of broken) {
  console.log(`  [${b.prov} / ${b.city}]`)
  console.log(`    记录名: ${b.name}`)
  console.log(`    local : ${b.local}`)
  console.log(`    url   : ${(b.url || '').slice(0, 90)}`)
}

// 磁盘上实际存在的、同目录下的文件，帮助判断改名后落到哪了
console.log('\n=== 断链所在目录的实际文件 ===')
for (const b of broken) {
  const dir = path.join(PUB, path.dirname(b.local))
  console.log(`\n  目录 ${path.dirname(b.local)} ${fs.existsSync(dir) ? '' : '(不存在)'}`)
  if (!fs.existsSync(dir)) continue
  const stem = path.basename(b.local).replace(/\.[^.]+$/, '')
  const files = fs.readdirSync(dir)
  // 找可能对应的：包含相同关键词的文件
  const kw = stem.slice(0, 8)
  const near = files.filter((fn) => fn.includes(kw) || stem.includes(fn.replace(/\.[^.]+$/, '').slice(0, 8)))
  console.log(`    近似匹配: ${near.length ? near.join(' | ') : '(无)'}`)
  if (!near.length) console.log(`    目录内文件数: ${files.length}`)
}

// 孤儿文件
const orphans = []
const ATT_DIR = path.join(PUB, 'attachments')
for (const root of fs.readdirSync(ATT_DIR)) {
  const rp = path.join(ATT_DIR, root)
  if (!fs.statSync(rp).isDirectory()) continue
  for (const fn of fs.readdirSync(rp)) {
    const rel = `attachments/${root}/${fn}`
    if (!referenced.has(rel)) orphans.push(rel)
  }
}
console.log(`\n=== 孤儿文件 ${orphans.length} 个 ===`)
for (const o of orphans.slice(0, 20)) console.log(`  ${o}`)
