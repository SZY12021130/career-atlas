/**
 * 专栏页共享 UI：页头、筛选 chips、说明卡、官方入口、附件分组、底部联动条、空态。
 * 数据加载与纯工具见 ./useCityContext。
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, MoveRight } from 'lucide-react'
import type { Attachment, Portal } from '@/lib/data'
import Breadcrumb from '@/components/Breadcrumb'
import PortalCard from '@/components/PortalCard'
import AttachmentItem from '@/components/AttachmentItem'
import { cn } from '@/lib/utils'
import { provinceAdcodeOf } from './useCityContext'

// ---------------------------------------------------------------------------
// 页头
// ---------------------------------------------------------------------------

export interface ColumnHeaderProps {
  color: string
  title: string
  subtitle: string
  provinceName: string
  cityName: string
  adcode: number
  /** 右侧筛选控件（Tab / chips） */
  control?: React.ReactNode
}

/** 专栏页头：面包屑 + 分类色竖条（scaleY 动画）+ 标题字符 stagger + 副标 + 右侧筛选控件 */
export function ColumnHeader({ color, title, subtitle, provinceName, cityName, adcode, control }: ColumnHeaderProps) {
  return (
    <header>
      <Breadcrumb
        items={[
          { label: '首页', to: '/' },
          ...(provinceName ? [{ label: provinceName, to: `/province/${provinceAdcodeOf(adcode)}` }] : []),
          { label: cityName, to: `/city/${adcode}` },
          { label: title },
        ]}
      />
      <div className="mt-6 flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-stretch gap-4 min-w-0">
          <motion.span
            className="w-1 rounded-full origin-top shrink-0"
            style={{ backgroundColor: color }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
          <div className="min-w-0">
            <h1
              className="font-serif font-bold text-ink leading-tight"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '0.02em' }}
            >
              {Array.from(title).map((ch, i) => (
                <motion.span
                  key={`${ch}-${i}`}
                  className="inline-block"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.04 * i, ease: 'easeOut' }}
                >
                  {ch}
                </motion.span>
              ))}
            </h1>
            <motion.p
              className="mt-2 text-sm text-ink-soft"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {subtitle}
            </motion.p>
          </div>
        </div>
        {control && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
            className="shrink-0"
          >
            {control}
          </motion.div>
        )}
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// 筛选 chips / Tab（Framer Motion layoutId 滑动选中态）
// ---------------------------------------------------------------------------

export interface FilterChipsProps<T extends string> {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  color: string
  /** layoutId 命名空间，避免同页多个 chips 组冲突 */
  layoutId: string
  className?: string
}

export function FilterChips<T extends string>({ options, value, onChange, color, layoutId, className }: FilterChipsProps<T>) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1', className)}>
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'relative px-4 py-1.5 rounded-full text-[13px] transition-colors duration-200 whitespace-nowrap',
              active ? 'text-paper font-bold' : 'text-ink-soft hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: color }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10">{opt}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 说明卡 / 政策卡
// ---------------------------------------------------------------------------

export interface InfoCardProps {
  color: string
  title: string
  children: React.ReactNode
}

export function InfoCard({ color, title, children }: InfoCardProps) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
      className="bg-surface rounded-2xl border border-line p-6 overflow-hidden relative shadow-[0_1px_0_rgba(42,39,35,.04)]"
    >
      <span className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: color }} />
      <h3 className="font-sans font-bold text-ink text-base">{title}</h3>
      <div className="mt-3 text-[13px] text-ink-soft leading-relaxed">{children}</div>
    </motion.div>
  )
}

/** 说明卡容器：stagger 0.08s，进入视口触发 */
export function InfoCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="grid gap-4 md:grid-cols-3"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
    >
      {children}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// 区块标题
// ---------------------------------------------------------------------------

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('flex items-center gap-3 font-serif font-bold text-[1.75rem] text-ink', className)}>
      <span className="w-1.5 h-7 rounded-full bg-cinnabar shrink-0" />
      {children}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// 官方入口（市级不足时省级补齐并标注）
// ---------------------------------------------------------------------------

export interface PortalGridProps {
  cityPortals: Portal[]
  provincePortals: Portal[]
  /** 目标分类 */
  categories: string[]
  /** 市级入口不足该数量时用省级补齐 */
  fillTo?: number
}

