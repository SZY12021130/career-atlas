import { Link } from 'react-router'
import { ExternalLink, MoveRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChannelCardProps {
  icon: LucideIcon
  title: string
  desc: string
  /** 外链地址；null / 空串 → 灰态「暂未收录」 */
  url?: string | null
  /** 站内路由（与 url 二选一）；站内卡不新开窗口 */
  to?: string
  /** 左竖条主题色，默认朱砂 */
  color?: string
  className?: string
}

/**
 * 高校官方渠道直达卡（university.md §Section 2）。
 * 分类色 4px 左竖条 + 名称 + 说明文案；缺失字段时灰显「暂未收录」。
 */
export default function ChannelCard({
  icon: Icon,
  title,
  desc,
  url,
  to,
  color = '#F0635A',
  className,
}: ChannelCardProps) {
  const disabled = !to && !url

  const inner = (
    <>
      {/* hover 8% 主题色底 */}
      {!disabled && (
        <span
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{ backgroundColor: `${color}14` }}
        />
      )}
      <span className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            disabled ? 'bg-paper-deep text-ink-faint' : 'text-surface',
          )}
          style={disabled ? undefined : { backgroundColor: color }}
        >
          <Icon className="w-5 h-5" />
        </span>
        {!disabled && (
          <span className="flex items-center gap-1.5 text-ink-faint shrink-0 pt-1">
            {!to && <ExternalLink className="w-4 h-4" />}
            <MoveRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" style={{ color }} />
          </span>
        )}
      </span>
      <span className="relative mt-4 block">
        <span className={cn('block font-sans font-bold', disabled ? 'text-ink-faint' : 'text-ink')}>{title}</span>
        <span className="block text-[13px] text-ink-faint mt-1.5 leading-6">{desc}</span>
      </span>
      {disabled && (
        <span className="relative mt-3 inline-flex self-start items-center px-2 py-0.5 rounded-full border border-line text-xs text-ink-faint">
          暂未收录
        </span>
      )}
    </>
  )

  const cls = cn(
    'group relative flex flex-col bg-surface rounded-2xl border border-line p-5 pl-6 overflow-hidden',
    'shadow-[0_1px_0_rgba(0,0,0,.25)] transition-all duration-200',
    disabled
      ? 'cursor-default'
      : 'hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]',
    className,
  )
  const style = { borderLeft: `4px solid ${disabled ? '#22314B' : color}` }

  if (disabled) {
    return (
      <div className={cls} style={style} aria-disabled>
        {inner}
      </div>
    )
  }
  if (to) {
    return (
      <Link to={to} className={cls} style={style}>
        {inner}
      </Link>
    )
  }
  return (
    <a href={url ?? '#'} target="_blank" rel="noreferrer" className={cls} style={style}>
      {inner}
    </a>
  )
}
