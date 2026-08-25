import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import PortalCard from '@/components/PortalCard'
import type { Portal } from '@/lib/data'
import { categoryColor } from '@/lib/theme'
import SectionTitle from './SectionTitle'

/** 固定展示的五大官网分类（缺失分类灰态「暂未收录」） */
const EXPECTED = ['公务员', '事业单位', '选调', '人才引进', '录用公示'] as const

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
}

export interface PortalGridProps {
  portals: Portal[]
}

/** Section 3 · 官方网站直达：PortalCard 网格 + 缺失分类灰态占位 */
export default function PortalGrid({ portals }: PortalGridProps) {
  return (
    <section>
      <SectionTitle>官方网站 · 招聘与录用信息直达</SectionTitle>
      {portals.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line p-10 flex flex-col items-center text-center">
          <img src="/map-empty.svg" alt="暂无数据" className="w-48 h-auto opacity-90" />
          <p className="mt-4 text-sm text-ink-faint">数据整理中，已收录官方入口</p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
        >
          {portals.map((p) => (
            <motion.div key={`${p.category}-${p.name}`} variants={item}>
              <PortalCard portal={p} />
            </motion.div>
          ))}
          {EXPECTED.filter((c) => !portals.some((p) => p.category === c)).map((c) => (
            <motion.div key={c} variants={item}>
              <div
                className="relative flex items-center gap-4 rounded-2xl border border-dashed border-line p-5 pl-6 opacity-60 select-none"
                style={{ borderLeft: `4px solid ${categoryColor(c)}` }}
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-sans font-bold text-ink-faint truncate">{c}类官网</span>
                  <span className="block text-xs text-ink-faint mt-1">暂未收录</span>
                </span>
                <ExternalLink className="w-4 h-4 text-line shrink-0" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}