export function PortalGrid({ cityPortals, provincePortals, categories, fillTo = 3 }: PortalGridProps) {
  const local = cityPortals.filter((p) => categories.includes(p.category))
  const filled: { portal: Portal; provincial: boolean }[] = local.map((p) => ({ portal: p, provincial: false }))
  if (filled.length < fillTo) {
    const seen = new Set(local.map((p) => p.name))
    for (const p of provincePortals.filter((p) => categories.includes(p.category))) {
      if (filled.length >= fillTo) break
      if (seen.has(p.name)) continue
      filled.push({ portal: p, provincial: true })
    }
  }

  if (filled.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-line p-10 flex flex-col items-center text-center">
        <img src="/map-empty.svg" alt="暂无数据" className="w-48 h-auto opacity-90" />
        <p className="mt-4 text-sm text-ink-faint">暂未收录该类官方入口。</p>
      </div>
    )
  }

  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
    >
      {filled.map(({ portal, provincial }) => (
        <motion.div
          key={`${portal.name}-${portal.url}`}
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } }}
          className="relative"
        >
          <PortalCard portal={portal} className="h-full" />
          {provincial && (
            <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[11px] border border-line bg-paper text-ink-faint pointer-events-none">
              省级入口
            </span>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// 附件区（年份分组折叠，height 动画）
// ---------------------------------------------------------------------------

export interface AttachmentGroupsProps {
  items: { year: number; attachment: Attachment }[]
  cityAdcode: number
}

export function AttachmentGroups({ items, cityAdcode }: AttachmentGroupsProps) {
  const groups = useMemo(() => {
    const byYear = new Map<number, Attachment[]>()
    for (const { year, attachment } of items) {
      const arr = byYear.get(year) ?? []
      arr.push(attachment)
      byYear.set(year, arr)
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0])
  }, [items])

  // 手动切换记录；未手动切换的年份默认「最新年展开、其余折叠」，无需 effect
  const [toggled, setToggled] = useState<Record<number, boolean>>({})
  const isOpen = (year: number) => toggled[year] ?? year === groups[0]?.[0]

  if (groups.length === 0) return null

  return (
    <div className="mt-6 space-y-3">
      <h3 className="text-sm font-bold text-ink-soft">附件下载</h3>
      {groups.map(([year, files]) => {
        const expanded = isOpen(year)
        return (
          <div key={year} className="bg-surface rounded-2xl border border-line overflow-hidden">
            <button
              type="button"
              onClick={() => setToggled((prev) => ({ ...prev, [year]: !expanded }))}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-paper-deep/40 transition-colors duration-150"
            >
              <span className="text-sm font-bold text-ink tabular-nums">
                {year} 年<span className="ml-2 text-xs font-normal text-ink-faint">{files.length} 个附件</span>
              </span>
              <ChevronDown
                className={cn('w-4 h-4 text-ink-faint transition-transform duration-300', expanded && 'rotate-180')}
              />
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-1 grid gap-2">
                    {files.map((a, i) => (
                      <AttachmentItem key={`${a.name}-${i}`} attachment={a} cityAdcode={cityAdcode} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 底部联动条
// ---------------------------------------------------------------------------

export interface BottomLinksProps {
  cityName: string
  adcode: number
  /** 当前专栏，其余两个显示为分类色链接 */
  current: 'xuandiao' | 'shiye' | 'rencai'
}

const LINK_META = [
  { key: 'xuandiao' as const, label: '选调专栏', color: '#C08A3E' },
  { key: 'shiye' as const, label: '事业单位专栏', color: '#3F6C5B' },
  { key: 'rencai' as const, label: '人才引进专栏', color: '#7D5A6B' },
]

export function BottomLinks({ cityName, adcode, current }: BottomLinksProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-surface rounded-2xl border border-line px-6 py-5 flex items-center gap-x-6 gap-y-3 flex-wrap"
    >
      <span className="text-sm text-ink-faint">查看 {cityName} 的</span>
      {LINK_META.filter((l) => l.key !== current).map((l) => (
        <Link
          key={l.key}
          to={`/city/${adcode}/${l.key}`}
          className="group inline-flex items-center gap-1.5 text-sm font-bold transition-colors duration-200"
          style={{ color: l.color }}
        >
          {l.label}
          <MoveRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      ))}
      <Link
        to={`/city/${adcode}`}
        className="group inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink transition-colors duration-200"
      >
        返回总览
        <MoveRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// 整页空态（城市数据完全缺失时）
// ---------------------------------------------------------------------------

export function PageEmpty({ text }: { text: string }) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-12 flex flex-col items-center text-center">
      <img src="/map-empty.svg" alt="暂无数据" className="w-56 h-auto opacity-90" />
      <p className="mt-4 text-sm text-ink-faint">{text}</p>
    </div>
  )
}
