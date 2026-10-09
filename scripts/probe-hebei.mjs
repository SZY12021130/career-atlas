/**
 * 一次性探测：河北人事考试网（Vue SPA，FEBS 框架）的后端公告接口。
 * 静态 HTML 是空壳，附件与正文靠 JS 异步加载，需找到其数据 API。
 * 探测失败则本站改为「官网获取」标注方案，不做无限尝试。
 */
import { headersFor, fetchPage } from './lib/fetcher.mjs'

const BASE = 'https://www.hebpta.com.cn'
const ART_URL = `${BASE}/article?artId=13104&id=293`

async function get(url, opt = {}) {
  const r = await fetch(url, { headers: headersFor(url), redirect: 'follow', signal: AbortSignal.timeout(20000), ...opt })
  return r
}

// 1) 从 HTML 提取 app.js
const html = await (await get(ART_URL)).text()
const jsMatch = [...html.matchAll(/src=(\/static\/js\/app\.[^"' >]+\.js)/g)].map((m) => m[1])
console.log('app.js 路径:', jsMatch)
if (!jsMatch.length) {
  console.log('未找到 app.js，探测终止')
  process.exit(0)
}

// 2) 抓 app.js，提取 API 线索
const js = await (await get(BASE + jsMatch[0])).text()
console.log('app.js 长度:', js.length)

const uniq = (arr, n = 20) => [...new Set(arr)].slice(0, n)

const baseURLs = uniq([...js.matchAll(/baseURL["'`]?\s*[:=]\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]))
const febsPaths = uniq([...js.matchAll(/["'`](\/febs[\w/-]*)["'`]/g)].map((m) => m[1]))
const apiPaths = uniq(
  [...js.matchAll(/["'`]((?:\/[a-zA-Z][\w-]*){1,4}(?:article|art|news|content|info|detail|annex|attach|file)[\w/-]*)["'`]/gi)].map((m) => m[1]),
  25,
)
const getPaths = uniq([...js.matchAll(/\.(?:get|post)\(["'`](\/[^"'`]{3,60})["'`]/g)].map((m) => m[1]), 25)

console.log('\nbaseURL:', baseURLs)
console.log('\n/febs 路径:', febsPaths)
console.log('\napi-like 路径:', apiPaths)
console.log('\naxios get/post 路径:', getPaths)

// 3) 候选接口逐个试探
const candidates = [
  ...febsPaths.map((p) => BASE + p),
  ...apiPaths.map((p) => BASE + p),
  `${BASE}/febs/article/13104`,
  `${BASE}/febs/article?artId=13104`,
  `${BASE}/api/article/13104`,
  `${BASE}/article/13104`,
]

console.log('\n=== 接口试探 ===')
let hit = null
for (const url of uniq(candidates, 25)) {
  try {
    const r = await get(url, { headers: { ...headersFor(url), Accept: 'application/json, text/plain, */*' } })
    const ct = r.headers.get('content-type') || ''
    const body = await r.text()
    const isJson = /json/i.test(ct) || body.trim().startsWith('{') || body.trim().startsWith('[')
    const hasCjk = /[\u4e00-\u9fa5]/.test(body)
    const flag = r.ok && isJson && hasCjk ? ' ✅JSON+CJK' : r.ok && isJson ? ' (json)' : ''
    console.log(`${r.status} ${String(body.length).padStart(7)}B${flag}  ${url.replace(BASE, '')}`)
    if (!hit && r.ok && isJson && hasCjk) hit = { url, sample: body.slice(0, 900) }
  } catch (e) {
    console.log(`ERR ${String(e.message).slice(0, 30).padEnd(32)} ${url.replace(BASE, '')}`)
  }
}

if (hit) {
  console.log(`\n=== 命中接口 ${hit.url} ===`)
  console.log(hit.sample)
} else {
  console.log('\n未命中可用接口 → 河北改用「官网获取」标注方案')
}
