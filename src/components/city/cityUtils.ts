/**
 * 城市详情页专属工具：统计口径、聚合与展示常量（city.md §2/§5）。
 * 图表 X 轴固定 2024/2025/2026 三年，缺少年份按 0 计并标记 hasData=false（降透明度）。
 */
import { MUNICIPALITY_ADCODES } from '@/lib/data'
import type { Recruitment, RecruitmentCategory } from '@/lib/data'

export const YEARS = [2024, 2025, 2026] as const

/** 趋势堆叠柱使用的四大分类（录用公示为通知类，不进趋势堆叠） */
export const TREND_CATEGORIES = ['公务员', '选调生', '事业单位', '人才引进'] as const

/** 公告表筛选 chips 顺序 */
export const FILTER_CATEGORIES: ('全部' | RecruitmentCategory)[] = [
  '全部',
  '公务员',
  '选调生',
  '事业单位',
  '人才引进',
  '录用公示',
]

/** 城市类型徽章：直辖市 / 地级市 / 地区 / 自治州 / 盟 */
export function cityTypeLabel(name: string, adcode: number): string {
  if (MUNICIPALITY_ADCODES.has(adcode)) return '直辖市'
  if (name.includes('自治州')) return '自治州'
  if (name.endsWith('盟')) return '盟'
  if (name.endsWith('地区')) return '地区'
  return '地级市'
}

/** 招录人数合计：全部 null 时返回 null（界面显示「—」，脚注「以公告披露为准」） */
export function sumNullable(values: (number | null | undefined)[]): number | null {
  let has = false
  let sum = 0
  for (const v of values) {
    if (typeof v === 'number') {
      has = true
      sum += v
    }
  }
  return has ? sum : null
}

export function countByCategory(recruitments: Recruitment[], category: string): number {
  return recruitments.reduce((n, r) => n + (r.category === category ? 1 : 0), 0)
}

export interface YearStat {
  year: number
  /** 各分类公告数 */
  counts: Record<string, number>
  /** 各分类招录人数合计（null 按 0） */
  headcounts: Record<string, number>
  /** 各分类岗位数合计（null 按 0） */
  positions: Record<string, number>
  headcountTotal: number
  positionsTotal: number
  total: number
  hasData: boolean
}

/** 近三年分年统计（固定 YEARS 顺序） */
export function yearlyStats(recruitments: Recruitment[]): YearStat[] {
  return YEARS.map((year) => {
    const rows = recruitments.filter((r) => r.year === year)
    const counts: Record<string, number> = {}
    const headcounts: Record<string, number> = {}
    const positions: Record<string, number> = {}
    for (const cat of TREND_CATEGORIES) {
      const catRows = rows.filter((r) => r.category === cat)
      counts[cat] = catRows.length
      headcounts[cat] = catRows.reduce((s, r) => s + (r.headcount ?? 0), 0)
      positions[cat] = catRows.reduce((s, r) => s + (r.positions ?? 0), 0)
    }
    return {
      year,
      counts,
      headcounts,
      positions,
      headcountTotal: rows.reduce((s, r) => s + (r.headcount ?? 0), 0),
      positionsTotal: rows.reduce((s, r) => s + (r.positions ?? 0), 0),
      total: rows.length,
      hasData: rows.length > 0,
    }
  })
}
