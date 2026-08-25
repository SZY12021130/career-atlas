import { ExternalLink, MoveRight } from 'lucide-react'
import { categoryColor } from '@/lib/theme'
import type { Portal } from '@/lib/data'
import { cn } from '@/lib/utils'

function domainOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** 官网入口卡：分类色 4px 左竖条 + 官网名称 + 域名小字，点击新窗口打开 */
export default function PortalCard({ portal, className }: { portal: Portal; className?: string }) {
  const color = categoryColor(portal.category)
  return (
    <a
      href={portal.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'group relative flex items-center gap-4 bg-surface rounded-2xl border border-line p-5 pl-6 overflow-hidden',
        'shadow-[0_1px_0_rgba(42,39,35,.04)] transition-all duration-200',
        'hover:shadow-[0_12px_32px_-12px_rgba(42,39,35,.18)]',
        className,
      )}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {/* hover 8% 分类色底 */}
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ backgroundColor: `${color}14` }}
      />
      <span className="flex-1 min-w-0 relative">
        <span className="block font-sans font-bold text-ink truncate">{portal.name}</span>
        <span className="block text-xs text-ink-faint mt-1 truncate">{domainOf(portal.url)}</span>
      </span>
      <span className="relative flex items-center gap-2 text-ink-faint shrink-0">
        <ExternalLink className="w-4 h-4" />
        <MoveRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" style={{ color }} />
      </span>
    </a>
  )
}
