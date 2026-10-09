/**
 * 附件文件名规范化（README 规范：年份+省市+文档名称）
 *
 * 保守策略 —— 只做确定无副作用的清理，不引入可能错误的信息：
 *  1. 剥离序号 / 「附件N：」噪声（可能在开头，也可能在年份前缀之后）
 *  2. 年份前移为「YYYY年」开头
 *  3. 同年去重（消除「2025年山西省2025年事业单位…」这类重复）
 *
 * 明确不做：
 *  - 不新增省 / 市前缀。附件存放于某市目录不等于该市是文档主体，
 *    例如山西省级职位表存放在太原市目录，强行加「太原」属错误归属
 *  - 不改写正文用词、不猜测缺失年份、不动「2023年和2024年」这类合法双年份表述
 */

/** 序号 / 附件前缀噪声 */
const NOISE = [
  /^\s*附件\s*\d*\s*[:：]\s*/,
  /^\s*\d+\s*[-–—]\s*\d+\s*[.、．]\s*/,
  /^\s*\d+\s*[.、．]\s+/,
  /^\s*[（(【[]\s*\d+\s*[）)】\]]\s*[.、．]?\s*/,
  /^\s*[一二三四五六七八九十]+\s*[、.]\s*/,
]

/**
 * 中缀噪声：出现在地区名 / 年份之后的「附件N：」「附件N_」「附件N」。
 * 例如「黑龙江哈尔滨附件2：“助力乡村振兴…”」「黑龙江附件3双鸭山市…」，
 * 这类噪声不在开头，NOISE 的锚定规则匹配不到，需单独处理。
 *
 * 必须带数字才剥离 —— 避免误伤「报名附件材料清单」这类以「附件」为实词的合法表述。
 */
const INFIX_NOISE = /附件\s*\d+\s*[:：_\-–—]?\s*/g

/** 合理的年度范围，超出则视为非年份数字（如电话、编号） */
const PLAUSIBLE_YEAR = (y) => y >= 2015 && y <= 2030

/**
 * 直辖市连续重复地区名：如「北京北京」「上海上海」。
 * 成因是采集时为直辖市（省名=市名）分别拼接了省前缀与市前缀。
 *
 * 锚定在名称开头（允许前置年份），只处理前缀位置的重复 ——
 * 避免误伤正文中间出现的同名街路等表述。第 1 组捕获年份以便替换时保留。
 */
const DUP_MUNICIPALITY = /^((?:19|20)\d{2}年)?(北京|上海|天津|重庆)\2/

/**
 * 剥离中缀序号噪声。剥离后正文过短则放弃，避免产出无意义文件名。
 */
function stripInfixNoise(name) {
  const out = name.replace(INFIX_NOISE, '')
  // 保留至少 4 个字符的正文，且不得把名称清空
  if (out.trim().length < 4) return name
  return out
}

/** 附件扩展名 */
export const ATTACH_EXT_RE = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)$/i

/** 反复剥离噪声，处理「附件1：2-1.xxx」这类叠加 */
export function stripNoise(name) {
  let out = name
  let changed = true
  while (changed) {
    changed = false
    for (const re of NOISE) {
      const next = out.replace(re, '')
      if (next !== out) {
        out = next
        changed = true
      }
    }
  }
  return out.trim() || name.trim()
}

/** 提取名称中第一个年份 */
export function findYear(name) {
  const m = /((?:19|20)\d{2})\s*年?/.exec(name)
  return m ? parseInt(m[1], 10) : null
}

/**
 * 提取名称中所有互不相同的年份。
 * 用于识别「2023年和2024年」这类合法双年份表述 —— 此时不得做年份前移，
 * 否则会把地区名插入两个年份之间，拆散原文语义。
 */
export function distinctYears(name) {
  const set = new Set()
  for (const m of name.matchAll(/(19|20)\d{2}/g)) set.add(parseInt(m[0], 10))
  return [...set]
}

/** 移除指定年份表述，便于重新前置 */
export function removeYear(name, year) {
  return name
    .replace(new RegExp(`${year}\\s*年度?\\s*`, 'g'), '')
    .replace(new RegExp(`${year}\\s*`, 'g'), '')
    .replace(/^[\s\-–—、.．]+/, '')
    .trim()
}

