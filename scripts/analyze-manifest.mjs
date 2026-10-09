/**
 * 分析发现清单，制定下载优先级与体积预算方案（只读，不下载）。
 *
 * 输出：
 *  - 去重新增附件数（排除已在 data JSON 中有 local 的 URL）
 *  - 按类别 / 省份 / 扩展名 / 年份的分布
 *  - 按价值排序后的下载队列预览
 *  - 不同总预算下的覆盖面测算
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadJSON } from './lib/state.mjs'

const DATA_DIR = path.resolve('public/data')
const manifest = loadJSON('manifest.json', {}) || {}

// ---------------------------------------------------------------------------
// 1) 收集所有附件候选链接，并标注其公告元信息
// ---------------------------------------------------------------------------
const ATTACH_EXT_RE = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)(\?|$)/i

/** 已在数据里落地 local 的 URL 集合（避免重复下载） */
const existingLocalUrls = new Set()
const provNameByFile = new Map()
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  provNameByFile.set(f, d.name)
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (a.local && a.url) existingLocalUrls.add(a.url)
      }
    }
  }
}

/** 归并所有公告的附件链接 */
const candidates = new Map() // url -> {url, provFile, prov, city, category, year, title, text, count}
for (const [provFile, entries] of Object.entries(manifest)) {
  const prov = provNameByFile.get(provFile) || provFile
  for (const e of entries || []) {
    if (!e.pageOk) continue
    for (const l of e.links || []) {
      if (!ATTACH_EXT_RE.test(l.url)) continue
      const key = l.url
      if (!candidates.has(key)) {
        candidates.set(key, {
          url: key,
          provFile,
          prov,
          cityAdcode: e.cityAdcode,
          city: e.cityName,
          category: e.category,
          year: e.year || 0,
          title: e.title || '',
          text: l.text || '',
          pageUrl: e.url,
        })
      } else {
        // 同一附件被多个公告引用，记一次即可
        candidates.get(key).count = (candidates.get(key).count || 1) + 1
      }
    }
  }
}

const all = [...candidates.values()]
const fresh = all.filter((c) => !existingLocalUrls.has(c.url))

console.log('=== 附件候选总览 ===')
console.log(`  去重链接总数        ${all.length}`)
console.log(`  已落地(有local)     ${all.length - fresh.length}`)
console.log(`  待新增下载          ${fresh.length}`)
console.log(`  已有 local 记录数   ${existingLocalUrls.size}`)

// ---------------------------------------------------------------------------
// 2) 分布分析
// ---------------------------------------------------------------------------
const byCat = new Map()
const byProv = new Map()
const byExt = new Map()
const byYear = new Map()
for (const c of fresh) {
  byCat.set(c.category, (byCat.get(c.category) || 0) + 1)
  byProv.set(c.prov, (byProv.get(c.prov) || 0) + 1)
  const ext = (ATTACH_EXT_RE.exec(c.url)?.[1] || 'other').toLowerCase()
  byExt.set(ext, (byExt.get(ext) || 0) + 1)
  byYear.set(c.year, (byYear.get(c.year) || 0) + 1)
}
const show = (title, m) => {
  console.log(`\n=== ${title} ===`)
  for (const [k, v] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padEnd(14)} ${v}`)
  }
}
show('按类别（待下载）', byCat)
show('按扩展名（待下载）', byExt)
show('按年份（待下载）', byYear)
console.log('\n=== 按省份（待下载）===')
for (const [k, v] of [...byProv.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(16)} ${String(v).padStart(3)}`)
}

// ---------------------------------------------------------------------------
// 3) 价值评分：核心四类 + 高价值文档类型 + 近年 + 缺口大省份
// ---------------------------------------------------------------------------
const CAT_SCORE = { 公务员: 100, 选调生: 90, 事业单位: 80, 人才引进: 70, 录用公示: 20 }
/** 高价值文档关键词（职位表/简章/岗位表 > 通知/名单） */
const DOC_HINTS = [
  { re: /职位表|岗位表|职位一览|岗位一览|招录计划|招聘计划|需求表|计划表/i, score: 40 },
  { re: /简章|公告|报考指南|考试大纲|实施办法|政策/i, score: 30 },
  { re: /报名表|登记表|推荐表/i, score: 25 },
  { re: /名单|公示|成绩|分数|录用|拟聘/i, score: 5 },
]
function docScore(c) {
  const hay = `${c.text} ${c.title} ${c.url}`
  for (const h of DOC_HINTS) if (h.re.test(hay)) return h.score
  return 10
}
function scoreCandidate(c) {
  let s = CAT_SCORE[c.category] ?? 30
  s += docScore(c)
  s += Math.max(0, (c.year - 2023) * 6) // 近年加权
  return s
}

const scored = fresh.map((c) => ({ ...c, score: scoreCandidate(c) })).sort((a, b) => b.score - a.score)

// ---------------------------------------------------------------------------
// 4) 不同预算下的覆盖面（用勘察均值 0.88MB 估算）
// ---------------------------------------------------------------------------
const AVG_MB = 0.88
console.log(`\n=== 体积测算（按均值 ${AVG_MB}MB/文件估算）===`)
console.log(`  全量 ${fresh.length} 个 ≈ ${(fresh.length * AVG_MB).toFixed(0)} MB`)
for (const budget of [300, 400, 500, 600, 700, 800]) {
  const cap = Math.floor(budget / AVG_MB)
  const take = Math.min(cap, scored.length)
  const cats = new Map()
  for (const c of scored.slice(0, take)) cats.set(c.category, (cats.get(c.category) || 0) + 1)
  const provs = new Set(scored.slice(0, take).map((c) => c.prov))
  console.log(
    `  预算 ${budget}MB → 约 ${take} 个 · 覆盖 ${provs.size} 省 · 分类{${[...cats.entries()].map(([k, v]) => `${k}:${v}`).join(' ')}}`,
  )
}

// 保存打分队列，供下载阶段使用
const outPath = path.resolve('scripts/.state/download-queue.json')
fs.writeFileSync(outPath, JSON.stringify(scored, null, 0), 'utf8')
console.log(`\n下载队列已写入 ${outPath}（${scored.length} 条，按价值降序）`)
