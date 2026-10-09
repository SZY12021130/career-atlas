/**
 * 陕西/青海/新疆 深度探测（只读）
 *
 * 这三省公告极少（2/3/3 条），此前探测其主站多为 SPA 空壳或超时/403。
 * 但它们现有公告 URL 来自这些域名，说明存在可达入口。
 * 本脚本：
 *  1. 复用现有公告 URL 反推可达的栏目路径
 *  2. 探测多个候选官方域名（组工网/人社厅/人事考试网/政府门户）
 *  3. 判断每个入口是否静态可解析、是否含公告列表
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage } from './lib/fetcher.mjs'

const DATA_DIR = path.resolve('public/data')
const TARGETS = [
  { provFile: '610000.json', name: '陕西省' },
  { provFile: '630000.json', name: '青海省' },
  { provFile: '650000.json', name: '新疆维吾尔自治区' },
]

/** 额外候选入口（常见政务域名，逐个试探） */
const EXTRA = {
  '陕西省': [
    'http://www.sx-dj.gov.cn/',
    'https://www.sx-dj.gov.cn/ywsd/szxw/',
    'http://www.shaanxi.gov.cn/xwzx/sxyw/',
    'https://rst.shaanxi.gov.cn/',
    'http://www.sxrsks.cn/website/index',
  ],
  '青海省': [
    'https://www.qhsdj.gov.cn/cmsx/p894/tzgg/',
    'https://www.qhsdj.gov.cn/',
    'http://www.qhpta.com/',
    'https://rst.qinghai.gov.cn/',
    'http://www.qinghai.gov.cn/zwgk/system/2020/',
  ],
  '新疆维吾尔自治区': [
    'http://www.xjkunlun.cn/',
    'https://www.xjrsks.com.cn/',
    'http://rst.xinjiang.gov.cn/',
    'https://www.xinjiang.gov.cn/xinjiang/zfxxgk/common_list.shtml',
    'http://www.xjdj.gov.cn/',
  ],
}

/** 合格公告判定（复用主采集的三段规则简化版） */
const MUST = /公告|简章|公示|名单|岗位表|职位表|计划表|考试大纲|报考指南|招募公告/
const RECRUIT = /考试录用公务员|招录公务员|选调生|选聘|事业单位公开招聘|事业单位.{0,10}招聘|人才引进|引进.{0,8}人才|拟录用|拟聘用|招聘岗位|职位表|招考简章|招聘简章|三支一扶|遴选|引才/
const EXCLUDE = /表彰|优秀共产党员|党务工作者|养老保险|社会保险|职称评审|技能等级|工伤|社保卡|养老金|转载|网站|系统维护|任免|任前公示|干部任前|靶向施策|多措并举|全链条|激发|动能|培养管理|工作动态/

function countAnnouncements(html) {
  const items = []
  const strip = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = strip(m[2])
    if (!text || text.length < 8) continue
    if (!MUST.test(text) || !RECRUIT.test(text) || EXCLUDE.test(text)) continue
    items.push(text.slice(0, 44))
  }
  return items
}

for (const t of TARGETS) {
  console.log(`\n${'='.repeat(70)}`)
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, t.provFile), 'utf8'))
  console.log(`${t.name} (${t.provFile}) · 现有公告 ${(d.cities || []).reduce((s, c) => s + (c.recruitments || []).length, 0)} 条`)

  // 1) 现有公告 URL 的栏目路径（反推可达入口）
  const existingPaths = new Set()
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      try {
        const u = new URL(r.url)
        // 取目录部分作为候选栏目页
        const dir = u.pathname.split('/').slice(0, -1).join('/') + '/'
        existingPaths.add(`${u.origin}${dir}`)
        existingPaths.add(u.origin + '/')
      } catch {}
    }
  }

  const candidates = [...new Set([...existingPaths, ...(EXTRA[t.name] || [])])]
  console.log(`候选入口 ${candidates.length} 个：`)

  for (const url of candidates.slice(0, 10)) {
    const res = await fetchPage(url, { timeout: 18000 })
    if (!res.ok) {
      console.log(`  ✗ ${String(res.error).slice(0, 22).padEnd(23)} ${url.replace(/^https?:\/\//, '').slice(0, 46)}`)
      continue
    }
    const isSpa = res.buf.length < 4000 && /<div\s+id\s*=\s*["']?(app|root|febs)/i.test(res.text)
    const anns = countAnnouncements(res.text)
    const flag = isSpa ? '⚠SPA' : anns.length ? '✅' : '  '
    console.log(`  ${flag} ${(res.buf.length / 1024) | 0}KB 公告${String(anns.length).padStart(3)}  ${url.replace(/^https?:\/\//, '').slice(0, 46)}`)
    for (const a of anns.slice(0, 2)) console.log(`        - ${a}`)
  }
}
