/**
 * 薄弱省份定向补充采集（甘肃 / 宁夏 / 河北）
 *
 * 背景：这几省的公告只挂在省级层面，其余城市页全空，导致页面观感差。
 * 探测确认甘肃组工网、宁夏党建网+人事考试中心、石家庄人社局列表页可达且为静态 HTML。
 *
 * 做法：
 *  1. 抓取列表页，提取公告链接（标题含招录语义）
 *  2. 逐条访问公告详情页，提取发布日期与附件
 *  3. 下载附件并校验为真实文档（文件头）
 *  4. 按现有约定把省级公告挂在省会城市节点
 *  5. 与现有数据按 URL 去重合并，绝不覆盖既有记录
 *
 * 安全：同域名串行 + 间隔；断点续传；DRY-RUN 预览。
 * 用法：node scripts/harvest-weak.mjs [--prov=620000] [--apply]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fetchPage, extractAttachmentLinks, extractPublishDate, sliceContainer, looksLikeDocument, sanitize, filenameFromUrl } from './lib/fetcher.mjs'
import { normalizeFilename } from './lib/naming.mjs'
import { loadDone, createAppender } from './lib/state.mjs'

const DATA_DIR = path.resolve('public/data')
const ATT_DIR = path.resolve('public/attachments')
const APPLY = process.argv.includes('--apply')
const PROV_FILTER = (process.argv.find((a) => a.startsWith('--prov=')) || '').slice(7)
const HOST_DELAY = 700
const MAX_FILE_MB = 15
const BUDGET_MB = 120 // 本轮补充预算，避免总体积失控

/**
 * 各省采集配置。
 * cityAdcode: 省级公告挂载的省会城市（沿用现有数据约定：青海→西宁、宁夏→银川、陕西→西安、新疆→乌鲁木齐）。
 * listPages: 已探测确认可达的列表页。可为字符串（挂到 cityAdcode），
 *            或 { url, cityAdcode, source } 对象（挂到指定城市，用于河北多市级站点）。
 */
const CONFIG = [
  {
    provFile: '620000.json',
    cityAdcode: 620100, // 兰州市
    // tzgg.htm 已实测含 106 条合格招录公告（首页混杂新闻稿，栏目页干净）
    listPages: ['http://www.gszg.gov.cn/tzgg.htm'],
    defaultCat: '选调生',
    defaultSource: '甘肃组工网（中共甘肃省委组织部）',
  },
  {
    provFile: '640000.json',
    cityAdcode: 640100, // 银川市
    listPages: ['https://www.nxpta.com/', 'https://www.nxdjw.gov.cn/nxdjgsgg/'],
    defaultCat: '事业单位',
    defaultSource: '宁夏人事考试中心 / 宁夏党建网',
  },
  {
    // 河北省考试网 hebpta.com.cn 为 Vue SPA，静态抓取只能得到空壳，已排除。
    // 以下市级站点经实测为传统静态站，含真实招聘公告，按站点挂载到对应城市。
    provFile: '130000.json',
    cityAdcode: 130100, // 石家庄市（默认）
    listPages: [
      { url: 'http://www.tsrsks.com.cn/', cityAdcode: 130200, source: '唐山市人事考试网' },
      { url: 'https://rsj.qhd.gov.cn/ksbm/', cityAdcode: 130300, source: '秦皇岛市人事考试网' },
      { url: 'http://rsj.hengshui.gov.cn/', cityAdcode: 131100, source: '衡水市人力资源和社会保障局' },
      { url: 'http://rsj.sjz.gov.cn/columns/fa354001-476c-4fb3-9469-f5f4e6321878/', cityAdcode: 130100, source: '石家庄市人力资源和社会保障局' },
    ],
    defaultCat: '事业单位',
    defaultSource: '河北省市级人社部门',
  },
  {
    provFile: '650000.json',
    cityAdcode: 650100, // 乌鲁木齐市（省级公告挂载点，沿用现有约定）
    // 新疆人社厅首页实测含 20 条真实人才引进/事业单位公告（静态可解析）
    listPages: [{ url: 'http://rst.xinjiang.gov.cn/', cityAdcode: 650100, source: '新疆维吾尔自治区人力资源和社会保障厅' }],
    defaultCat: '人才引进',
    defaultSource: '新疆维吾尔自治区人力资源和社会保障厅',
  },
]

