/**
 * 量化容器缺陷影响范围（只读 manifest，不联网）
 *
 * manifest.json 每条 entry 存有 pageOk / containerHit / links（旧逻辑：容器内抽取）。
 * 「containerHit=true 但 links=0」的条目是可疑集 —— 可能是真无附件，
 * 也可能是容器截错把附件排除了（河北已证实后者存在）。
 * 统计这批条目规模，决定是否值得用修复后的逻辑全量回补。
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadJSON } from './lib/state.mjs'

const manifest = loadJSON('manifest.json', {}) || {}
const DATA_DIR = path.resolve('public/data')

// 已下载 local 的 URL 集合（这些公告已处理过，重点看它们是否可能漏附件）
const recHasLocal = new Set()
const recTotal = new Set()
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      if (!r.url) continue
      recTotal.add(r.url)
      if ((r.attachments || []).some((a) => a.local)) recHasLocal.add(r.url)
    }
  }
}

let pageOk = 0
let contHit = 0
let contHitZeroLink = 0
let contMissZeroLink = 0 // 未命中容器且 0 链接（多为真无附件）
const suspicious = [] // containerHit=true & links=0

for (const [provFile, entries] of Object.entries(manifest)) {
  for (const e of entries || []) {
    if (!e.pageOk) continue
    pageOk++
    const linkCount = (e.links || []).length
    if (e.containerHit) {
      contHit++
      if (linkCount === 0) {
        contHitZeroLink++
        suspicious.push({ provFile, url: e.url, title: e.title, city: e.cityName })
      }
    } else if (linkCount === 0) {
      contMissZeroLink++
    }
  }
}

console.log('=== 容器缺陷影响量化（基于现有 manifest）===')
console.log(`  可达公告页            ${pageOk}`)
console.log(`  容器命中              ${contHit}`)
console.log(`  容器命中但 0 附件     ${contHitZeroLink}  ← 可疑集（可能容器截错漏附件）`)
console.log(`  容器未命中且 0 附件   ${contMissZeroLink}  （多为真无附件，如纯文字公示）`)
console.log(`\n  可疑集占可达页比例    ${((contHitZeroLink / pageOk) * 100).toFixed(1)}%`)

// 可疑集中，有多少是「数据里已标记有 local 附件」的（说明主采集抓到过，可能不全）
let suspiciousWithLocal = 0
for (const s of suspicious) if (recHasLocal.has(s.url)) suspiciousWithLocal++
console.log(`  可疑集中已有 local 附件 ${suspiciousWithLocal} · 尚无附件 ${suspicious.length - suspiciousWithLocal}`)

// 导出可疑集 URL，供网络抽样验证
fs.writeFileSync(path.resolve('scripts/.state/suspicious.json'), JSON.stringify(suspicious, null, 0), 'utf8')
console.log(`\n  可疑集已导出 scripts/.state/suspicious.json（${suspicious.length} 条）`)
