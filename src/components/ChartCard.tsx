import type { ReactNode } from 'react'
import EChart from './EChart'
import type { EChartProps } from './EChart'
import { cn } from '@/lib/utils'

export interface ChartCardProps {
  title: string
  /** 标题右侧图例说明 / 切换 tab */
  extra?: ReactNode
  option: EChartProps['option']
  onEvents?: EChartProps['onEvents']
  /** 图表高度 320-400px */
  height?: number
  /** 来源脚注，如「广东省人事考试网」 */
  source?: string
  updatedAt?: string
  className?: string
  children?: ReactNode
}

/** 图表容器卡：标题行 + ECharts 容器 + 底部来源脚注 */
export default function ChartCard({ title, extra, option, onEvents, height = 340, source, updatedAt, className, children }: ChartCardProps) {
  return (
    <section className={cn('bg-surface rounded-2xl border border-line p-6 md:p-8 shadow-[0_1px_0_rgba(42,39,35,.04)]', className)}>
      <header className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h3 className="font-serif font-bold text-lg text-ink">{title}</h3>
        {extra && <div className="text-xs text-ink-faint">{extra}</div>}
      </header>
      {children ?? (
        <div style={{ height }}>
          <EChart option={option} onEvents={onEvents} />
        </div>
      )}
      {(source || updatedAt) && (
        <footer className="mt-4 pt-3 border-t border-line/60 text-xs text-ink-faint">
          数据来源：{source ?? '各官方招录网站'}
          {updatedAt && ` · 更新于 ${updatedAt}`}
        </footer>
      )}
    </section>
  )
}
