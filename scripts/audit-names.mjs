/**
 * 附件文件名质量审计（只读）
 * 检查命名是否符合项目规范「年份+省市+文档名称」，找出残留噪声。
 */
import fs from 'node:fs'
import path from 'node:path'

const ATT = path.resolve('public/attachments')

/** 序号前缀噪声：如 "2-1." / "附件1：" / "1." / "（1）" */
const NOISE_PATTERNS = [
  { re: /^\d+[-–—]\d+[.、．]/, name: '多级序号(2-1.)' },
  { re: /^\d+[.、．]\s*/, name: '单级序号(1.)' },
  { re: /^[（(【\[]\s*\d+\s*[）)】\]]/, name: '括号序号(（1）)' },
  { re: /^附件\s*\d*\s*[:：]/, name: '附件前缀(附件1：)' },
  { re: /^[一二三四五六七八九十]+\s*[、.]/, name: '中文序号(一、)' },
]

const issues = new Map()
const samples = new Map()
let total = 0
let noYear = 0
let noYearSamples = []
let tooLong = 0
let doubleExt = 0
let doubleExtSamples = []

for (const dir of fs.readdirSync(ATT)) {
  const dp = path.join(ATT, dir)
  if (!fs.statSync(dp).isDirectory()) continue
  for (const fn of fs.readdirSync(dp)) {
    const st = fs.statSync(path.join(dp, fn))
    if (!st.isFile()) continue
    total++

    // 1) 序号噪声
    for (const p of NOISE_PATTERNS) {
      if (p.re.test(fn)) {
        issues.set(p.name, (issues.get(p.name) || 0) + 1)
        if (!samples.has(p.name)) samples.set(p.name, [])
        const arr = samples.get(p.name)
        if (arr.length < 5) arr.push(`${dir}/${fn}`)
        break
      }
    }

    // 2) 缺年份前缀
    if (!/^(19|20)\d{2}/.test(fn)) {
      noYear++
      if (noYearSamples.length < 10) noYearSamples.push(`${dir}/${fn}`)
    }

    // 3) 重复扩展名（如 x.xlsx.xlsx）
    const m = fn.match(/\.(docx?|xlsx?|pdf|wps|et|dps|zip|rar|ofd)\.(\1)$/i)
    if (m) {
      doubleExt++
      if (doubleExtSamples.length < 5) doubleExtSamples.push(`${dir}/${fn}`)
    }

    // 4) 过长
    if (fn.length > 100) tooLong++
  }
}

console.log(`附件总数 ${total}`)
console.log(`\n=== 序号前缀噪声 ===`)
if (issues.size === 0) console.log('  无')
for (const [k, v] of [...issues.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`)
  for (const s of samples.get(k) || []) console.log(`        ${s}`)
}
console.log(`\n=== 缺年份前缀 === ${noYear} 个 (${((noYear / total) * 100).toFixed(0)}%)`)
for (const s of noYearSamples) console.log(`  ${s}`)
console.log(`\n=== 重复扩展名 === ${doubleExt} 个`)
for (const s of doubleExtSamples) console.log(`  ${s}`)
console.log(`\n=== 文件名过长(>100字符) === ${tooLong} 个`)
