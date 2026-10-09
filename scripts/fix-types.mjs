/**
 * 数据类型修复（只修类型与缺失的派生字段，不改业务内容）
 *
 * 修复两类真实缺陷：
 *  1. adcode 为字符串（河北省级+11市、黑龙江13市）
 *     前端 CityPage 用 `c.adcode === cityAdcode`（数字）严格比较定位城市，
 *     字符串会导致这些城市页全部落到「未找到该城市」404。
 *  2. recruitment.year 字段缺失（河北58、黑龙江55、广东99，共212条）
 *     附件区按 year 分组会出现空白年份组；年度趋势图按 year 过滤会漏掉这些公告。
 *
 * year 的取值规则（与北京等正常省份既有数据约定一致）：
 *   优先取标题中的「YYYY年度/YYYY年」——它表示招录年度，而非发布年度
 *   （例：「黑龙江省2026年度定向选调公告」发布于 2025-09，year 应为 2026）；
 *   标题无年份时回退到 date 的年份。两者皆无则不填，绝不猜测。
 *
 * 安全：先 dry-run 输出变更清单，确认后 --apply。仅改类型/补派生字段，
 *       不删除、不重排、不改写任何标题、URL、附件、人数等业务数据。
 *
 * 用法：node scripts/fix-types.mjs [--apply]
 */
import fs from 'node:fs'
import path from 'node:path'

const B = path.resolve('public/data')
const APPLY = process.argv.includes('--apply')
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 合理年度范围，超出视为非年份数字（如电话、编号） */
const PLAUSIBLE = (y) => y >= 2015 && y <= 2030

/**
 * 从标题推断招录年度。优先「YYYY年度」，其次「YYYY年」。
 * 返回 null 表示标题中不含可靠年份。
 */
function yearFromTitle(title) {
  if (!title) return null
  // 「2026年度」「2026 年度」优先
  const m1 = /((?:19|20)\d{2})\s*年度/.exec(title)
  if (m1) {
    const y = parseInt(m1[1], 10)
    if (PLAUSIBLE(y)) return y
  }
  // 退而取标题中第一个「YYYY年」
  const m2 = /((?:19|20)\d{2})\s*年/.exec(title)
  if (m2) {
    const y = parseInt(m2[1], 10)
    if (PLAUSIBLE(y)) return y
  }
  return null
}

/** 从 YYYY-MM-DD 日期取年份 */
function yearFromDate(date) {
  if (!date || !DATE_RE.test(date)) return null
  const y = parseInt(date.slice(0, 4), 10)
  return PLAUSIBLE(y) ? y : null
}

let adcodeFixed = 0
let yearFixed = 0
let yearUnresolved = 0
const unresolvedSamples = []
const filesChanged = []

for (const f of fs.readdirSync(B).filter((x) => /^\d+\.json$/.test(x))) {
  const fp = path.join(B, f)
  const raw = fs.readFileSync(fp, 'utf8')
  const d = JSON.parse(raw)
  let changed = false
  const prov = d.name || f

  // --- 1) adcode 类型归一 ---
  if (typeof d.adcode === 'string' && /^\d+$/.test(d.adcode)) {
    d.adcode = Number(d.adcode)
    adcodeFixed++
    changed = true
  }
  for (const c of d.cities || []) {
    if (typeof c.adcode === 'string' && /^\d+$/.test(c.adcode)) {
      c.adcode = Number(c.adcode)
      adcodeFixed++
      changed = true
    }
  }

  // --- 2) year 补齐 ---
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      if (typeof r.year === 'number' && PLAUSIBLE(r.year)) continue
      const fromTitle = yearFromTitle(r.title)
      const y = fromTitle ?? yearFromDate(r.date)
      if (y) {
        r.year = y
        yearFixed++
        changed = true
      } else {
        yearUnresolved++
        if (unresolvedSamples.length < 8) unresolvedSamples.push(`${prov}/${c.name} ${r.title?.slice(0, 34)}`)
      }
    }
  }

  if (changed) {
    filesChanged.push(prov)
    if (APPLY) fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8')
  }
}

console.log(`=== 数据类型修复（${APPLY ? 'APPLY' : 'DRY-RUN'}）===`)
console.log(`  adcode 字符串→数字 : ${adcodeFixed} 个`)
console.log(`  year 补齐          : ${yearFixed} 条`)
console.log(`  year 无法推断      : ${yearUnresolved} 条（标题与日期均无年份，保持不填）`)
if (unresolvedSamples.length) {
  console.log('  无法推断样本:')
  for (const s of unresolvedSamples) console.log(`    ${s}`)
}
console.log(`\n  涉及文件 ${filesChanged.length} 个: ${filesChanged.join('、')}`)
if (!APPLY) console.log('\n(dry-run，未写入。加 --apply 执行)')
