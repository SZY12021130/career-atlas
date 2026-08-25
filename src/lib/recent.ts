/** 最近访问城市（localStorage）：首页快捷入口，见 docs/product-review.md v2.0 需求 2 */

export interface RecentCity {
  adcode: number
  name: string
  provinceName: string
}

const KEY = 'career-atlas:recent-cities'
const MAX = 6

export function getRecentCities(): RecentCity[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (c): c is RecentCity =>
        !!c && typeof (c as RecentCity).adcode === 'number' && typeof (c as RecentCity).name === 'string',
    )
  } catch {
    return []
  }
}

export function recordCityVisit(city: RecentCity): void {
  try {
    const list = getRecentCities().filter((c) => c.adcode !== city.adcode)
    list.unshift(city)
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* 隐私模式等场景静默失败 */
  }
}

export function clearRecentCities(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
