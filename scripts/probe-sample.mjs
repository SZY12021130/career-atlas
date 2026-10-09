/**
 * 抽样验证：检查 TextDecoder 是否支持 GBK，并在真实公告页上验证附件抽取效果。
 * 只读，不写任何文件。
 */
import { fetchPage, extractAttachments, looksLikeDocument } from './lib/fetcher.mjs'
import fs from 'node:fs'

// 1) ICU / GBK 支持自检
console.log('=== TextDecoder 编码支持 ===')
for (const enc of ['utf-8', 'gbk', 'gb18030', 'big5']) {
  try {
    new TextDecoder(enc)
    console.log(`  ${enc}: OK`)
  } catch (e) {
    console.log(`  ${enc}: NOT SUPPORTED (${e.message})`)
  }
}

// 2) 抽取样本：从各省随机取若干公告 URL（覆盖难站点与易站点）
const DATA_DIR = 'public/data'
const files = fs.readdirSync(DATA_DIR).filter((f) => /^\d+\.json$/.test(f))
const pool = []
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(`${DATA_DIR}/${f}`, 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      if (r.url) pool.push({ prov: d.name, city: c.name, title: r.title, url: r.url })
    }
  }
}
console.log(`\n=== 公告池 ===\n  总计 ${pool.length} 条`)

// 按域名去重后取样，保证覆盖面（每个域名最多 1 条）
const byHost = new Map()
for (const p of pool) {
  try {
    const h = new URL(p.url).hostname
    if (!byHost.has(h)) byHost.set(h, p)
  } catch {}
}
const uniq = [...byHost.values()]
console.log(`  唯一域名 ${uniq.length} 个`)

// 固定步长取样，避免只取到某一省
const N = parseInt(process.argv[2] || '30', 10)
const step = Math.max(1, Math.floor(uniq.length / N))
const sample = []
for (let i = 0; i < uniq.length && sample.length < N; i += step) sample.push(uniq[i])

console.log(`\n=== 抽样验证 ${sample.length} 个域名 ===\n`)

let okPage = 0
let okWithAtt = 0
let okAttReal = 0
const errors = new Map()

for (const s of sample) {
  const t0 = Date.now()
  const res = await fetchPage(s.url, { timeout: 22000 })
  if (!res.ok) {
    errors.set(res.error, (errors.get(res.error) || 0) + 1)
    console.log(`PAGE-ERR  ${String(res.error).slice(0, 26).padEnd(27)} ${s.prov} | ${s.url.slice(0, 58)}`)
    continue
  }
  okPage++
  const atts = extractAttachments(res.text, res.finalUrl)
  const cjk = /[\u4e00-\u9fa5]/.test(res.text.slice(0, 3000))
  let probe = ''
  if (atts.length > 0) {
    okWithAtt++
    // 抽验第一个附件是否真的可下载且是文档
    const dl = await fetchPage(atts[0], { timeout: 22000 })
    if (dl.ok && dl.buf && looksLikeDocument(dl.buf, atts[0])) {
      okAttReal++
      probe = `DL-OK ${(dl.buf.length / 1024).toFixed(0)}KB`
    } else {
      probe = `DL-BAD ${dl.ok ? 'not-a-doc' : dl.error}`
    }
  }
  console.log(
    `OK  enc=${(res.encoding || '-').padEnd(6)} cjk=${cjk ? 'Y' : 'N'} att=${String(atts.length).padStart(2)} ${probe.padEnd(14)} ${String(Date.now() - t0).padStart(5)}ms ${s.prov.slice(0, 6)}`,
  )
}

console.log('\n=== 汇总 ===')
console.log(`  页面可达    ${okPage}/${sample.length}  (${((okPage / sample.length) * 100).toFixed(0)}%)`)
console.log(`  含附件链接  ${okWithAtt}/${okPage}  (${okPage ? ((okWithAtt / okPage) * 100).toFixed(0) : 0}%)`)
console.log(`  附件可下载  ${okAttReal}/${okWithAtt}  (${okWithAtt ? ((okAttReal / okWithAtt) * 100).toFixed(0) : 0}%)`)
console.log('  失败原因分布:')
for (const [k, v] of [...errors.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(3)}  ${k}`)

// 外推
const estPages = Math.round((okPage / sample.length) * pool.length)
const estAtt = Math.round((okWithAtt / Math.max(1, sample.length)) * pool.length)
console.log(`\n=== 外推到全量 ${pool.length} 条公告 ===`)
console.log(`  预计可达公告页 ${estPages} 条`)
console.log(`  预计可发现附件的公告 ${estAtt} 条`)
