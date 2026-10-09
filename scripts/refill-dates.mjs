/**
 * 日期污染复查与回滚（一次性）
 *
 * 背景：discover 阶段用旧版 extractPublishDate 填补了空白日期，其中浙江
 * zjks.gov.cn 等站点的页头「今天是…星期X」系统时间被误当发布日，导致
 * 8 条记录 date === 采集当天(2026-10-02)。现已加固提取逻辑，需复查回滚。
 *
 * 方法：
 *  1. 对比 git HEAD 原始版本，精确找出「原始 date 为空/无效、当前有值」的记录
 *     （即本次采集填补的日期），这是唯一可能被污染的集合
 *  2. 对每条重新抓取公告页，用修复后的 extractPublishDate 重新提取
 *  3. 新值与当前值不同 → 更新为新值；新值为 null → 清空（回滚到采集前状态）
 *     绝不保留等于采集当天的可疑值
 *
 * 用法：node scripts/refill-dates.mjs [--apply]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fetchPage, extractPublishDate } from './lib/fetcher.mjs'

const DATA_DIR = path.resolve('public/data')
const APPLY = process.argv.includes('--apply')
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const TODAY = todayStr()

// ---------------------------------------------------------------------------
// 1) 对比 git 原始版本，找出本次填补的日期记录
// ---------------------------------------------------------------------------
const suspects = [] // {provFile, cityAdcode, recUrl, recTitle, curDate, origDate}
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const fp = path.join(DATA_DIR, f)
  const cur = JSON.parse(fs.readFileSync(fp, 'utf8'))

  let orig = null
  try {
    orig = JSON.parse(execSync(`git show HEAD:public/data/${f}`, { cwd: path.resolve('.'), encoding: 'utf8', maxBuffer: 1024 * 1024 * 60 }))
  } catch {
    // 新文件或 git 无此版本：视全部当前日期为可疑（保守）
  }

  // 原始 date 映射：url+title -> date
  const origMap = new Map()
  if (orig) {
    for (const c of orig.cities || []) {
      for (const r of c.recruitments || []) {
        origMap.set(`${c.adcode}|${r.url}|${r.title}`, r.date)
      }
    }
  }

  for (const c of cur.cities || []) {
    for (const r of c.recruitments || []) {
      if (!r.date || !DATE_RE.test(r.date)) continue
      const key = `${c.adcode}|${r.url}|${r.title}`
      const od = origMap.has(key) ? origMap.get(key) : null
      const origValid = od && DATE_RE.test(od)
      // 本次填补 = 原始无效/为空 且 当前有值
      if (!origValid) {
        suspects.push({ provFile: f, prov: cur.name, cityAdcode: c.adcode, city: c.name, recUrl: r.url, recTitle: r.title, curDate: r.date, origDate: od || null })
      }
    }
  }
}

console.log(`=== 本次采集填补的日期记录: ${suspects.length} 条 ===`)
const eqToday = suspects.filter((s) => s.curDate === TODAY)
console.log(`  其中 date === 今天(${TODAY}): ${eqToday.length} 条（高度可疑）`)
console.log('')

// ---------------------------------------------------------------------------
// 2) 逐条重新抓取核对
// ---------------------------------------------------------------------------
const hostLast = new Map()
async function throttle(url) {
  let h = 'x'
  try { h = new URL(url).hostname } catch {}
  const now = Date.now()
  const wait = Math.max(0, (hostLast.get(h) || 0) + 500 - now)
  hostLast.set(h, now + wait + 10)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

// 结果：provFile -> Map(recUrl|recTitle -> newDate|null)
const fixes = new Map()
let statFixed = 0, statCleared = 0, statSame = 0, statFail = 0

for (const s of suspects) {
  await throttle(s.recUrl)
  const res = await fetchPage(s.recUrl, { timeout: 25000 })
  if (!res.ok) {
    // 页面已不可达：若当前值等于今天（可疑），清空；否则保留原填补值
    if (s.curDate === TODAY) {
      statCleared++
      pushFix(s, null)
      console.log(`  清空(页不可达+当天) ${s.prov}/${s.city} ${s.recTitle.slice(0, 20)}`)
    } else {
      statFail++
    }
    continue
  }
  const nd = extractPublishDate(res.text)
  if (nd === s.curDate) {
    statSame++
  } else if (nd && DATE_RE.test(nd) && nd !== TODAY) {
    statFixed++
    pushFix(s, nd)
    console.log(`  修正 ${s.curDate} → ${nd}  ${s.prov}/${s.city} ${s.recTitle.slice(0, 18)}`)
  } else {
    // 新提取为空或等于今天 → 回滚到原始值（多为空）
    statCleared++
    pushFix(s, s.origDate && DATE_RE.test(s.origDate) ? s.origDate : null)
    console.log(`  回滚 ${s.curDate} → ${s.origDate || '(空)'}  ${s.prov}/${s.city} ${s.recTitle.slice(0, 18)}`)
  }
}

function pushFix(s, newDate) {
  if (!fixes.has(s.provFile)) fixes.set(s.provFile, new Map())
  fixes.get(s.provFile).set(`${s.cityAdcode}|${s.recUrl}|${s.recTitle}`, newDate)
}

console.log(`\n=== 复查结果 ===`)
console.log(`  保持不变 ${statSame} · 修正 ${statFixed} · 回滚/清空 ${statCleared} · 页面不可达且保留 ${statFail}`)

// ---------------------------------------------------------------------------
// 3) 回写
// ---------------------------------------------------------------------------
if (!APPLY) {
  console.log('\n(dry-run，未写数据。加 --apply 执行)')
  process.exit(0)
}

let written = 0
for (const [provFile, m] of fixes) {
  const fp = path.join(DATA_DIR, provFile)
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      const key = `${c.adcode}|${r.url}|${r.title}`
      if (m.has(key)) {
        const nd = m.get(key)
        if (nd) r.date = nd
        else delete r.date
        written++
      }
    }
  }
  fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8')
}
console.log(`\n数据回写：${written} 条日期已更新`)
