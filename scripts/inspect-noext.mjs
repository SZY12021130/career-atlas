/**
 * 核查 6 个「磁盘也无扩展名」附件：所属公告标题 + 文件头实际类型 + 大小。
 * 为准确重命名提供依据（不臆造名称与类型）。只读。
 */
import fs from 'node:fs'
import path from 'node:path'
import { detectExt } from './lib/magictype.mjs'

const DATA_DIR = path.resolve('public/data')
const PUB = path.resolve('public')
const EX = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)$/i

for (const f of ['130000.json']) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (!a.local || EX.test(path.basename(a.local))) continue
        const abs = path.join(PUB, a.local.replace(/\\/g, '/'))
        if (!fs.existsSync(abs)) { console.log(`[缺失] ${c.name} ${a.local}`); continue }
        const buf = fs.readFileSync(abs)
        const ext = detectExt(buf)
        // zip 类：列出压缩包内前几个条目名，判断到底是 Office 包还是真 zip
        let inner = ''
        if (ext === 'zip') {
          const head = buf.slice(0, 4096).toString('latin1')
          const names = [...head.matchAll(/([\w\-.\u4e00-\u9fa5（）() ]+\.(?:xlsx?|docx?|pdf|wps|et))/g)].map((m) => m[1]).slice(0, 4)
          inner = names.length ? ' 内含: ' + names.join(' | ') : ' (未列出内部名)'
        }
        console.log(`${c.name} | 判型=${ext} | ${(buf.length / 1024).toFixed(0)}KB${inner}`)
        console.log(`   现名: ${path.basename(a.local)}`)
        console.log(`   公告: ${r.title}`)
        console.log(`   公告URL: ${r.url}`)
        console.log(`   附件URL: ${a.url}`)
        console.log('')
      }
    }
  }
}
