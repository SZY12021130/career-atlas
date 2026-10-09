/**
 * 线上发布验证（真实用户路径）
 * 复刻前端取数逻辑，但指向公开的 GitHub Pages 地址，
 * 确认站点、数据、附件下载三类资源均已更新到新版。
 */
const BASE = 'https://szy12021130.github.io/career-atlas/'
const MUNICIPALITY = new Set([110000, 120000, 310000, 500000])
const assetUrl = (p) => BASE + p.replace(/^\/+/, '')
const provOf = (a) => (MUNICIPALITY.has(a) ? a : Math.floor(a / 10000) * 10000)

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } })
  if (!res.ok) return { __error: `HTTP ${res.status}` }
  return res.json()
}
async function headSize(url) {
  const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } })
  const cr = res.headers.get('content-range')
  return { status: res.status, bytes: cr ? parseInt(cr.split('/')[1], 10) : (Number(res.headers.get('content-length')) || 0) }
}

console.log('=== 1) 站点入口 ===')
const html = await (await fetch(BASE, { headers: { 'Cache-Control': 'no-cache' } })).text()
const assetMatch = /assets\/(index-[\w-]+\.js)/.exec(html)
console.log(`  index.html OK，JS 产物: ${assetMatch?.[1] || '未找到'}`)
console.log(`  指南页路由已打包: ${/guide/i.test(html) || '（SPA 路由在 JS 内，检查下方 JS 体积）'}`)

console.log('\n=== 2) 各城市公告数据（线上）===')
for (const adcode of [620100, 640100, 130200, 130100, 110000, 440100]) {
  const idx = await getJSON(assetUrl('data/index.json'))
  const entry = idx.provinces?.find((p) => p.adcode === provOf(adcode))
  if (!entry) { console.log(`  ${adcode}: index 无该省`); continue }
  const prov = await getJSON(assetUrl(entry.dataFile))
  if (prov.__error) { console.log(`  ${adcode}: 省数据 ${prov.__error}`); continue }
  const city = (prov.cities || []).find((c) => c.adcode === adcode)
  if (!city) { console.log(`  ${adcode}: ✗ 城市节点缺失（会 404）`); continue }
  const recs = city.recruitments || []
  const loc = recs.reduce((s, r) => s + (r.attachments || []).filter((a) => a.local).length, 0)
  const attNames = recs.flatMap((r) => r.attachments || []).filter((a) => a.local).map((a) => a.name)
  const dup = attNames.filter((n) => /北京北京|天津天津|上海上海|重庆重庆/.test(n)).length
  const noExt = attNames.filter((n) => !/\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)$/i.test(n)).length
  console.log(`  ✓ ${city.name}：公告 ${recs.length} · 落地附件 ${loc} · 重复名 ${dup} · 无扩展名 ${noExt}`)
}

console.log('\n=== 3) 附件真实可下载（抽样线上文件）===')
const idx = await getJSON(assetUrl('data/index.json'))
const samples = []
for (const code of [620000, 130000, 640000, 110000]) {
  const e = idx.provinces.find((p) => String(p.adcode) === String(code))
  if (!e) continue
  const d = await getJSON(assetUrl(e.dataFile))
  outer: for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (a.local && /\.(xlsx?|pdf|docx?)$/i.test(a.name)) { samples.push(a.local); break outer }
      }
    }
  }
}
for (const rel of samples) {
  const u = assetUrl(rel)
  let size = 0
  try {
    const r = await fetch(u, { headers: { Range: 'bytes=0-0' } })
    const cr = r.headers.get('content-range')
    size = cr ? parseInt(cr.split('/')[1], 10) : (Number(r.headers.get('content-length')) || 0)
    console.log(`  ✓ HTTP ${r.status} ${(size / 1024).toFixed(0)}KB  ${decodeURIComponent(rel).slice(0, 56)}`)
  } catch (err) {
    console.log(`  ✗ ${rel} ${err.message}`)
  }
}

console.log('\n=== 4) 指南页内容已进入线上 JS ===')
try {
  const js = await (await fetch(assetUrl(`assets/${assetMatch[1]}`))).text()
  console.log(`  含「报考通道指南」: ${js.includes('报考通道指南')}`)
  console.log(`  含横向对比表维度「编制性质」: ${js.includes('编制性质')}`)
  console.log(`  含「全年报考日历」: ${js.includes('全年报考日历')}`)
  console.log(`  含「组通字〔2018〕17 号」: ${js.includes('组通字〔2018〕17 号')}`)
  console.log(`  关键词高亮组件着色（分类色）: ${js.includes('#F0635A')}`)
} catch (e) {
  console.log(`  ✗ 读取 JS 失败: ${e.message}`)
}
