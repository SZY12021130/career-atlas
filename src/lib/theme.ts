/** 全站共享的视觉常量（v2.0 深色科技风） */

/** 分类语义色（深色底高可读亮色） */
export const CATEGORY_COLORS = {
  公务员: '#F0635A',
  选调生: '#F5A94B',
  选调: '#F5A94B',
  事业单位: '#3ED598',
  人才引进: '#C084FC',
  录用公示: '#7A8BA8',
} as const

export type CategoryName = keyof typeof CATEGORY_COLORS

export function categoryColor(category: string): string {
  return (CATEGORY_COLORS as Record<string, string>)[category] ?? '#7A8BA8'
}

/** 地图省份 6 色深色循环：色相+明度双重差异，相邻省对比清晰 */
export const MAP_PROVINCE_COLORS = ['#1E6FA8', '#0F5E50', '#6B4FC4', '#8A2E4E', '#9A7A1F', '#2A3F66']

/** 按 subFeatureIndex 循环取色，保证相邻省异色 */
export function provinceColor(subFeatureIndex: number | undefined, fallback: number): string {
  const i = subFeatureIndex ?? fallback
  return MAP_PROVINCE_COLORS[((i % 6) + 6) % 6]
}

export const INK = '#E6ECF5'
export const INK_SOFT = '#9AA7BE'
export const INK_FAINT = '#5E6C85'
export const LINE = '#22314B'
export const GRID_LINE = '#1B2740'
export const PAPER = '#0B1220'
export const SURFACE = '#121C31'
export const CINNABAR = '#22D3EE'
