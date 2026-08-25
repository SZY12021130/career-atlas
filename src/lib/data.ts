/**
 * 数据访问层 — 类型定义与 /mnt/agents/output/data/SCHEMA.md 完全一致。
 * 各省 data JSON 由采集 agent 并行写入，读取函数对 404/空数据全部优雅降级（返回 null / 空数组）。
 */

// ---------------------------------------------------------------------------
// 类型定义（Schema v1）
// ---------------------------------------------------------------------------

export type PortalCategory = '公务员' | '事业单位' | '选调' | '人才引进' | '录用公示'
export type RecruitmentCategory = '公务员' | '选调生' | '事业单位' | '人才引进' | '录用公示'
export type XuanDiaoSubCategory = '定向选调' | '普通选调'
export type UniversityTag = '985' | '211' | '双一流' | '省属重点' | '普通本科' | '民办'

export interface Portal {
  category: PortalCategory | RecruitmentCategory | string
  name: string
  url: string
}

export interface Attachment {
  /** 命名规范：年份+省市+文档名称 */
  name: string
  /** 官网原始链接 */
  url: string
  /** 本地相对路径 attachments/{市adcode}/{文件名}，无法下载时为 null */
  local: string | null
}

export interface Recruitment {
  year: number
  category: RecruitmentCategory
  /** 仅选调类填 */
  subCategory?: XuanDiaoSubCategory | string | null
  title: string
  /** YYYY-MM-DD */
  date: string
  headcount: number | null
  positions: number | null
  source: string
  url: string
  attachments: Attachment[]
}

export interface City {
  adcode: number
  name: string
  districts: string[]
  portals: Portal[]
  recruitments: Recruitment[]
}

export interface University {
  name: string
  city: string
  cityAdcode: number
  tags: string[]
  website: string
  hrUrl: string
  talentPolicyUrl: string | null
}

export interface ProvinceData {
  adcode: number
  name: string
  /** YYYY-MM-DD */
  updatedAt: string
  provincePortals: Portal[]
  cities: City[]
  universities: University[]
}

export interface ProvinceIndexEntry {
  adcode: number
  name: string
  region: string
  dataFile: string
  geoFile: string
}

export interface DataIndex {
  updatedAt: string
  provinces: ProvinceIndexEntry[]
}

// ---------------------------------------------------------------------------
// GeoJSON 类型
// ---------------------------------------------------------------------------

export interface GeoFeatureProperties {
  adcode: number
  name: string
  center?: [number, number]
  centroid?: [number, number]
  childrenNum?: number
  level?: string
  parent?: { adcode: number }
  subFeatureIndex?: number
  acroutes?: number[]
}

export interface GeoFeature {
  type: 'Feature'
  properties: GeoFeatureProperties
  geometry: unknown
}

export interface GeoJSON {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

// ---------------------------------------------------------------------------
// 读取函数（全部 404-safe）
// ---------------------------------------------------------------------------

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** 静态资源路径：拼接 BASE_URL，适配 GitHub Pages 子路径部署 */
export function assetUrl(p: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${p.replace(/^\/+/, '')}`
}

const indexCache: { value: DataIndex | null | undefined } = { value: undefined }
const provinceCache = new Map<number, ProvinceData | null>()
const geoCache = new Map<string, GeoJSON | null>()

/** 全国数据索引 /data/index.json */
export async function fetchIndex(): Promise<DataIndex | null> {
  if (indexCache.value === undefined) {
    indexCache.value = await fetchJSON<DataIndex>(assetUrl('data/index.json'))
  }
  return indexCache.value
}

/** 省级数据 /data/{省adcode}.json，缺失返回 null */
export async function fetchProvince(adcode: number): Promise<ProvinceData | null> {
  if (!provinceCache.has(adcode)) {
    provinceCache.set(adcode, await fetchJSON<ProvinceData>(assetUrl(`data/${adcode}.json`)))
  }
  return provinceCache.get(adcode) ?? null
}

/** 地图 GeoJSON：全国 100000_full.json，省级 {省adcode}_full.json */
export async function fetchGeo(adcode: number | string): Promise<GeoJSON | null> {
  const key = String(adcode)
  if (!geoCache.has(key)) {
    geoCache.set(key, await fetchJSON<GeoJSON>(assetUrl(`geo/${key}_full.json`)))
  }
  return geoCache.get(key) ?? null
}

/** 附件静态资源完整路径 */
export function attachmentUrl(cityAdcode: number, attachment: Attachment): string | null {
  if (!attachment.local) return null
  return assetUrl(attachment.local.startsWith('attachments/') ? attachment.local : `attachments/${cityAdcode}/${attachment.name}`)
}

// ---------------------------------------------------------------------------
// 聚合工具
// ---------------------------------------------------------------------------

export interface NationalStats {
  provinces: number
  cities: number
  universities: number
  recruitments: number
  latestUpdate: string | null
}

/** 聚合所有已就绪省份的全国统计；数据缺失时按 0 计 */
export function aggregateNational(index: DataIndex | null, provinces: (ProvinceData | null)[]): NationalStats {
  const ready = provinces.filter((p): p is ProvinceData => p !== null)
  const latest = ready
    .map((p) => p.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null
  return {
    provinces: index?.provinces.length ?? 34,
    cities: ready.reduce((s, p) => s + (p.cities?.length ?? 0), 0),
    universities: ready.reduce((s, p) => s + (p.universities?.length ?? 0), 0),
    recruitments: ready.reduce(
      (s, p) => s + (p.cities ?? []).reduce((c, city) => c + (city.recruitments?.length ?? 0), 0),
      0,
    ),
    latestUpdate: latest,
  }
}

/** 单省速览统计（用于地图 tooltip） */
export function summarizeProvince(p: ProvinceData | null): { cities: number; universities: number; recruitments: number } {
  if (!p) return { cities: 0, universities: 0, recruitments: 0 }
  return {
    cities: p.cities?.length ?? 0,
    universities: p.universities?.length ?? 0,
    recruitments: (p.cities ?? []).reduce((c, city) => c + (city.recruitments?.length ?? 0), 0),
  }
}

/** 直辖市（京津沪渝）省级页直接跳城市页 */
export const MUNICIPALITY_ADCODES = new Set([110000, 120000, 310000, 500000])
