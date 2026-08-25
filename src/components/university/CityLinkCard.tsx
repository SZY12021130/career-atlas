import { Link } from 'react-router'
import { MoveRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CityLinkCardProps {
  icon: LucideIcon
  label: string
  desc: string
  to: string
  /** 该市该分类近三年公告数 */
  count: number
  /** 分类语义色 */
  color: string
  className?: string
}

/** 同城公职联动迷你卡（university.md §Section 3）：分类色底 4% hover + 箭头位移 */
export default function CityLinkCard({ icon: Icon, label, desc, to, count, color, className }: CityLinkCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex items-center gap-4 bg-surface rounded-2xl border border-line p-5 overflow-hidden',
        'shadow-[0_1px_0_rgba(42,39,35,.04)] transition-all duration-200',
        'hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(42,39,35,.18)]',
        className,
      )}
    >
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ backgroundColor: `${color}0A` }}
      />
      <span
        className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}1A`, color }}
      >
        <Icon className="w-5 h-5" />
      </span>
      <span className="relative flex-1 min-w-0">
        <span className="block font-sans font-bold text-ink">{label}</span>
        <span className="block text-xs text-ink-faint mt-0.5 truncate">{desc}</span>
      </span>
      <span className="relative text-right shrink-0">
        <span
          className="block font-num font-semibold text-ink leading-none"
          style={{ fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}
        >
          {count.toLocaleString('zh-CN')}
        </span>
        <span className="block text-[11px] text-ink-faint mt-1">近三年公告</span>
      </span>
      <MoveRight className="relative w-4 h-4 shrink-0 text-ink-faint opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" style={{ color }} />
    </Link>
  )
}