/** 清理空白与 Windows / URL 非法字符 */
export function sanitizeName(name) {
  return name.replace(/\s+/g, '').replace(/[\\/:*?"<>|\r\n\t]/g, '_')
}

/**
 * 规范化文件名主体（不含扩展名）。
 *
 * @param {string} stem 原始主体
 * @param {number|null} [fallbackYear] 所属公告的 year 字段，仅在主体完全不含年份时用于补齐
 */
export function normalizeStem(stem, fallbackYear = null) {
  let out = stripNoise(stem)

  // 直辖市连续重复地区名去重：「2026年北京北京…」→「2026年北京…」
  // $1 保留可选年份前缀，$2 保留一份市名。
  // 必须放在双年份早退分支之前 —— 该去重与年份无关，否则含「（2022年）」
  // 这类第二年份的文件会走早退分支而漏掉去重。
  out = out.replace(DUP_MUNICIPALITY, '$1$2')

  // 含多个不同年份（如「2023年和2024年」）时，只做噪声清理，
  // 不做年份前移与同年去重 —— 前移会把地区名插进两个年份之间，拆散原文语义
  if (distinctYears(out).length > 1) return sanitizeName(stripInfixNoise(out))

  // 年份前缀之后可能仍残留噪声（如「2025年附件1：山西省…」）
  const leadYear = /^((?:19|20)\d{2})\s*年?\s*/.exec(out)
  if (leadYear) {
    out = `${leadYear[1]}年${stripNoise(out.slice(leadYear[0].length))}`
  }

  // 中缀噪声：地区名之后的「附件N：」（如「黑龙江哈尔滨附件2：…」）
  out = stripInfixNoise(out)

  // 年份前移：仅当名称中已存在年份且不在开头
  if (!/^(19|20)\d{2}\s*年/.test(out)) {
    const y = findYear(out)
    if (y && PLAUSIBLE_YEAR(y)) {
      const rest = removeYear(out, y)
      if (rest) out = `${y}年${rest}`
    }
  }

  // 同年去重：仅去重与首年份相同的那个
  const headYear = /^((?:19|20)\d{2})年/.exec(out)
  if (headYear) {
    const y = headYear[1]
    const body = out.slice(headYear[0].length)
    const dedup = body.replace(new RegExp(`${y}\\s*年度?`, 'g'), '')
    const trimmed = dedup.replace(/^[\s\-–—、.．]+/, '')
    if (trimmed.length > 4) out = `${y}年${trimmed}`
  }

  // 完全缺年份时用所属公告的年度补齐（README 规范要求「年份+省市+文档名称」）。
  // 这里用的是数据中已存在的真实年度字段，不是推测值。
  if (!/^(19|20)\d{2}\s*年/.test(out) && fallbackYear && PLAUSIBLE_YEAR(fallbackYear)) {
    out = `${fallbackYear}年${out}`
  }

  return sanitizeName(out)
}

/**
 * 规范化完整文件名（含扩展名）。无实质变化时返回原名，避免无意义重命名。
 *
 * 「无实质变化」以去空格后的结果比较：仅存在空格差异的文件名不做重命名。
 * 这是刻意的取舍 —— 为了美观的空格去动数百个文件，收益远低于引入
 * 路径不一致的风险，也会污染 git 历史。
 *
 * @param {string} raw 当前文件名
 * @param {object} [opts]
 * @param {number|null} [opts.fallbackYear] 所属公告年度，仅在名称完全不含年份时用于补齐
 * @param {number} [opts.maxLen=110] 最大长度
 */
export function normalizeFilename(raw, opts = {}) {
  const { fallbackYear = null, maxLen = 110 } = opts
  const extMatch = ATTACH_EXT_RE.exec(raw)
  const ext = extMatch ? extMatch[0] : raw.includes('.') ? raw.slice(raw.lastIndexOf('.')) : ''
  const stem = raw.slice(0, raw.length - ext.length)

  const normalized = normalizeStem(stem, fallbackYear)
  if (normalized === sanitizeName(stem)) return raw // 无实质变化

  let out = `${normalized}${ext.toLowerCase()}`
  if (out.length > maxLen) out = `${normalized.slice(0, maxLen - ext.length)}${ext.toLowerCase()}`
  return out
}
