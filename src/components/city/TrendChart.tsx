import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { EChartsOption } from 'echarts'
import ChartCard from '@/components/ChartCard'
import type { Recruitment } from '@/lib/data'
import { assetUrl } from '@/lib/data'
import { CATEGORY_COLORS, INK, INK_FAINT } from '@/lib/theme'
import { TREND_CATEGORIES, yearlyStats } from './cityUtils'

type Metric = 'announcements' | 'headcount' | 'positions'

const METRIC_TABS: { key: Metric; label: string }[] = [
  { key: 'announcements', label: '公告数' },
  { key: 'headcount', label: '招录人数' },
  { key: 'positions', label: '岗位数' },
]

export interface TrendChartProps {
  recruitments: Recruitment[]
  updatedAt: string | null
}

/**
 * 主图「近三年招聘趋势」：堆叠柱（各分类）+ 折线（合计，墨黑圆点）。
 * 顶部 tab 切换度量：公告数 / 招录人数 / 岗位数（Framer Motion layoutId 下划线 + ECharts 0.5s 数据过渡）。
 */
export default function TrendChart({ recruitments, updatedAt }: TrendChartProps) {
  const [metric, setMetric] = useState<Metric>('announcements')
  const stats = useMemo(() => yearlyStats(recruitments), [recruitments])
  const hasAny = stats.some((s) => s.hasData)

  const option = useMemo<EChartsOption>(() => {
    const pick = (cat: (typeof TREND_CATEGORIES)[number]) =>
      stats.map((s) => (metric === 'announcements' ? s.counts[cat] : metric === 'headcount' ? s.headcounts[cat] : s.positions[cat]))
    const totals = stats.map((s) => (metric === 'announcements' ? s.total : metric === 'headcount' ? s.headcountTotal : s.positionsTotal))

    return {
      animationDurationUpdate: 500,
      grid: { left: 8, right: 12, top: 44, bottom: 4, containLabel: true },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 10,
        itemHeight: 10,
        icon: 'circle',
        textStyle: { color: INK_FAINT, fontSize: 12 },
        data: [...TREND_CATEGORIES, '合计'],
      },
      xAxis: {
        type: 'category',
        data: stats.map((s) => ({
          value: String(s.year),
          // 缺少年份标签降透明度（city.md §2）
          textStyle: { color: s.hasData ? INK_FAINT : 'rgba(154,145,132,.4)' },
        })),
        axisTick: { show: false },
      },
      yAxis: [
        { type: 'value', minInterval: 1 },
        { type: 'value', minInterval: 1, splitLine: { show: false } },
      ],
      series: [
        ...TREND_CATEGORIES.map((cat) => ({
          name: cat,
          type: 'bar' as const,
          stack: 'total',
          barWidth: 44,
          itemStyle: { color: CATEGORY_COLORS[cat] },
          emphasis: { focus: 'series' as const },
          data: pick(cat),
        })),
        {
          name: '合计',
          type: 'line' as const,
          yAxisIndex: 1,
          data: totals,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: INK },
          lineStyle: { color: INK, width: 2.5 },
          label: { show: true, position: 'top' as const, color: INK, fontSize: 11, fontFamily: 'Fraunces, serif' },
        },
      ],
    }
  }, [stats, metric])

  const tabs = (
    <div className="flex items-center gap-1 rounded-full bg-paper-deep/70 p-1">
      {METRIC_TABS.map((t) => {
        const active = t.key === metric
        return (
          <button
            key={t.key}
            onClick={() => setMetric(t.key)}
            className={`relative px-3 py-1 rounded-full text-xs transition-colors duration-200 ${
              active ? 'text-paper' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {active && <motion.span layoutId="trend-tab" className="absolute inset-0 rounded-full bg-ink" transition={{ duration: 0.3 }} />}
            <span className="relative z-10">{t.label}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <ChartCard
      title="近三年招聘趋势"
      extra={tabs}
      option={option}
      height={360}
      source="各官方招录网站 · 数据覆盖 2024 年至今"
      updatedAt={updatedAt ?? undefined}
      className="lg:col-span-8"
    >
      {hasAny ? undefined : (
        <div className="flex flex-col items-center text-center py-10" style={{ minHeight: 360, justifyContent: 'center' }}>
          <img src={assetUrl('map-empty.svg')} alt="暂无数据" className="w-44 h-auto opacity-90" />
          <p className="mt-4 text-sm text-ink-faint">数据整理中，已收录官方入口</p>
        </div>
      )}
    </ChartCard>
  )
}
