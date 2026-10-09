/**
 * 陕西 sx-dj.gov.cn 首页链接结构诊断（只读）
 * 首页返回 98KB 但三段规则匹配到 0 条公告，需看清实际链接锚文本，
 * 判断是规则过严、锚文本特殊，还是首页确实无公告列表（公告在子栏目）。
 */
import { fetchPage } from './lib/fetcher.mjs'

const URLS = ['http://www.sx-dj.gov.cn/', 'https://rst.shaanxi.gov.cn/']

for (const url of URLS) {
  const res = await fetchPage(url, { timeout: 20000 })
  console.log(`\n${'='.repeat(70)}`)
  console.log(`${url}  status=${res.status} ${(res.buf?.length / 1024) | 0}KB enc=${res.encoding}`)
  if (!res.ok) { console.log(`  不可达: ${res.error}`); continue }

  // 所有 a 链接的锚文本（≥6字符），看有没有招录相关
  const strip = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const all = []
  for (const m of res.text.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = strip(m[2])
    if (text.length < 6) continue
    const hm = /href\s*=\s*["']([^"']+)["']/i.exec(m[1])
    all.push({ text: text.slice(0, 40), href: hm ? hm[1].slice(0, 50) : '' })
  }
  console.log(`  全部链接 ${all.length} 个，前 30 个锚文本：`)
  for (const a of all.slice(0, 30)) console.log(`    ${a.text}  |  ${a.href}`)

  // 含招录关键词的链接（放宽规则）
  const loose = all.filter((a) => /公告|招录|招聘|选调|遴选|公示|简章|岗位|拟录|拟聘|考试/.test(a.text))
  console.log(`\n  宽松匹配招录相关链接 ${loose.length} 个：`)
  for (const a of loose.slice(0, 20)) console.log(`    ${a.text}  |  ${a.href}`)

  // 栏目链接（可能公告在子栏目）
  const cols = [...new Set(all.filter((a) => /col|column|channel|\/[a-z]+\/?$|list|index/i.test(a.href)).map((a) => a.href))].slice(0, 20)
  console.log(`\n  疑似栏目链接 ${cols.length} 个：`)
  for (const c of cols.slice(0, 15)) console.log(`    ${c}`)
}
