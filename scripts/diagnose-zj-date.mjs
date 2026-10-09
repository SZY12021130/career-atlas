/**
 * 诊断浙江 zjks.gov.cn 页面为何被提取出「今天」日期。
 * 打印页面里所有日期出现位置的上下文，定位误抓来源。
 */
import { fetchPage } from './lib/fetcher.mjs'

const url = 'http://gwy.zjks.gov.cn/zjgwy/website/queryDetail.htm?mkxh=5&tzid=18262'
const res = await fetchPage(url, { timeout: 25000 })
console.log(`status=${res.status} len=${res.text.length} encoding=${res.encoding}`)

// 找出所有 "2026-10-02" 或 "2026年10月2日" 出现的位置及上下文
const html = res.text
const patterns = [/2026-10-02/g, /2026\s*年\s*10\s*月\s*2\s*日/g, /2026\/10\/02/g]
for (const re of patterns) {
  let m
  while ((m = re.exec(html)) !== null) {
    const ctx = html.slice(Math.max(0, m.index - 80), m.index + 40).replace(/\s+/g, ' ')
    console.log(`\n[${re.source}] @${m.index}:`)
    console.log(`  ...${ctx}...`)
  }
}

// meta 标签里的日期
console.log('\n=== meta 标签 ===')
for (const m of html.matchAll(/<meta[^>]*>/gi)) {
  if (/date|time|pub/i.test(m[0])) console.log('  ' + m[0].slice(0, 140))
}

// 页面里所有形如日期的字符串（前 15 个）
console.log('\n=== 页面所有日期样式字符串（去重前 15）===')
const all = [...new Set((html.match(/20\d{2}[-/.年]\s?\d{1,2}[-/.月]\s?\d{1,2}/g) || []))]
console.log('  ' + (all.slice(0, 15).join(' | ') || '(无)'))

// 检查是否有 JS 动态生成当前日期的代码
console.log('\n=== 含 new Date / 当前时间的脚本片段 ===')
for (const m of html.matchAll(/(new Date|getFullYear|currentTime|系统时间|当前时间|今天)[^;\n]{0,60}/gi)) {
  console.log('  ' + m[0].slice(0, 80))
}
