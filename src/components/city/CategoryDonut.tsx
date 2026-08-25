import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import ChartCard from '@/components/ChartCard'
import EChart from '@/components/EChart'
import type { Recruitment } from '@/lib/data'
import { assetUrl } from '@/lib/data'
import { categoryColor, INK, INK_FAINT, PAPER } from '@/lib/theme'

const ORDER = ['公务员', '选调生', '事业单位', '人才引进', '录用公示']

export interface CategoryDonutProps {
  recruitments: Recruitment[]
  updatedAt: string | null
}

/** 侧图「公告分类占比」：环形图 + 右侧图例列表（带计数小字） */
export default function CategoryDonut({ recruitments, updatedAt }: CategoryDonutProps) {
  const rows = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of recruitments) map.set(r.category, (map.get(r.category) ?? 0) + 1)
    return ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, count: map.get(c)! }))
  }, [recruitments])

  const total = rows.reduce((s, r) => s + r.count, 0)

  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['58%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: PAPER, borderWidth: 3, borderRadius: 4 },
          label: { show: false },
          emphasis: {
            label: { show: true, formatter: '{b}\n{c} 条', color: INK, fontSize: 13, fontWeight: 600 },
            scaleSize: 6,
          },
          data: rows.map((r) => ({
            name: r.category,
            value: r.count,
            itemStyle: { color: categoryColor(r.category) },
          })),
        },
      ],
    }),
    [rows],
  )

  return (
    <ChartCard
      title="公告分类占比"
      option={option}
      source="各官方招录网站"
      updatedAt={updatedAt ?? undefined}
      className="lg:col-span-4"
    >
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-10" style={{ minHeight: 280 }}>
          <img src={assetUrl('map-empty.svg')} alt="暂无数据" className="w-40 h-auto opacity-90" />
          <p className="mt-4 text-sm text-ink-faint">数据整理中，已收录官方入口</p>
        </div>
      ) : (
        <div className="flex items-center gap-4" style={{ minHeight: 280 }}>
          <div className="w-1/2 shrink-0" style={{ height: 260 }}>
            <EChart option={option} />
          </div>
          <ul className="flex-1 space-y-2.5 min-w-0">
            {rows.map((r) => {
              const color = categoryColor(r.category)
              const pct = ((r.count / total) * 100).toFixed(1)
              return (
                <li key={r.category} className="flex items-center gap-2 text-[13px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-ink-soft truncate">{r.category}</span>
                  <span className="ml-auto font-num text-ink tabular-nums shrink-0">{r.count}</span>
                  <span className="text-xs w-12 text-right shrink-0" style={{ color: INK_FAINT }}>
                    {pct}%
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </ChartCard>
  )
}