/**
 * 公告标题三段过滤（实测收敛效果：甘肃人才工作栏目新闻稿 100% 被排除）
 *  1. MUST     —— 必须含正式公文文种词，新闻报道标题不含这些词
 *  2. RECRUIT  —— 必须含招录语义
 *  3. EXCLUDE  —— 排除表彰、社保、职称、任免、党建新闻等无关内容
 */
const MUST_HINT = /公告|简章|公示|名单|岗位表|职位表|计划表|考试大纲|报考指南|招聘计划|招募公告/
const RECRUIT_HINT = /考试录用公务员|招录公务员|选调生|选聘|事业单位公开招聘|事业单位.{0,10}招聘|人才引进|引进.{0,8}人才|拟录用|拟聘用|招聘岗位|职位表|招考简章|招聘简章|三支一扶|遴选|引才/
const EXCLUDE_HINT = /表彰|优秀共产党员|党务工作者|七一勋章|养老保险|社会保险|职称评审|技能等级|工伤|病残津贴|社保卡|养老金|转载|网站|系统维护|任免|任前公示|干部任前|靶向施策|多措并举|提升.{0,10}质效|全链条|焕新生|激发|动能|培养管理|工作动态/

/** 列表页链接初筛：只需有公告语义，精细过滤交给三段规则 */
const TITLE_HINT = /公告|简章|通知|招录|招聘|选调|遴选|拟录用|拟聘|公示|岗位|计划/

/**
 * 清洗标题：列表页标题常把发布日期直接拼在末尾（如「…公告2026-09-18」），
 * 也可能带项目符号前缀（如「· 石家庄市…」）。
 * 剥离后返回 [干净标题, 标题尾部日期或 null]。
 */
function cleanTitle(raw) {
  let t = (raw || '').replace(/\s+/g, ' ').trim()
  let tail = null
  // 末尾日期：2026-09-18 / 2026.09.18 / 2026/09/18 / 2026年09月18日
  const m = /(?:^|\s)(20\d{2})[-/.年]\s?(\d{1,2})[-/.月]\s?(\d{1,2})\s*日?\s*$/.exec(t)
  if (m) {
    tail = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
    t = t.slice(0, m.index).trim()
  }
  // 去掉首尾残留的分隔符与项目符号
  t = t.replace(/^[\s·•‧・|—\-–—*>]+/, '').replace(/[\s·•|—\-–]+$/, '').trim()
  return [t || raw, tail]
}

/**
 * 每省类别配额：优先保留正式招录公告，限制过程性「录用公示」数量。
 * 甘肃 tzgg.htm 单栏目即有 106 条，其中大量是分批拟录用名单，
 * 全部挂在省会节点会让该城市页严重失衡。
 */
const CAT_QUOTA = {
  公务员: 14,
  选调生: 14,
  事业单位: 14,
  人才引进: 12,
  录用公示: 8,
}
/** 每省总上限 */
const PROV_TOTAL_CAP = 48

/**
 * 按类别配额与总数上限筛选公告，并对同类按年份倒序（优先近年）。
 */
function selectByQuota(items) {
  const used = new Map()
  const out = []
  // 先按类别分组并按年份倒序，保证配额内取到的是最新公告
  const sorted = [...items].sort((a, b) => (b.yearHint || 0) - (a.yearHint || 0))
  for (const it of sorted) {
    if (out.length >= PROV_TOTAL_CAP) break
    const cat = it.category || '其他'
    const cap = CAT_QUOTA[cat] ?? 6
    const n = used.get(cat) || 0
    if (n >= cap) continue
    used.set(cat, n + 1)
    out.push(it)
  }
  return out
}

/**
 * 按标题判定公告类别。
 * 注意判断顺序：「公开遴选和公开选调公务员」面向在职公务员，属公务员类，
 * 必须先判遴选，否则会被「选调」误归为选调生。
 */
function classify(title) {
  if (/遴选/.test(title)) return '公务员'
  if (/选调/.test(title)) return '选调生'
  if (/人才引进|引进.{0,8}人才|急需紧缺|高层次|引才/.test(title)) return '人才引进'
  if (/拟录用|拟聘用|公示|录用名单|体检人员名单|成绩/.test(title)) return '录用公示'
  if (/事业单位/.test(title)) return '事业单位'
  if (/公务员|考试录用|招录/.test(title)) return '公务员'
  if (/三支一扶/.test(title)) return '事业单位'
  return null
}

