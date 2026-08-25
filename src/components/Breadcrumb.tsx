import { Fragment } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  to?: string
}

/** 层级路径：首页 / 广东省 / 广州市 / 选调专栏 */
export default function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="面包屑" className={cn('text-[13px] flex items-center flex-wrap gap-x-2 gap-y-1', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && <span className="text-line select-none">/</span>}
            {item.to && !isLast ? (
              <Link to={item.to} className="text-ink-faint hover:text-cinnabar transition-colors duration-200">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-ink font-bold' : 'text-ink-faint'}>{item.label}</span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
