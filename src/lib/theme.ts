/** 全站共享的视觉常量（design.md §2） */

/** 分类语义色 */
export const CATEGORY_COLORS = {
  公务员: '#B5493A',
  选调生: '#C08A3E',
  选调: '#C08A3E',
  事业单位: '#3F6C5B',
  人才引进: '#7D5A6B',
  录用公示: '#8A8378',
} as const

export type CategoryName = keyof typeof CATEGORY_COLORS

export function categoryColor(category: string): string {
  return (CATEGORY_COLORS as Record<string, string>)[category] ?? '#8A8378'
}

/** 地图省份 6 色循环均衡色板 */
export const MAP_PROVINCE_COLORS = ['#D9C7A7', '#BFC9B2', '#D8BBA6', '#C3BBAE', '#B9C4C0', '#DCC9B4']

/** 按 subFeatureIndex 循环取色，保证相邻省异色 */
export function provinceColor(subFeatureIndex: number | undefined, fallback: number): string {
  const i = subFeatureIndex ?? fallback
  return MAP_PROVINCE_COLORS[((i % 6) + 6) % 6]
}

export const INK = '#2A2723'
export const INK_SOFT = '#5C564B'
export const INK_FAINT = '#9A9184'
export const LINE = '#E4DCCB'
export const GRID_LINE = '#EAE3D3'
export const PAPER = '#F7F3EA'
export const SURFACE = '#FDFBF5'
export const CINNABAR = '#B5493A'
