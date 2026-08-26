import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import RecruitmentTable from '@/components/RecruitmentTable'
import type { Recruitment, RecruitmentCategory } from '@/lib/data'
import { CINNABAR, categoryColor } from '@/lib/theme'
import { FILTER_CATEGORIES } from './cityUtils'
import SectionTitle from './SectionTitle'

const PAGE_SIZE = 10

export interface AnnouncementSectionProps {
  recruitments: Recruitment[]
}

/** Section 5 · 公告列表：分类筛选 chips（选中实心分类色）+ RecruitmentTable + 加载更多 */
export default function AnnouncementSection({ recruitments }: AnnouncementSectionProps) {
  const [filter, setFilter] = useState<'全部' | RecruitmentCategory>('全部')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const changeFilter = (c: '全部' | RecruitmentCategory) => {
    setFilter(c)
    setLimit(PAGE_SIZE)
  }

  const sorted = useMemo(() => [...recruitments].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')), [recruitments])
  const filtered = useMemo(
    () => (filter === '全部' ? sorted : sorted.filter((r) => r.category === filter)),
    [sorted, filter],
  )
  const visible = filtered.slice(0, limit)

  const chips = (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTER_CATEGORIES.map((c) => {
        const active = c === filter
        const color = c === '全部' ? CINNABAR : categoryColor(c)
        return (
          <button
            key={c}
            onClick={() => changeFilter(c)}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition-all duration-200 ${
              active ? 'border-transparent text-paper' : 'border-line text-ink-soft hover:border-cinnabar hover:text-cinnabar bg-surface'
            }`}
            style={active ? { backgroundColor: color } : undefined}
          >
            {c}
          </button>
        )
      })}
    </div>
  )

  return (
    <section>
      <SectionTitle extra={chips}>官方公告 · 2024 至今</SectionTitle>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <RecruitmentTable
            recruitments={visible}
            emptyText={filter === '全部' ? '数据整理中，已收录官方入口' : '该类别暂无数据，已收录官方入口'}
          />
          {filtered.length > limit && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-ink text-paper text-sm hover:bg-cinnabar transition-colors duration-200"
              >
                加载更多（剩余 {filtered.length - limit} 条）
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
