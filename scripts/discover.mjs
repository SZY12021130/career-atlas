/**
 * 阶段一：公告页爬取与附件链接发现（只发现，不下载）
 *
 * 产出 scripts/.state/manifest.json —— 全量附件候选清单，供阶段二按价值与预算择优下载。
 * 断点续传：已爬取的页面记录在 pages-crawled.txt，重跑自动跳过。
 *
 * 用法：node scripts/discover.mjs [--provinces=110000,440000] [--limit=N] [--concurrency=6]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage, extractBodyAttachments, extractPublishDate } from './lib/fetcher.mjs'
import { loadDone, createAppender, loadJSON, saveJSON } from './lib/state.mjs'

const args = process.argv.slice(2)
const getArg = (n, d) => {
  const h = args.find((a) => a.startsWith(`--${n}=`))
  return h ? h.slice(n.length + 3) : d
}
const PROV_FILTER = getArg('provinces', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const LIMIT = parseInt(getArg('limit', '0'), 10)
const CONCURRENCY = parseInt(getArg('concurrency', '6'), 10)
const HOST_DELAY_MS = parseInt(getArg('host-delay', '600'), 10)

const DATA_DIR = path.resolve('public/data')
const MANIFEST = 'manifest.json'

// ---------------------------------------------------------------------------
// 任务队列
// ---------------------------------------------------------------------------
function buildTasks() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => /^\d+\.json$/.test(f))
    .filter((f) => (PROV_FILTER.length ? PROV_FILTER.includes(f.replace('.json', '')) : true))

  const tasks = []
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
    for (const c of d.cities || []) {
      for (const r of c.recruitments || []) {
        if (!r.url) continue
        tasks.push({
          provFile: f,
          provName: d.name,
          cityAdcode: c.adcode,
          cityName: c.name,
          title: r.title,
          category: r.category,
          year: r.year,
          url: r.url,
        })
      }
    }
  }
  // 核心四类优先、近年优先
  const CAT = { 公务员: 0, 选调生: 1, 事业单位: 2, 人才引进: 3, 录用公示: 4 }
  tasks.sort((a, b) => (CAT[a.category] ?? 9) - (CAT[b.category] ?? 9) || (b.year || 0) - (a.year || 0))
  return LIMIT > 0 ? tasks.slice(0, LIMIT) : tasks
}

// ---------------------------------------------------------------------------
// 同域名限速
// ---------------------------------------------------------------------------
const hostLast = new Map()
async function throttle(url) {
  let h = 'unknown'
  try {
    h = new URL(url).hostname
  } catch {}
  const now = Date.now()
  const wait = Math.max(0, (hostLast.get(h) || 0) + HOST_DELAY_MS - now)
  hostLast.set(h, now + wait + 10)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

// ---------------------------------------------------------------------------
// 爬取
// ---------------------------------------------------------------------------
const donePages = loadDone('pages-crawled.txt')
const crawled = createAppender('pages-crawled.txt')

/** 累积的清单：{ [provFile]: [ {cityAdcode,title,url,category,year,pageOk,date,links:[{url,text}]} ] } */
let manifest = loadJSON(MANIFEST, {}) || {}

const stat = { ok: 0, fail: 0, skipped: 0, links: 0, withLinks: 0, dateFound: 0, errors: {} }

async function crawl(task) {
  if (donePages.has(task.url)) {
    stat.skipped++
    return
  }
  await throttle(task.url)
  const res = await fetchPage(task.url, { timeout: 25000 })

  if (!manifest[task.provFile]) manifest[task.provFile] = []
  const entry = {
    cityAdcode: task.cityAdcode,
    cityName: task.cityName,
    title: task.title,
    category: task.category,
    year: task.year,
    url: task.url,
    pageOk: res.ok,
    error: res.ok ? null : res.error,
    date: null,
    links: [],
  }

  if (!res.ok) {
    stat.fail++
    stat.errors[res.error] = (stat.errors[res.error] || 0) + 1
  } else {
    stat.ok++
    const { links, containerHit } = extractBodyAttachments(res.text, res.finalUrl)
    entry.containerHit = containerHit
    entry.links = links.map((l) => ({ url: l.url, text: l.text }))
    entry.date = extractPublishDate(res.text)
    if (entry.date) stat.dateFound++
    stat.links += links.length
    if (links.length) stat.withLinks++
  }

  manifest[task.provFile].push(entry)
  crawled.push(task.url)
}

// ---------------------------------------------------------------------------
// 主流程：分片并发 + 定期落盘
// ---------------------------------------------------------------------------
const tasks = buildTasks()
console.log(`阶段一 · 发现：${tasks.length} 条公告待爬取（已完成 ${donePages.size} 条将跳过）`)
console.log(`配置：并发 ${CONCURRENCY} · 同域名间隔 ${HOST_DELAY_MS}ms\n`)

let cursor = 0
let processed = 0
const t0 = Date.now()

async function worker() {
  while (cursor < tasks.length) {
    const i = cursor++
    try {
      await crawl(tasks[i])
    } catch (e) {
      const k = `exception:${e.message}`.slice(0, 50)
      stat.errors[k] = (stat.errors[k] || 0) + 1
    }
    processed++
    if (processed % 40 === 0) {
      saveJSON(MANIFEST, manifest)
      console.log(
        `  ${processed}/${tasks.length}  页面OK ${stat.ok} 失败 ${stat.fail} | 附件链接 ${stat.links} | 有附件公告 ${stat.withLinks} | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
      )
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))

crawled.flush()
saveJSON(MANIFEST, manifest)

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
const allEntries = Object.values(manifest).flat()
const okEntries = allEntries.filter((e) => e.pageOk)
const allLinks = okEntries.flatMap((e) => e.links || [])
const uniqLinks = new Set(allLinks.map((l) => l.url))

console.log('\n=== 阶段一完成 ===')
console.log(`  本次爬取  成功 ${stat.ok} · 失败 ${stat.fail} · 跳过 ${stat.skipped}`)
console.log(`  页面可达率 ${((stat.ok / Math.max(1, stat.ok + stat.fail)) * 100).toFixed(0)}%`)
console.log(`  正文容器命中 ${okEntries.filter((e) => e.containerHit).length}/${okEntries.length}`)
console.log(`  发现发布日期 ${stat.dateFound} 条`)
console.log(`\n=== 清单累计 ===`)
console.log(`  公告条目 ${allEntries.length} · 可达 ${okEntries.length}`)
console.log(`  附件链接 ${allLinks.length} 个 · 去重后 ${uniqLinks.size} 个`)
console.log(`  有附件的公告 ${okEntries.filter((e) => (e.links || []).length).length} 条`)
console.log(`  零附件公告 ${okEntries.filter((e) => !(e.links || []).length).length} 条`)
console.log('\n  失败原因 TOP:')
for (const [k, v] of Object.entries(stat.errors).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`    ${String(v).padStart(4)}  ${k}`)
}
saveJSON('discover-stat.json', { at: new Date().toISOString(), stat, uniqLinks: uniqLinks.size, allLinks: allLinks.length })
console.log(`\n清单已写入 scripts/.state/${MANIFEST}`)
