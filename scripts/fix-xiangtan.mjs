/**
 * 一次性修复：湘潭(430300)「拟录用名单」断链 + 孤儿文件。
 *
 * 根因：原始数据里两条不同官方 URL 的附件记录指向了同一个 local 路径，
 * 归一化改名时按 oldRel 匹配只更新了一条，另一条断链，并遗留一个孤儿文件。
 *
 * 修复：用两条记录各自的官方源 URL 重新下载真实文件，建立一对一映射，
 * 数据按 attUrl 精确回写，删除多余孤儿。不依赖对历史的猜测。
 *
 * 用法：node scripts/fix-xiangtan.mjs [--apply]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage, looksLikeDocument, sanitize } from './lib/fetcher.mjs'

const PUB = path.resolve('public')
const DATA_FP = path.join(PUB, 'data/430000.json')
const CITY_ADCODE = 430300
const APPLY = process.argv.includes('--apply')

// 两条记录各自的官方源 URL（从数据中读出的真实地址）
const TARGETS = [
  { url: 'http://xtrs.xiangtan.gov.cn/uploadfiles/202506/2025061716071677611.pdf', seq: '' },
  { url: 'http://xtga.xiangtan.gov.cn/uploadfiles/202508/2025082808291017385.pdf', seq: '_2' },
]
const BASE_NAME = '2025年湖南湘潭市考试录用公务员拟录用人员名单'

const dir = path.join(PUB, 'attachments', String(CITY_ADCODE))
const results = []

console.log(`=== 湘潭断链修复（${APPLY ? 'APPLY' : 'DRY-RUN'}）===`)
for (const t of TARGETS) {
  const res = await fetchPage(t.url, { timeout: 30000 })
  if (!res.ok || !res.buf) {
    console.log(`  ✗ 下载失败 ${t.url.slice(0, 60)} → ${res.error}`)
    results.push({ url: t.url, ok: false })
    continue
  }
  const isPdf = looksLikeDocument(res.buf, t.url)
  const name = `${BASE_NAME}${t.seq}.pdf`
  const local = `attachments/${CITY_ADCODE}/${name}`
  console.log(`  ${isPdf ? '✓' : '✗'} ${(res.buf.length / 1024).toFixed(0)}KB isPdf=${isPdf} → ${name}`)
  results.push({ url: t.url, ok: isPdf, name, local, bytes: res.buf.length })

  if (APPLY && isPdf) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(PUB, local), res.buf)
  }
}

const okCount = results.filter((r) => r.ok).length
if (okCount < 2) {
  console.log(`\n⚠️ 仅 ${okCount}/2 个成功下载为有效 PDF，中止修复（不写数据），保留现状待人工处理`)
  process.exit(1)
}

if (!APPLY) {
  console.log('\n(dry-run，未写文件/数据。加 --apply 执行)')
  process.exit(0)
}

// 回写数据：按 attUrl 精确匹配两条记录，更新 name/local
const d = JSON.parse(fs.readFileSync(DATA_FP, 'utf8'))
let fixed = 0
for (const c of d.cities || []) {
  if (c.adcode !== CITY_ADCODE) continue
  for (const r of c.recruitments || []) {
    for (const a of r.attachments || []) {
      const hit = results.find((x) => x.ok && x.url === a.url)
      if (hit) {
        a.name = hit.name
        a.local = hit.local
        fixed++
      }
    }
  }
}
fs.writeFileSync(DATA_FP, JSON.stringify(d, null, 2), 'utf8')
console.log(`\n数据回写：修复 ${fixed} 条记录`)

// 清理孤儿：删除不再被引用的旧命名文件（仅本目录、仅本次涉及的孤儿）
const referenced = new Set()
for (const c of d.cities || []) {
  if (c.adcode !== CITY_ADCODE) continue
  for (const r of c.recruitments || []) for (const a of r.attachments || []) if (a.local) referenced.add(path.basename(a.local))
}
for (const fn of fs.readdirSync(dir)) {
  if (/拟录用人员名单/.test(fn) && !referenced.has(fn)) {
    const abs = path.join(dir, fn)
    console.log(`  删除孤儿: ${fn} (${fs.statSync(abs).size}B)`)
    fs.rmSync(abs)
  }
}
console.log('修复完成')
