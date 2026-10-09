/**
 * 前端取数路径复刻验证（只读，不依赖浏览器）
 *
 * 复刻 src/lib/data.ts 与 src/pages/CityPage.tsx 的真实逻辑：
 *   fetchIndex() → fetchProvince(resolveProvinceAdcode(cityAdcode))
 *   → prov.cities.find(c => c.adcode === cityAdcode)
 * 走的是预览服务器的 HTTP 路径（与浏览器同源同接口），
 * 用于确认「兰州公告为空」是数据/接口问题，还是渲染或缓存问题。
 */
const BASE = 'http://127.0.0.1:4174/career-atlas/'
const MUNICIPALITY = new Set([110000, 120000, 310000, 500000])

const assetUrl = (p) => BASE + p.replace(/^\/+/, '')

/** CityPage: resolveProvinceAdcode */
function resolveProvinceAdcode(cityAdcode) {
  if (MUNICIPALITY.has(cityAdcode)) return cityAdcode
  return Math.floor(cityAdcode / 10000) * 10000
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return { __error: `HTTP ${res.status}`, url }
    return await res.json()
  } catch (e) {
    return { __error: e.message, url }
  }
}

const tests = [620100, 640100, 130200, 330800, 110000]

for (const adcode of tests) {
  const provAdcode = resolveProvinceAdcode(adcode)
  const idx = await fetchJSON(assetUrl('data/index.json'))
  if (idx.__error) { console.log(`${adcode}: index.json 取数失败 ${idx.__error}`); continue }
  const entry = idx.provinces.find((p) => p.adcode === provAdcode)
  if (!entry) { console.log(`${adcode}: index.json 中找不到省级条目 ${provAdcode}`); continue }

  const prov = await fetchJSON(assetUrl(entry.dataFile))
  if (prov.__error) { console.log(`${adcode}: 省数据取数失败 ${prov.__error} ${entry.dataFile}`); continue }

  const city = (prov.cities || []).find((c) => c.adcode === adcode)
  if (!city) {
    console.log(`✗ ${adcode} → ${provAdcode}(${prov.name}) · 城市节点未找到 —— 前端会走 notfound/degraded`)
    continue
  }
  const recs = city.recruitments || []
  const localAtt = recs.reduce((s, r) => s + (r.attachments || []).filter((a) => a.local).length, 0)
  const cats = {}
  for (const r of recs) cats[r.category] = (cats[r.category] || 0) + 1
  const latest = recs.map((r) => r.date || '').filter(Boolean).sort().at(-1) || '无'
  console.log(`✓ ${adcode} ${city.name}（${prov.name}）`)
  console.log(`    公告 ${recs.length} 条 · 落地附件 ${localAtt} 个 · 最新日期 ${latest}`)
  console.log(`    类别 ${JSON.stringify(cats)}`)
  if (recs.length) console.log(`    首条: [${recs[0].category}] ${String(recs[0].title).slice(0, 40)}`)
}
