/**
 * 河北附件为 0 诊断（只读）
 * 聚焦「招聘/选聘公告」类页面（这类必带岗位表附件），
 * 报告：正文容器是否命中、全页 vs 正文内附件链接数、页面是否含附件扩展名字样。
 * 用于判断是抽取器通用缺陷（影响全站，必须修）还是河北页面特性（可接受）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage, extractAttachmentLinks, sliceContainer } from './lib/fetcher.mjs'

const d = JSON.parse(fs.readFileSync(path.resolve('public/data/130000.json'), 'utf8'))

// 找河北新增的「招聘/选聘公告」类（应有附件），排除公示/名单/取消类（多为纯文字）
const targets = []
for (const c of d.cities || []) {
  for (const r of c.recruitments || []) {
    const attCount = (r.attachments || []).length
    if (attCount > 0) continue
    if (!/招聘|选聘/.test(r.title || '')) continue
    if (/公示|名单|取消|核减|递补|成绩|体检/.test(r.title || '')) continue
    targets.push({ city: c.name, title: r.title, url: r.url })
  }
}

console.log(`=== 河北「招聘/选聘公告」且附件为 0 的页面：${targets.length} 个 ===\n`)

for (const t of targets.slice(0, 4)) {
  const res = await fetchPage(t.url, { timeout: 25000 })
  console.log(`${t.city} · ${t.title.slice(0, 34)}`)
  if (!res.ok) { console.log(`  ✗ 详情页不可达: ${res.error}\n`); continue }

  const cont = sliceContainer(res.text)
  const pageLinks = extractAttachmentLinks(res.text, res.finalUrl)
  const bodyLinks = cont ? extractAttachmentLinks(cont.html, res.finalUrl) : []

  // 页面里出现的所有附件扩展名字样（不论是否在 a 标签内）
  const extHits = [...new Set((res.text.match(/[\w\-./]+\.(?:docx?|xlsx?|pdf|wps|et|dps|zip|rar)/gi) || []))]

  console.log(`  容器${cont ? '命中' : '未命中'} · 全页附件链接 ${pageLinks.length} · 正文内 ${bodyLinks.length}`)
  console.log(`  页面出现的附件路径字样 ${extHits.length} 个:`)
  for (const e of extHits.slice(0, 5)) console.log(`      ${e.slice(0, 70)}`)
  // pageLinks/bodyLinks 是对象数组 {url,text}
  for (const l of pageLinks.slice(0, 3)) console.log(`  全页链接: ${l.url.slice(0, 66)} | 锚文本「${(l.text || '').slice(0, 16)}」`)
  for (const l of bodyLinks.slice(0, 3)) console.log(`  正文链接: ${l.url.slice(0, 66)}`)
  if (pageLinks.length && !bodyLinks.length) {
    console.log(`  ⚠️ 全页有附件但正文容器为 0 —— 容器截取把附件排除了`)
    if (cont) console.log(`     容器大小 ${cont.html.length} / 全页 ${res.text.length} (${((cont.html.length / res.text.length) * 100) | 0}%)`)
  }

  // 检查是否是 JS 动态加载附件（onclick / window.open / data-src）
  const jsAttach = /(?:window\.open|location\.href|download|onclick)\s*[=(][^)]*\.(?:docx?|xlsx?|pdf|zip|rar)/i.test(res.text)
  console.log(`  JS 动态附件线索: ${jsAttach ? '有' : '无'} · HTML大小 ${(res.buf.length / 1024) | 0}KB\n`)
}
