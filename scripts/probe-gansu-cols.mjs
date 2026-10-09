/**
 * 甘肃组工网真实栏目页验证（只读）
 * 首页已暴露 tzgg.htm（通知公告）、rcgz.htm（人才工作）、rqgs.htm（任前公示）等栏目。
 * 验证哪些栏目含可采集的招录公告列表。
 */
import { fetchPage } from './lib/fetcher.mjs'

const BASE = 'http://www.gszg.gov.cn/'

/** 必须含正式公文文种词，排除新闻报道 */
const MUST = /公告|简章|公示|名单|岗位表|职位表|计划表|考试大纲|报考指南|招聘计划|招募公告/
/** 招录语义 */
const RECRUIT = /考试录用公务员|招录公务员|选调生|选聘|事业单位公开招聘|事业单位.{0,10}招聘|人才引进|引进.{0,8}人才|拟录用|拟聘用|招聘岗位|职位表|招考简章|招聘简章|三支一扶|遴选|引才/
/** 明确排除 */
const EXCLUDE = /表彰|优秀共产党员|党务工作者|七一勋章|养老保险|社会保险|职称评审|技能等级|工伤|病残津贴|社保卡|养老金|转载|网站|系统维护|任免|任前公示|干部任前|靶向施策|多措并举|提升.{0,10}质效|全链条|焕新生|激发|动能/

const COLS = ['tzgg.htm', 'rcgz.htm', 'zkgg.htm', 'gsgg.htm']

for (const col of COLS) {
  const url = BASE + col
  const res = await fetchPage(url, { timeout: 22000 })
  if (!res.ok) {
    console.log(`✗ ${col} → ${res.error}`)
    continue
  }
  const items = []
  for (const m of res.text.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = (m[2] || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (!text || text.length < 8) continue
    const hm = /href\s*=\s*["']([^"']+)["']/i.exec(m[1])
    if (!hm) continue
    let abs
    try { abs = new URL(hm[1].trim(), res.finalUrl).toString() } catch { continue }
    if (!/^https?:/i.test(abs)) continue
    if (!MUST.test(text)) continue
    if (!RECRUIT.test(text)) continue
    if (EXCLUDE.test(text)) continue
    items.push({ text: text.slice(0, 50), url: abs })
  }
  console.log(`✓ ${col} [${res.status} ${(res.buf.length / 1024) | 0}KB] 合格公告 ${items.length} 条`)
  for (const it of items.slice(0, 8)) console.log(`    - ${it.text}`)
  console.log('')
}
