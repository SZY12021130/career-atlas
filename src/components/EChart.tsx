import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { CATEGORY_COLORS, GRID_LINE, INK_FAINT, INK, PAPER } from '@/lib/theme'

/** 全站 ECharts 主题「atlas」：design.md §6 ChartCard 规范 */
const THEME_NAME = 'atlas'
let themeRegistered = false

export function registerAtlasTheme(): void {
  if (themeRegistered) return
  themeRegistered = true
  echarts.registerTheme(THEME_NAME, {
    color: [
      CATEGORY_COLORS['公务员'],
      CATEGORY_COLORS['选调生'],
      CATEGORY_COLORS['事业单位'],
      CATEGORY_COLORS['人才引进'],
      CATEGORY_COLORS['录用公示'],
    ],
    textStyle: { fontFamily: '"Noto Sans SC", sans-serif' },
    grid: { borderColor: GRID_LINE },
    categoryAxis: {
      axisLine: { lineStyle: { color: GRID_LINE } },
      axisTick: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: INK_FAINT },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: GRID_LINE } },
      axisTick: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: INK_FAINT },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    logAxis: {
      axisLabel: { color: INK_FAINT },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    timeAxis: {
      axisLabel: { color: INK_FAINT },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    line: { symbolSize: 6 },
    tooltip: {
      backgroundColor: INK,
      borderWidth: 0,
      textStyle: { color: PAPER, fontSize: 13 },
      extraCssText: 'border-radius:8px;padding:10px 14px;box-shadow:0 8px 24px -8px rgba(0,0,0,.55);',
    },
  })
}

registerAtlasTheme()

export interface EChartProps {
  option: echarts.EChartsOption
  className?: string
  style?: React.CSSProperties
  /** 事件绑定，如 { click: (params) => ... } */
  onEvents?: Record<string, (params: unknown) => void>
  /** chart 实例就绪回调（用于 registerMap 后 setOption 等高级场景） */
  onReady?: (chart: echarts.ECharts) => void
  notMerge?: boolean
}

/** ECharts React 封装：自动 init / resize / dispose，统一使用 atlas 主题 */
export default function EChart({ option, className, style, onEvents, onReady, notMerge = true }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const eventsRef = useRef(onEvents)
  eventsRef.current = onEvents

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, THEME_NAME)
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption(option, { notMerge })
    // 重新绑定事件（先解绑避免重复）
    const events = eventsRef.current
    if (events) {
      for (const [name, handler] of Object.entries(events)) {
        chart.off(name)
        chart.on(name, handler)
      }
    }
  }, [option, notMerge])

  useEffect(() => {
    if (chartRef.current && onReady) onReady(chartRef.current)
  }, [onReady])

  return <div ref={ref} className={className} style={{ width: '100%', height: '100%', ...style }} />
}
