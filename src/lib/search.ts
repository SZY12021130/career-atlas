/**
 * 全局模糊搜索索引 — 聚合城市 / 区县 / 高校（design.md §6 SearchBar）。
 * 数据来源：34 省 data JSON（由采集 agent 并行写入），运行期懒加载聚合，
 * 任一省缺失（404）不影响整体索引。
 */
import { fetchIndex, fetchProvince } from './data'
import type { ProvinceData } from './data'

export type SearchGroup = '城市' | '区县' | '高校'

export interface SearchItem {
  group: SearchGroup
  /** 显示名，如 广州市 / 海淀区 / 中山大学 */
  name: string
  /** 所属上下文，如 广东省 / 北京市 */
  context: string
  /** 跳转路由 */
  to: string
}

let buildPromise: Promise<SearchItem[]> | null = null

function buildItems(provinces: (ProvinceData | null)[]): SearchItem[] {
  const items: SearchItem[] = []
  for (const p of provinces) {
    if (!p) continue
    for (const city of p.cities ?? []) {
      items.push({
        group: '城市',
        name: city.name,
        context: p.name,
        to: `/city/${city.adcode}`,
      })
      for (const district of city.districts ?? []) {
        items.push({
          group: '区县',
          name: district,
          context: `${p.name} · ${city.name}`,
          to: `/city/${city.adcode}`,
        })
      }
    }
    for (const uni of p.universities ?? []) {
      items.push({
        group: '高校',
        name: uni.name,
        context: `${p.name} · ${uni.city}`,
        to: `/university/${encodeURIComponent(uni.name)}`,
      })
    }
  }
  return items
}

/** 构建（或复用缓存的）全站搜索索引 */
export async function buildSearchIndex(): Promise<SearchItem[]> {
  if (!buildPromise) {
    buildPromise = (async () => {
      const index = await fetchIndex()
      if (!index) return []
      const provinces = await Promise.all(index.provinces.map((p) => fetchProvince(p.adcode)))
      return buildItems(provinces)
    })()
  }
  return buildPromise
}

/** 归一化：去空白、转小写，支持拼音/英文片段无感 */
function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

/** 简单模糊打分：连续子串 > 字符序列匹配，越靠前分越高 */
function score(query: string, target: string): number {
  const q = normalize(query)
  const t = normalize(target)
  if (!q) return 0
  const idx = t.indexOf(q)
  if (idx >= 0) return 100 - idx // 连续匹配
  // 子序列匹配（如 "广大" 命中 "广州市天河区" 不适用，主要容错跳字）
  let ti = 0
  for (const ch of q) {
    ti = t.indexOf(ch, ti)
    if (ti < 0) return 0
    ti++
  }
  return 10
}

export interface GroupedResults {
  group: SearchGroup
  items: SearchItem[]
}

const GROUP_ORDER: SearchGroup[] = ['城市', '区县', '高校']

/**
 * 模糊搜索：按组返回，每组最多 perGroup 条。
 * 索引未构建或查询为空时返回空数组。
 */
export function search(index: SearchItem[], query: string, perGroup = 5): GroupedResults[] {
  const q = query.trim()
  if (!q || index.length === 0) return []
  const scored = index
    .map((item) => ({ item, s: Math.max(score(q, item.name), score(q, item.context) - 20) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
  const groups = new Map<SearchGroup, SearchItem[]>()
  for (const { item } of scored) {
    const list = groups.get(item.group) ?? []
    if (list.length < perGroup) {
      list.push(item)
      groups.set(item.group, list)
    }
  }
  return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({ group: g, items: groups.get(g)! }))
}
