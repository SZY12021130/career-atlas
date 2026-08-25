import { motion } from 'framer-motion'
import { ArrowRight, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import TagBadge from '@/components/TagBadge'
import type { University } from '@/lib/data'
import SectionTitle from './SectionTitle'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

export interface UniversityGridProps {
  universities: University[]
  cityName: string
}

/** Section 7 · 本市高校：UniversityCard 网格，点击 → /university/:name */
export default function UniversityGrid({ universities, cityName }: UniversityGridProps) {
  return (
    <section>
      <SectionTitle>本科高校 · 共 {universities.length} 所</SectionTitle>
      {universities.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-10 flex flex-col items-center text-center">
          <img src="/map-empty.svg" alt="暂无数据" className="w-48 h-auto opacity-90" />
          <p className="mt-4 text-sm text-ink-faint">{cityName}暂无本科高校收录</p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {universities.map((u) => (
            <motion.div key={u.name} variants={item} className="h-full">
              <Link
                to={`/university/${encodeURIComponent(u.name)}`}
                className="group flex flex-col h-full bg-surface rounded-2xl border border-line p-6 shadow-[0_1px_0_rgba(42,39,35,.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(42,39,35,.18)]"
              >
                <h3 className="font-serif font-bold text-lg text-ink group-hover:text-cinnabar transition-colors duration-200">
                  {u.name}
                </h3>
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  {u.tags.map((t) => (
                    <TagBadge key={t} label={t} variant="university" />
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-faint">
                  <MapPin className="w-3.5 h-3.5" />
                  {u.city}
                </p>
                <span className="mt-auto pt-4 inline-flex items-center gap-1 text-[13px] text-cinnabar">
                  查看详情
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}
