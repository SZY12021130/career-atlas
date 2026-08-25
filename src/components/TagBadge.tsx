import { categoryColor } from '@/lib/theme'
import { cn } from '@/lib/utils'

const UNI_TAG_COLORS: Record<string, string> = {
  '985': '#F0635A',
  '211': '#F5A94B',
  '双一流': '#3ED598',
}

export interface TagBadgeProps {
  label: string
  /** category = 公告分类实心徽章；university = 高校描边徽章 */
  variant?: 'category' | 'university'
  className?: string
}

/** 分类 / 高校标签徽章（design.md §6 TagBadge） */
export default function TagBadge({ label, variant = 'category', className }: TagBadgeProps) {
  if (variant === 'university') {
    const color = UNI_TAG_COLORS[label] ?? '#22314B'
    const textColor = UNI_TAG_COLORS[label] ?? '#5E6C85'
    return (
      <span
        className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs border', className)}
        style={{ borderColor: color, color: textColor }}
      >
        {label}
      </span>
    )
  }
  const color = categoryColor(label)
  return (
    <span
      className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap', className)}
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {label}
    </span>
  )
}
