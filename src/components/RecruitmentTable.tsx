import { ExternalLink, Paperclip } from 'lucide-react'
import type { Recruitment } from '@/lib/data'
import TagBadge from './TagBadge'
import { cn } from '@/lib/utils'

export interface RecruitmentTableProps {
  recruitments: Recruitment[]
  /** 空态提示，默认「该类别暂无数据，已收录官方入口」 */
  emptyText?: string
  className?: string
}

/**
 * 公告列表：日期 / 标题 / 分类徽章 / 人数 / 来源 / 操作。
 * 斑马纹 surface/paper，行 hover bg-paper-deep/50，表头 sticky，空态插画。
 */
export default function RecruitmentTable({ recruitments, emptyText = '该类别暂无数据，已收录官方入口', className }: RecruitmentTableProps) {
  if (recruitments.length === 0) {
    return (
      <div className={cn('bg-surface rounded-2xl border border-line p-10 flex flex-col items-center text-center', className)}>
        <img src="/map-empty.svg" alt="暂无数据" className="w-48 h-auto opacity-90" />
        <p className="mt-4 text-sm text-ink-faint">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-surface rounded-2xl border border-line overflow-hidden shadow-[0_1px_0_rgba(42,39,35,.04)]', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[720px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper-deep/70 text-ink-soft text-left">
              <th className="px-5 py-3 font-medium whitespace-nowrap">日期</th>
              <th className="px-5 py-3 font-medium">标题</th>
              <th className="px-5 py-3 font-medium whitespace-nowrap">分类</th>
              <th className="px-5 py-3 font-medium whitespace-nowrap text-right">人数</th>
              <th className="px-5 py-3 font-medium whitespace-nowrap">来源</th>
              <th className="px-5 py-3 font-medium whitespace-nowrap text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {recruitments.map((r, i) => (
              <tr
                key={`${r.date}-${r.title}-${i}`}
                className={cn(
                  i % 2 === 0 ? 'bg-surface' : 'bg-paper',
                  'hover:bg-paper-deep/50 transition-colors duration-150 border-t border-line/60',
                )}
              >
                <td className="px-5 py-3.5 text-ink-faint whitespace-nowrap tabular-nums">{r.date}</td>
                <td className="px-5 py-3.5 max-w-[320px]">
                  <span className="block truncate text-ink" title={r.title}>
                    {r.title}
                    {r.category === '选调生' && r.subCategory && (
                      <span className="ml-1.5 text-xs text-ochre">{r.subCategory}</span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <TagBadge label={r.category} />
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-ink">
                  {r.headcount ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-5 py-3.5 text-ink-soft whitespace-nowrap max-w-[180px] truncate" title={r.source}>{r.source}</td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-cinnabar hover:text-cinnabar-deep transition-colors"
                  >
                    官网
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {r.attachments && r.attachments.length > 0 && (
                    <span className="inline-flex items-center gap-1 ml-3 text-ink-faint">
                      <Paperclip className="w-3.5 h-3.5" />
                      {r.attachments.length}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
