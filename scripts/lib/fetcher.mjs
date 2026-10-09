/**
 * 采集基础设施：编码自适应抓取 + 附件链接提取
 *
 * 政府站点大量使用 GBK/GB2312，fetch 默认按 UTF-8 解码会乱码，
 * 因此统一先取 ArrayBuffer，再按页面声明或启发式判定编码解码。
 */

const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
]

export function headersFor(url) {
  return {
    'User-Agent': UA_LIST[0],
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Referer: safeOrigin(url),
  }
}

function safeOrigin(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}/`
  } catch {
    return undefined
  }
}

/** 按 meta/HTTP 头/BOM/启发式判定编码并解码 */
export function decodeHtml(buf, contentType = '') {
  let declared = null

  const ctMatch = /charset\s*=\s*["']?\s*([\w-]+)/i.exec(contentType || '')
  if (ctMatch) declared = ctMatch[1]

  if (!declared) {
    // 只在前 4KB 内找 meta charset，避免全量扫描
    const head = Buffer.from(buf.slice(0, 4096)).toString('latin1')
    const m1 = /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(head)
    const m2 = /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i.exec(head)
    if (m1) declared = m1[1]
    else if (m2) declared = m2[1]
  }

  let enc = (declared || 'utf-8').toLowerCase().trim()
  // 常见别名归一
  const ALIAS = {
    gb2312: 'gbk',
    gb_2312: 'gbk',
    'gb-2312': 'gbk',
    gbk: 'gbk',
    gb18030: 'gb18030',
    big5: 'big5',
    'utf-8': 'utf-8',
    utf8: 'utf-8',
    'iso-8859-1': 'utf-8',
    windows1252: 'utf-8',
    '': 'utf-8',
  }
  enc = ALIAS[enc] || (enc.startsWith('gb') ? 'gbk' : 'utf-8')

  // BOM 优先
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) enc = 'utf-8'
  if (buf[0] === 0xff && buf[1] === 0xfe) enc = 'utf-16le'

  let text
  try {
    text = new TextDecoder(enc, { fatal: false }).decode(buf)
  } catch {
    text = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  }

  // 启发式兜底：若按 utf-8 解出大量替换字符，说明实为 GBK
  if (enc === 'utf-8' && countReplacement(text) > 5) {
    try {
      const gbk = new TextDecoder('gbk', { fatal: false }).decode(buf)
      if (countReplacement(gbk) < countReplacement(text)) {
        text = gbk
        enc = 'gbk'
      }
    } catch {
      /* keep utf-8 */
    }
  }

  return { text, encoding: enc }
}

function countReplacement(s) {
  let n = 0
  for (let i = 0; i < s.length && i < 200000; i++) if (s.charCodeAt(i) === 0xfffd) n++
  return n
}

/**
 * 抓取页面（HTML 或二进制通用），带协议回退与重定向。
 * 返回 { ok, status, buf, text, encoding, finalUrl, error, contentType }
 */
export async function fetchPage(url, { timeout = 25000, redirects = 5 } = {}) {
  const attempts = []
  try {
    const u = new URL(url)
    attempts.push(u.toString())
    // https <-> http 互为回退：部分站点证书 SAN 不匹配或仅开放 http
    if (u.protocol === 'https:') {
      const h = new URL(u.toString())
      h.protocol = 'http:'
      attempts.push(h.toString())
    } else {
      const h = new URL(u.toString())
      h.protocol = 'https:'
      attempts.push(h.toString())
    }
    // www <-> 裸域回退
    if (u.hostname.startsWith('www.')) {
      const n = new URL(u.toString())
      n.hostname = u.hostname.slice(4)
      attempts.push(n.toString())
    } else {
      const n = new URL(u.toString())
      n.hostname = `www.${u.hostname}`
      attempts.push(n.toString())
    }
  } catch (e) {
    return { ok: false, status: 0, buf: null, text: '', encoding: '', finalUrl: url, error: `bad-url:${e.message}`, contentType: '' }
  }

  let lastError = 'unknown'
  for (const target of attempts) {
    try {
      const res = await fetch(target, {
        headers: headersFor(target),
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      })
      if (!res.ok) {
        lastError = `http-${res.status}`
        // 4xx 通常换协议也没用，但 403/412 反爬值得一试其它入口
        if (res.status >= 400 && res.status < 500 && res.status !== 403 && res.status !== 412 && res.status !== 404) continue
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || ''
      const isHtml = /text\/html|application\/xhtml/i.test(contentType) || /\.(s?html?|jspx?|php|asp|aspx|shtml|jhtml)(\?|$)/i.test(target)
      const { text, encoding } = isHtml ? decodeHtml(buf, contentType) : { text: '', encoding: '' }
      return {
        ok: true,
        status: res.status,
        buf,
        text,
        encoding,
        finalUrl: res.url || target,
        error: null,
        contentType,
      }
    } catch (e) {
      lastError = e.name === 'TimeoutError' ? 'timeout' : `${e.cause?.code || e.code || e.message}`.slice(0, 60)
    }
  }
  return { ok: false, status: 0, buf: null, text: '', encoding: '', finalUrl: url, error: lastError, contentType: '' }
}

/** 附件扩展名白名单（含政务常用的 wps/et/dps） */
export const ATTACH_EXT = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)(\?|#|$)/i

/**
 * 从公告 HTML 中提取附件链接。
 * 策略：所有 a[href] 命中扩展名白名单 → 解析为绝对地址 → 按 URL 去重。
 * 同时识别 window.open / data-href / onclick 里的地址（政务站常见）。
 */
export function extractAttachments(html, baseUrl) {
  const out = []
  const seen = new Set()

  const push = (raw) => {
    if (!raw) return
    let abs
    try {
      abs = new URL(raw.trim(), baseUrl).toString()
    } catch {
      return
    }
    const noHash = abs.split('#')[0]
    if (!ATTACH_EXT.test(noHash)) return
    // 过滤明显的模板/装饰资源
    if (/\/(images?|img|css|js|static|template|theme|favicon)\//i.test(noHash)) return
    if (seen.has(noHash)) return
    seen.add(noHash)
    out.push(noHash)
  }

  // 1) 标准 a href
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/gi)) push(m[1])

  // 2) data-* 属性（部分站点把真实地址放在 data-href / data-url / data-attname）
  for (const m of html.matchAll(/data-(?:href|url|file|path|src|download)\s*=\s*["']([^"']+)["']/gi)) push(m[1])

  // 3) JS 里的字符串地址（window.open / location.href / download 函数参数）
  for (const m of html.matchAll(/["'](\/?[\w\-./]+\.(?:docx?|xlsx?|pdf|wps|et|dps|zip|rar|ofd)(?:\?[\w\-=&%]*)?)["']/gi)) push(m[1])

  return out
}

/**
 * 提取附件链接及其锚文本（锚文本用于生成"年份+省市+文档名称"规范文件名）。
 * 返回 [{url, text}]，按 URL 去重。
 */
export function extractAttachmentLinks(html, baseUrl) {
  const out = []
  const seen = new Set()
  const strip = (s) =>
    (s || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()

  const accept = (raw, text) => {
    if (!raw) return
    try {
      const abs = new URL(raw.trim(), baseUrl).toString().split('#')[0]
      if (!ATTACH_EXT.test(abs)) return
      if (/\/(images?|img|css|js|static|template|theme|favicon|logo)\//i.test(abs)) return
      if (seen.has(abs)) return
      seen.add(abs)
      out.push({ url: abs, text: text || '' })
    } catch {
      /* 相对路径解析失败则丢弃 */
    }
  }

  // 1) 标准 a 标签：href + data-* + 锚文本
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1]
    const text = strip(m[2])
    const hm = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)
    if (hm) accept(hm[1], text)
    for (const dm of attrs.matchAll(/data-(?:href|url|file|path|src|download)\s*=\s*["']([^"']+)["']/gi)) {
      accept(dm[1], text)
    }
  }

  // 2) JS 字符串里的地址（无锚文本，政务站常见 window.open / download 函数）
  for (const m of html.matchAll(
    /["'](\/?[\w\-./]+\.(?:docx?|xlsx?|pdf|wps|et|dps|zip|rar|ofd)(?:\?[\w\-=&%]*)?)["']/gi,
  )) {
    accept(m[1], '')
  }

  return out
}

/**
 * 页头动态系统时间噪声：如「今天是：2026年10月02日 星期五」「当前时间 …」。
 * 这类文本是采集当天的日期，不是发布日期，必须在提取前整段移除，
 * 否则「正文首个日期」回退会把它误当发布日。
 */
const SYSTEM_TIME_NOISE = [
  /今天是\s*[:：]?\s*(?:20)?\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日?\s*(?:星期[一二三四五六日天])?/g,
  /当前(?:日期|时间)\s*[:：]?\s*(?:20)?\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日?/g,
  /系统时间\s*[:：]?\s*(?:20)?\d{2}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}\s*日?/g,
  /星期[一二三四五六日天]\s*(?:20)?\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日?/g,
]

/** 本地时区的今天（YYYY-MM-DD），用于拒绝把当天系统时间当发布日 */
function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 从公告页提取发布日期，用于补齐缺失的 date 字段。
 * 优先级：meta 标签 > "发布时间/日期" 邻近文本 > 正文容器内首个日期 > 全文首个日期。
 *
 * 防误抓：页头「今天是…星期X」等动态系统时间会被剥离；且除非 meta 或明确的
 * 「发布时间/发布日期」关键字命中，否则拒绝返回等于采集当天的日期（那多半是系统时间）。
 */
export function extractPublishDate(html) {
  const norm = (y, m, d) => {
    const yy = parseInt(y, 10)
    const mm = parseInt(m, 10)
    const dd = parseInt(d, 10)
    if (!yy || !mm || !dd) return null
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
    if (yy < 2015 || yy > 2030) return null
    return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }

  const today = todayStr()

  // 1) 政务 CMS 常见 meta（最可信，允许等于当天）
  const metas = [
    /<meta[^>]+name\s*=\s*["'](?:PubDate|publishdate|ArticlePubDate|Pubdate|Publishtime|publish_time)["'][^>]+content\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["'](?:PubDate|publishdate|Publishtime)["']/i,
    /<meta[^>]+(?:property|name)\s*=\s*["']article:published_time["'][^>]+content\s*=\s*["']([^"']+)["']/i,
  ]
  for (const re of metas) {
    const m = re.exec(html)
    if (m) {
      const d = norm(...(m[1].match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/) || []).slice(1))
      if (d) return d
    }
  }

  // 去标签得到纯文本，并剥离页头系统时间噪声
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  for (const re of SYSTEM_TIME_NOISE) text = text.replace(re, ' ')

  // 2) 关键字邻近日期（明确的发布语义，可信度高，允许等于当天）
  const kw = /(?:发布时间|发布日期|发文日期|成文日期|时间)\s*[:：]?\s*(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/
  const km = kw.exec(text)
  if (km) {
    const d = norm(km[1], km[2], km[3])
    if (d) return d
  }

  const anyRe = /(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?/g
  // 回退层拒绝等于当天的日期（当天极可能是未剥离干净的系统时间）
  const firstNonToday = (src) => {
    let m
    anyRe.lastIndex = 0
    while ((m = anyRe.exec(src)) !== null) {
      const d = norm(m[1], m[2], m[3])
      if (d && d !== today) return d
    }
    return null
  }

  // 3) 正文容器内首个非当天日期（比全文更可信）
  const cont = sliceContainer(html)
  if (cont) {
    let bodyText = cont.html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
    for (const re of SYSTEM_TIME_NOISE) bodyText = bodyText.replace(re, ' ')
    const d = firstNonToday(bodyText)
    if (d) return d
  }

  // 4) 全文首个非当天日期
  const d = firstNonToday(text)
  if (d) return d

  return null
}

/**
 * 政务 CMS 常见正文容器特征（按命中率排序）。
 * 命中任一即截取该容器内部 HTML，避免把侧栏/页脚的无关文档链接当附件。
 */
export const CONTAINER_PATTERNS = [
  /<div[^>]+(?:id|class)\s*=\s*["'][^"']*(?:zoom|TRS_Editor|article-content|articleContent|content-detail|view\s|news-content|xl_content|article_content|main-content|detail-content|newscontent|news_content|content_con|txt-content)[^"']*["'][^>]*>/i,
  /<div[^>]+(?:id|class)\s*=\s*["'][^"']*(?:content|article|detail|main|view|text|body)[^"']*["'][^>]*>/i,
  /<article\b[^>]*>/i,
  /<td[^>]+(?:id|class)\s*=\s*["'][^"']*(?:content|article|zoom|text|view)[^"']*["'][^>]*>/i,
]

/**
 * 截取正文容器：定位起始标签后做同名标签括号配对，返回内部 HTML。
 * 未命中容器返回 null（调用方应回退到整页抽取）。
 */
export function sliceContainer(html) {
  for (const re of CONTAINER_PATTERNS) {
    const m = re.exec(html)
    if (!m) continue
    const start = m.index
    const tagMatch = /^<(\w+)/.exec(m[0])
    if (!tagMatch) continue
    const tag = tagMatch[1].toLowerCase()

    let depth = 0
    const scanRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
    scanRe.lastIndex = start
    let mm
    while ((mm = scanRe.exec(html)) !== null) {
      if (mm[1] === '/') {
        depth--
        if (depth === 0) {
          const end = Math.min(html.length, mm.index + mm[0].length)
          return { html: html.slice(start, end), start, end, paired: true }
        }
      } else if (!/\/>\s*$/.test(mm[0])) {
        depth++
      }
    }
    // 配对失败但容器已定位：取起始后 60KB 作为近似正文
    return { html: html.slice(start, start + 60000), start, end: start + 60000, paired: false }
  }
  return null
}

/**
 * 提取正文内附件（带容器误判回退）。
 *
 * 容器截取的作用是降噪（排除侧栏/页脚的无关文档链接，实测降噪约 36%）。
 * 但部分站点会命中错误的极小容器 —— 实测唐山人事考试网命中的容器仅 905 字节
 * （全页 119KB 的 0.8%，实为导航条），把正文里真实的岗位表附件整个排除在外。
 *
 * 因此采用保守回退：容器内抽到附件 → 用容器（降噪优先）；
 * 容器内 0 个但全页有 → 判定容器截错，回退全页，避免漏抓。
 *
 * 返回 { links, containerHit, usedFallback }
 */
export function extractBodyAttachments(html, baseUrl) {
  const cont = sliceContainer(html)
  if (!cont) {
    return { links: extractAttachmentLinks(html, baseUrl), containerHit: false, usedFallback: false }
  }

  const bodyLinks = extractAttachmentLinks(cont.html, baseUrl)
  if (bodyLinks.length > 0) {
    return { links: bodyLinks, containerHit: true, usedFallback: false }
  }

  // 容器内没有附件 —— 可能是该公告确实无附件，也可能是容器截错。
  // 用全页抽取兜底：全页也没有则说明确实无附件，全页有则说明容器截错了。
  const pageLinks = extractAttachmentLinks(html, baseUrl)
  return { links: pageLinks, containerHit: true, usedFallback: pageLinks.length > 0 }
}

/** 从附件 URL 猜测文件名 */
export function filenameFromUrl(url) {
  try {
    const u = new URL(url)
    let p = decodeURIComponent(u.pathname).split('/').filter(Boolean).pop() || ''
    p = p.split('?')[0].split('#')[0]
    return sanitize(p)
  } catch {
    return ''
  }
}

/** Windows/URL 安全文件名 */
export function sanitize(name) {
  return name
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/** 判断下载内容是否真的是目标类型（防止抓到 HTML 错误页当附件） */
export function looksLikeDocument(buf, url) {
  if (!buf || buf.length < 100) return false
  const head = buf.slice(0, 8)
  // PDF
  if (head.slice(0, 5).toString('latin1') === '%PDF-') return true
  // ZIP 容器（docx/xlsx/pptx/zip/ofd 均属之）
  if (head[0] === 0x50 && head[1] === 0x4b) return true
  // RAR
  if (head.slice(0, 4).toString('latin1') === 'Rar!') return true
  // 7z
  if (head[0] === 0x37 && head[1] === 0x7a) return true
  // OLE2 复合文档（老 .doc/.xls/.ppt/.wps）
  if (head.slice(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') return true

  // 纯文本类：只要不是 HTML 错误页就放行
  const sample = buf.slice(0, 2000).toString('latin1').toLowerCase()
  if (/\.(txt|csv)$/i.test(url)) return !/<html|<!doctype html/i.test(sample)

  // 未知类型但明显是 HTML → 判定为错误页
  if (/<html|<!doctype html/i.test(sample)) return false
  return true
}
