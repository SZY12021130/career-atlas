import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, GraduationCap, MapPin, Search } from 'lucide-react'
import { buildSearchIndex, search } from '@/lib/search'
import type { GroupedResults, SearchItem } from '@/lib/search'
import { cn } from '@/lib/utils'

const GROUP_ICONS = { 城市: MapPin, 区县: Building2, 高校: GraduationCap } as const

export interface SearchBarProps {
  className?: string
  placeholder?: string
  /** 入场动画延迟（首页 Hero 用 0.8s） */
  delay?: number
}

/**
 * 全局模糊搜索（design.md §6 SearchBar）。
 * 实时匹配城市/区县/高校，分组下拉，键盘 ↑↓ Enter Esc。
 */
export default function SearchBar({
  className,
  placeholder = '输入城市 / 区县 / 高校名称，例如：广州、海淀区、中山大学',
  delay = 0,
}: SearchBarProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [indexReady, setIndexReady] = useState<SearchItem[]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    buildSearchIndex().then((idx) => {
      if (alive) setIndexReady(idx)
    })
    return () => {
      alive = false
    }
  }, [])

  // 点击外部关闭
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const groups: GroupedResults[] = useMemo(() => search(indexReady, query), [indexReady, query])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  const go = (item: SearchItem) => {
    setOpen(false)
    setQuery('')
    navigate(item.to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((v) => (flat.length ? (v + 1) % flat.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((v) => (flat.length ? (v - 1 + flat.length) % flat.length : -1))
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && flat[active]) {
        e.preventDefault()
        go(flat[active])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const showEmpty = open && query.trim().length > 0 && groups.length === 0
  let runningIndex = -1

  return (
    <motion.div
      ref={rootRef}
      id="global-search"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative w-full', className)}
    >
      <div
        className={cn(
          'flex items-center gap-4 h-[72px] md:h-20 px-6 md:px-7 rounded-2xl border-2 bg-surface transition-all duration-[250ms]',
          'border-line focus-within:border-cinnabar focus-within:shadow-[0_0_0_4px_rgba(34,211,238,.15),0_12px_32px_-12px_rgba(0,0,0,.45)]',
        )}
      >
        <Search className="w-6 h-6 md:w-7 md:h-7 text-ink-faint shrink-0" />
        <input
          ref={inputRef}
          id="global-search-input"
          type="text"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 bg-transparent outline-none text-lg md:text-xl text-ink placeholder:text-ink-faint"
        />
      </div>

      <AnimatePresence>
        {open && query.trim().length > 0 && (groups.length > 0 || showEmpty) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full mt-2 bg-surface rounded-2xl border border-line shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)] overflow-hidden z-40"
          >
            {showEmpty && (
              <div className="px-5 py-6 text-sm text-ink-faint text-center">未找到，试试输入城市全称</div>
            )}
            {groups.map((g) => {
              const Icon = GROUP_ICONS[g.group]
              return (
                <div key={g.group}>
                  <div className="px-5 pt-3 pb-1 text-xs text-ink-faint flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {g.group}
                  </div>
                  {g.items.map((item) => {
                    runningIndex++
                    const idx = runningIndex
                    return (
                      <button
                        key={`${item.group}-${item.name}-${item.to}`}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(item)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors duration-150',
                          idx === active ? 'bg-paper-deep/60' : 'bg-transparent',
                        )}
                      >
                        <span className="text-sm text-ink truncate">{item.name}</span>
                        <span className="text-xs text-ink-faint shrink-0">{item.context}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
            <div className="px-5 py-2 border-t border-line/60 text-[11px] text-ink-faint">
              ↑↓ 选择 · Enter 跳转 · Esc 关闭
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
