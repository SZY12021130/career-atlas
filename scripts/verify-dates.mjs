/**
 * 查证：这 8 条 2026-10-02（今天）的浙江拟录用公示日期，
 * 是本次采集填入的真实发布日期，还是日期提取逻辑误抓了页面"当前日期"。
 *
 * 方法：
 *  1. 对比 git 原始版本，看这些记录的 date 是原本就有还是本次新增/改动
 *  2. 重新抓取对应公告页，检查页面正文里到底写了什么日期
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fetchPage, extractPublishDate, sliceContainer } from './lib/fetcher.mjs'

const DATA_DIR = path.resolve('public/data')
const TODAY = new Date().toISOString().slice(0, 10)

// 找出所有 date === 今天 的记录
const suspects = []
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      if (r.date === TODAY) suspects.push({ provFile: f, prov: d.name, city: c.name, title: r.title, url: r.url })
    }
  }
}

console.log(`=== date === 今天(${TODAY}) 的记录: ${suspects.length} 条 ===\n`)

// 1) 对比 git 原始版本
let orig = null
try {
  const raw = execSync('git show HEAD:public/data/330000.json', { cwd: path.resolve('.'), encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 })
  orig = JSON.parse(raw)
} catch (e) {
  console.log(`(无法读取 git 原始版本: ${e.message.slice(0, 60)})`)
}

if (orig) {
  const origDates = new Map()
  for (const c of orig.cities || []) for (const r of c.recruitments || []) origDates.set(r.url, r.date)
  console.log('--- 与 git 原始版本对比 ---')
  for (const s of suspects.filter((x) => x.provFile === '330000.json')) {
    const od = origDates.get(s.url)
    console.log(`  原「${od || '(空)'}」→ 今「${TODAY}」  ${s.city} ${s.title.slice(0, 24)}`)
  }
  console.log('')
}

// 2) 重新抓取页面，看正文里真实写了什么日期
console.log('--- 重新抓取页面核对真实日期 ---')
for (const s of suspects.slice(0, 8)) {
  const res = await fetchPage(s.url, { timeout: 25000 })
  if (!res.ok) {
    console.log(`  ✗ 页面不可达(${res.error}) ${s.city} ${s.url.slice(0, 50)}`)
    continue
  }
  const extracted = extractPublishDate(res.text)
  // 在正文容器里找所有日期，看是否有早于今天的真实发布日期
  const cont = sliceContainer(res.text)
  const body = cont ? cont.html : res.text
  const text = body.replace(/<[^>]+>/g, ' ')
  const allDates = [...new Set((text.match(/(20\d{2})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/g) || []))].slice(0, 6)
  console.log(`  ${s.city} 提取值=${extracted || '(无)'}`)
  console.log(`    正文出现的日期: ${allDates.join(' , ') || '(无)'}`)
  console.log(`    url: ${s.url.slice(0, 70)}`)
}