/** 三段过滤：判定列表项是否为合格的招录类公告 */
function isQualifiedAnnouncement(title) {
  if (!TITLE_HINT.test(title)) return false
  if (!MUST_HINT.test(title)) return false
  if (!RECRUIT_HINT.test(title)) return false
  if (EXCLUDE_HINT.test(title)) return false
  return true
}

/** 从标题推断年份（优先标题内年份，否则用发布日期） */
function yearOf(title, date) {
  const m = /(20\d{2})\s*年?/.exec(title)
  if (m) return parseInt(m[1], 10)
  if (date && /^\d{4}/.test(date)) return parseInt(date.slice(0, 4), 10)
  return new Date().getFullYear()
}

// ---------------------------------------------------------------------------
// 限速
// ---------------------------------------------------------------------------
const hostLast = new Map()
async function throttle(url) {
  let h = 'x'
  try { h = new URL(url).hostname } catch {}
  const now = Date.now()
  const wait = Math.max(0, (hostLast.get(h) || 0) + HOST_DELAY - now)
  hostLast.set(h, now + wait + 10)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

// ---------------------------------------------------------------------------
// 1) 从列表页提取公告链接
//    返回 [{ title(已清洗), url, tailDate(列表页标题尾部日期，可为 null) }]
// ---------------------------------------------------------------------------
function extractAnnouncements(html, baseUrl) {
  const out = []
  const seen = new Set()
  const strip = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = strip(m[2])
    if (!text || text.length < 8) continue
    // 三段过滤：文种词 + 招录语义 + 排除项，实测可 100% 排除党建新闻稿
    if (!isQualifiedAnnouncement(text)) continue

    const hm = /href\s*=\s*["']([^"']+)["']/i.exec(m[1])
    if (!hm) continue
    let abs
    try { abs = new URL(hm[1].trim(), baseUrl).toString() } catch { continue }
    if (!/^https?:/i.test(abs)) continue
    if (/javascript:|^#$/.test(abs)) continue
    if (seen.has(abs)) continue
    seen.add(abs)

    const [title, tailDate] = cleanTitle(text)
    out.push({ title, url: abs, tailDate })
  }
  return out
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
const donePages = loadDone('weak-pages-done.txt')
const pageAppender = APPLY ? createAppender('weak-pages-done.txt') : { push() {}, flush() {} }

let usedBytes = 0
const stat = { listOk: 0, listFail: 0, found: 0, newAnn: 0, dup: 0, pageOk: 0, pageFail: 0, attOk: 0, attFail: 0, dateFound: 0, errors: {} }

for (const cfg of CONFIG) {
  if (PROV_FILTER && cfg.provFile !== `${PROV_FILTER}.json`) continue

  const fp = path.join(DATA_DIR, cfg.provFile)
  if (!fs.existsSync(fp)) { console.log(`跳过 ${cfg.provFile}（不存在）`); continue }
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'))

  /**
   * 按 adcode 取城市节点。
   * 注意：部分省数据里 adcode 是字符串（如河北），已由 fix-types 归一，
   * 这里仍用 Number() 比较保持宽容，避免同类问题再次导致静默跳过。
   */
  const resolveCity = (adcode) => (d.cities || []).find((c) => Number(c.adcode) === Number(adcode)) || null

  const defaultCity = resolveCity(cfg.cityAdcode)
  if (!defaultCity) {
    console.log(`⚠️ ${d.name} 未找到默认挂载城市 ${cfg.cityAdcode}，跳过`)
    continue
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`${d.name} · 默认挂载「${defaultCity.name}」(${defaultCity.adcode})`)

  // 现有 URL 集合，用于去重
  const knownUrls = new Set()
  for (const c of d.cities || []) for (const r of c.recruitments || []) if (r.url) knownUrls.add(r.url)

  // 收集列表页公告。每个列表页可自带挂载城市与来源。
  const candidates = []
  const seenUrl = new Set()
  for (const rawLp of cfg.listPages) {
    const lp = typeof rawLp === 'string' ? { url: rawLp } : rawLp
    const city = lp.cityAdcode ? resolveCity(lp.cityAdcode) : defaultCity
    if (!city) {
      console.log(`  ⚠️ 列表页指定的城市节点不存在(${lp.cityAdcode})，跳过 ${lp.url.slice(0, 50)}`)
      stat.listFail++
      continue
    }
    const source = lp.source || cfg.defaultSource

    await throttle(lp.url)
    const res = await fetchPage(lp.url, { timeout: 25000 })
    if (!res.ok) {
      stat.listFail++
      stat.errors[`list:${res.error}`] = (stat.errors[`list:${res.error}`] || 0) + 1
      console.log(`  ✗ 列表页不可达 ${res.error}  ${lp.url.slice(0, 56)}`)
      continue
    }
    stat.listOk++
    const items = extractAnnouncements(res.text, res.finalUrl)
    console.log(
      `  ✓ ${city.name} ← ${lp.url.replace(/^https?:\/\//, '').slice(0, 40)} → 合格公告 ${items.length} 条`,
    )
    for (const it of items) {
      if (seenUrl.has(it.url)) continue
      seenUrl.add(it.url)
      // 每条候选记住自己的目标城市与来源，附件目录与写入节点都据此确定
      candidates.push({ ...it, cityAdcode: city.adcode, cityName: city.name, source })
    }
  }

  stat.found += candidates.length
  const fresh = candidates.filter((c) => !knownUrls.has(c.url))
  const dupCount = candidates.length - fresh.length
  stat.dup += dupCount

  // 预计算类别与年份提示，用于配额选取（列表页标题即含年份，无需抓详情页）
  const annotated = fresh.map((c) => ({
    ...c,
    category: classify(c.title) || cfg.defaultCat,
    yearHint: yearOf(c.title, c.tailDate),
  }))
  const selected = selectByQuota(annotated)

  const quotaDist = new Map()
  for (const s of selected) quotaDist.set(s.category, (quotaDist.get(s.category) || 0) + 1)
  const cityDist = new Map()
  for (const s of selected) cityDist.set(s.cityName, (cityDist.get(s.cityName) || 0) + 1)
  console.log(
    `  发现 ${candidates.length} 条 · 已收录 ${dupCount} · 新增候选 ${fresh.length} → 配额选取 ${selected.length} 条`,
  )
  console.log(`  类别分布: ${JSON.stringify(Object.fromEntries(quotaDist))}`)
  console.log(`  城市分布: ${JSON.stringify(Object.fromEntries(cityDist))}`)
  if (!APPLY) {
    for (const c of selected.slice(0, 10)) {
      console.log(`      [${c.cityName} · ${c.category} ${c.yearHint}] ${c.title.slice(0, 34)}`)
    }
    continue
  }

  // 逐条抓取详情页
  let provNewAnn = 0
  let provAtt = 0
  let provBytes = 0
  for (const cand of selected) {
    if (usedBytes / 1024 / 1024 > BUDGET_MB) { stat.errors['budget-exceeded'] = 1; break }
    if (donePages.has(cand.url)) continue

    // 目标城市节点（配额选取阶段已确定，这里重新解析以拿到可变对象）
    const targetCity = resolveCity(cand.cityAdcode)
    if (!targetCity) {
      stat.errors['city-missing'] = (stat.errors['city-missing'] || 0) + 1
      continue
    }
    targetCity.recruitments = targetCity.recruitments || []

    await throttle(cand.url)
    const res = await fetchPage(cand.url, { timeout: 25000 })
    if (!res.ok) {
      stat.pageFail++
      stat.errors[`page:${res.error}`] = (stat.errors[`page:${res.error}`] || 0) + 1
      pageAppender.push(cand.url)
      continue
    }
    stat.pageOk++

    // 发布日期：详情页解析优先；失败时回退到列表页标题尾部日期（同为官方页面信息）
    const date = extractPublishDate(res.text) || cand.tailDate || null
    if (date) stat.dateFound++
    // 复用候选阶段已算好的类别，保证与配额统计一致
    const cat = cand.category || classify(cand.title) || cfg.defaultCat
    const year = yearOf(cand.title, date)

    // 提取附件（正文容器优先）
    const cont = sliceContainer(res.text)
    const links = extractAttachmentLinks(cont ? cont.html : res.text, res.finalUrl)

    const attachments = []
    for (const l of links) {
      await throttle(l.url)
      const dl = await fetchPage(l.url, { timeout: 30000 })
      if (!dl.ok || !dl.buf) { stat.attFail++; continue }
      if (dl.buf.length > MAX_FILE_MB * 1024 * 1024) { stat.attFail++; stat.errors['too-large'] = (stat.errors['too-large'] || 0) + 1; continue }
      if (!looksLikeDocument(dl.buf, l.url)) { stat.attFail++; stat.errors['not-a-document'] = (stat.errors['not-a-document'] || 0) + 1; continue }
      if ((usedBytes + dl.buf.length) / 1024 / 1024 > BUDGET_MB) { stat.errors['budget-exceeded'] = 1; break }

      const rawName = sanitize(l.text) || sanitize(filenameFromUrl(l.url)) || 'attachment'
      // let：同名冲突时会改为带序号的文件名
      let name = normalizeFilename(rawName, { fallbackYear: year })
      const dir = path.join(ATT_DIR, String(targetCity.adcode))
      fs.mkdirSync(dir, { recursive: true })
      let target = path.join(dir, name)
      if (fs.existsSync(target)) {
        const cur = fs.readFileSync(target)
        if (cur.length === dl.buf.length && cur.equals(dl.buf)) {
          attachments.push({ name, url: l.url, local: `attachments/${targetCity.adcode}/${name}` })
          stat.attOk++
          provAtt++
          continue
        }
        const stem = name.replace(/\.[^.]+$/, '')
        const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
        let i = 2
        while (fs.existsSync(target) && i < 30) { target = path.join(dir, `${stem}_${i}${ext}`); i++ }
        if (fs.existsSync(target)) { stat.attFail++; continue }
        name = path.basename(target)
      }
      fs.writeFileSync(target, dl.buf)
      usedBytes += dl.buf.length
      provBytes += dl.buf.length
      attachments.push({ name: path.basename(target), url: l.url, local: `attachments/${targetCity.adcode}/${path.basename(target)}` })
      stat.attOk++
      provAtt++
    }

    targetCity.recruitments.push({
      year,
      category: cat,
      subCategory: cat === '选调生' ? (/定向/.test(cand.title) ? '定向选调' : '普通选调') : null,
      title: cand.title,
      date: date || null,
      headcount: null,
      positions: null,
      source: cand.source || cfg.defaultSource,
      url: cand.url,
      attachments,
    })
    stat.newAnn++
    provNewAnn++
    pageAppender.push(cand.url)
  }

  // 修复既有记录的 year 字段缺失（河北样本发现 year: undefined）
  let yearFixed = 0
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      if (typeof r.year !== 'number' || !r.year) {
        const y = yearOf(r.title || '', r.date || null)
        if (y) { r.year = y; yearFixed++ }
      }
    }
  }
  if (yearFixed) console.log(`  修复 year 字段缺失 ${yearFixed} 条`)

  d.updatedAt = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8')
  console.log(
    `  ✅ 写入 ${d.name}：新增公告 ${provNewAnn} 条，附件 ${provAtt} 个，${(provBytes / 1024 / 1024).toFixed(1)}MB` +
      (yearFixed ? `，修复 year ${yearFixed} 条` : ''),
  )
}

pageAppender.flush?.()

console.log(`\n${'='.repeat(70)}`)
console.log(`=== 补充采集完成（${APPLY ? 'APPLY' : 'DRY-RUN'}）===`)
console.log(`  列表页 成功 ${stat.listOk} · 失败 ${stat.listFail}`)
console.log(`  发现公告 ${stat.found} 条 · 已收录去重 ${stat.dup} · 新增写入 ${stat.newAnn}`)
if (APPLY) {
  console.log(`  详情页 成功 ${stat.pageOk} · 失败 ${stat.pageFail} · 提取日期 ${stat.dateFound}`)
  console.log(`  附件 下载 ${stat.attOk} · 失败 ${stat.attFail} · 体积 ${(usedBytes / 1024 / 1024).toFixed(1)}MB / 预算 ${BUDGET_MB}MB`)
}
console.log('  错误分布:')
for (const [k, v] of Object.entries(stat.errors).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${String(v).padStart(3)}  ${k}`)
