/**
 * 薄弱省份官方站点列表页探测（只读，不写数据）
 *
 * 目的：甘肃(0公告)/青海(3)/陕西(2)/新疆(3)/宁夏(5) 的公告只挂在省级，
 * 所有城市页都是空的。这些站点域名在现有数据中已有成功记录，说明可达。
 * 本脚本探测它们的「列表页」结构，确认能否批量发现新公告。
 */
import { fetchPage, extractAttachmentLinks, sliceContainer } from './lib/fetcher.mjs'

/** 候选列表页：来自数据中已收录的官方入口 + 常见栏目路径 */
const TARGETS = [
  { prov: '甘肃省', name: '甘肃组工网-通知公告', url: 'http://www.gszg.gov.cn/col/col46/index.html' },
  { prov: '甘肃省', name: '甘肃组工网-首页', url: 'http://www.gszg.gov.cn/' },
  { prov: '青海省', name: '青海党建网-通知公告', url: 'https://www.qhsdj.gov.cn/cmsx/p894/tzgg/' },
  { prov: '青海省', name: '青海人事考试网-首页', url: 'http://www.qhpta.com/' },
  { prov: '陕西省', name: '陕西党建网-陕西新闻', url: 'http://www.sx-dj.gov.cn/ywsd/szxw/' },
  { prov: '陕西省', name: '陕西人事考试网-首页', url: 'http://www.sxrsks.cn/' },
  { prov: '新疆', name: '新疆人社厅-事业单位招聘', url: 'http://rst.xinjiang.gov.cn/xjrst/c112746/common_list.shtml' },
  { prov: '新疆', name: '新疆人事考试中心-首页', url: 'https://www.xjrsks.com.cn/' },
  { prov: '宁夏', name: '宁夏党建网-通知公告', url: 'https://www.nxdjw.gov.cn/nxdjgsgg/' },
  { prov: '宁夏', name: '宁夏人事考试中心-首页', url: 'https://www.nxpta.com/' },
  { prov: '河北省', name: '石家庄人社局-公示公告', url: 'http://rsj.sjz.gov.cn/columns/fa354001-476c-4fb3-9469-f5f4e6321878/' },
  { prov: '河北省', name: '河北人社厅-首页', url: 'https://rst.hebei.gov.cn/' },
]

/** 公告标题特征词 */
const TITLE_HINT = /公告|简章|通知|招录|招聘|选调|遴选|拟录用|拟聘|成绩|报名|岗位|计划|公示/

console.log('=== 列表页探测 ===\n')
for (const t of TARGETS) {
  const res = await fetchPage(t.url, { timeout: 22000 })
  if (!res.ok) {
    console.log(`✗ ${t.prov} ${t.name}`)
    console.log(`    ${res.error}  ${t.url}`)
    continue
  }

  // 统计链接总数与「疑似公告」链接数
  const links = [...res.text.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  const items = []
  for (const m of links) {
    const attrs = m[1]
    const text = (m[2] || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    const hm = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)
    if (!hm || !text || text.length < 8) continue
    if (!TITLE_HINT.test(text)) continue
    let abs
    try { abs = new URL(hm[1].trim(), res.finalUrl).toString() } catch { continue }
    if (!/^https?:/i.test(abs)) continue
    items.push({ text: text.slice(0, 46), href: abs })
  }

  // 邻近日期数量（判断列表页是否带日期）
  const dateCount = (res.text.match(/20\d{2}[-/.年]\s?\d{1,2}[-/.月]\s?\d{1,2}/g) || []).length
  const cont = sliceContainer(res.text)
  const atts = extractAttachmentLinks(cont ? cont.html : res.text, res.finalUrl)

  console.log(`✓ ${t.prov} ${t.name}  [${res.status} ${(res.buf.length / 1024).toFixed(0)}KB enc=${res.encoding}]`)
  console.log(`    疑似公告链接 ${items.length} · 日期出现 ${dateCount} · 容器${cont ? '有' : '无'} · 正文附件 ${atts.length}`)
  for (const it of items.slice(0, 4)) console.log(`      - ${it.text}`)
  if (items.length === 0) console.log(`      (未匹配到公告式链接，需查看页面结构)`)
  console.log('')
}
