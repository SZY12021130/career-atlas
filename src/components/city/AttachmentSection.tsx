import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Info } from 'lucide-react'
import AttachmentItem from '@/components/AttachmentItem'
import type { Attachment, Recruitment } from '@/lib/data'
import { assetUrl } from '@/lib/data'
import SectionTitle from './SectionTitle'

interface AttachmentRow {
  attachment: Attachment
  date: string
}

interface YearGroup {
  year: number
  items: AttachmentRow[]
}

export interface AttachmentSectionProps {
  recruitments: Recruitment[]
  cityAdcode: number
}

/** Section 6 · 附件下载：按年份倒序折叠面板（默认展开最新年） */
export default function AttachmentSection({ recruitments, cityAdcode }: AttachmentSectionProps) {
  const groups = useMemo<YearGroup[]>(() => {
    const map = new Map<number, AttachmentRow[]>()
    for (const r of recruitments) {
      for (const a of r.attachments ?? []) {
        const list = map.get(r.year) ?? []
        list.push({ attachment: a, date: r.date })
        map.set(r.year, list)
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, items]) => ({ year, items: items.sort((x, y) => y.date.localeCompare(x.date)) }))
  }, [recruitments])

  const [openYear, setOpenYear] = useState<number | null>(() => groups[0]?.year ?? null)

  return (
    <section>
      <SectionTitle>原始附件 · 规范命名 · 直接下载</SectionTitle>
      <p className="flex items-center gap-1.5 text-xs text-ink-faint -mt-4 mb-6">
        <Info className="w-3.5 h-3.5" />
        附件命名规范：年份+省市+文档名称
      </p>

      {groups.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-10 flex flex-col items-center text-center">
          <img src={assetUrl('map-empty.svg')} alt="暂无数据" className="w-48 h-auto opacity-90" />
          <p className="mt-4 text-sm text-ink-faint">暂无附件，已收录官方入口</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const open = openYear === g.year
            return (
              <div key={g.year} className="bg-surface rounded-2xl border border-line overflow-hidden shadow-[0_1px_0_rgba(42,39,35,.04)]">
                <button
                  onClick={() => setOpenYear(open ? null : g.year)}
                  className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-paper-deep/40 transition-colors duration-150"
                  aria-expanded={open}
                >
                  <span className="font-num font-semibold text-xl text-ink tabular-nums">{g.year}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-paper-deep text-ink-soft">{g.items.length} 个附件</span>
                  <ChevronDown
                    className={`w-4 h-4 ml-auto text-ink-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <motion.ul
                        className="px-6 pb-5 pt-1 space-y-3 border-t border-line/60"
                        initial="hidden"
                        animate="show"
                        variants={{ show: { transition: { staggerChildren: 0.03 } } }}
                      >
                        {g.items.map((row, i) => (
                          <motion.li
                            key={`${row.attachment.name}-${i}`}
                            variants={{
                              hidden: { opacity: 0, y: 8 },
                              show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
                            }}
                          >
                            <AttachmentItem attachment={row.attachment} cityAdcode={cityAdcode} />
                          </motion.li>
                        ))}
                      </motion.ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
