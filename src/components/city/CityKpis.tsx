import { motion } from 'framer-motion'
import StatCard from '@/components/StatCard'
import type { Recruitment } from '@/lib/data'
import { sumNullable } from './cityUtils'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

/** 「—」空态 KPI 卡：与 StatCard 同样式，但数字位显示破折号（无数据时不误导为 0） */
function DashStatCard({ color, label, hint }: { color: string; label: string; hint: string }) {
  return (
    <div className="relative bg-surface rounded-2xl border border-line p-6 shadow-[0_1px_0_rgba(0,0,0,.25)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[13px] text-ink-soft">{label}</span>
      </div>
      <div
        className="font-num font-semibold text-ink-faint leading-none"
        style={{ fontSize: 'clamp(2.25rem, 4vw, 3rem)', fontVariantNumeric: 'tabular-nums' }}
      >
        —
      </div>
      <div className="absolute right-5 bottom-4 text-xs text-ink-faint">{hint}</div>
    </div>
  )
}

export interface CityKpisProps {
  recruitments: Recruitment[]
  universityCount: number
}

/** Section 2 KPI 行：公告总数 / 招录人数合计 / 岗位数合计 / 本科高校数 */
export default function CityKpis({ recruitments, universityCount }: CityKpisProps) {
  const headcount = sumNullable(recruitments.map((r) => r.headcount))
  const positions = sumNullable(recruitments.map((r) => r.positions))

  return (
    <motion.div
      className="grid grid-cols-2 lg:grid-cols-4 gap-6"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
    >
      <motion.div variants={item}>
        <StatCard color="#F0635A" label="近三年公告总数" value={recruitments.length} suffix="条" hint="2024 年至今" />
      </motion.div>
      <motion.div variants={item}>
        {headcount === null ? (
          <DashStatCard color="#3ED598" label="近三年招录人数合计" hint="以公告披露为准" />
        ) : (
          <StatCard color="#3ED598" label="近三年招录人数合计" value={headcount} suffix="人" hint="以公告披露为准" />
        )}
      </motion.div>
      <motion.div variants={item}>
        {positions === null ? (
          <DashStatCard color="#F5A94B" label="岗位 / 职位数合计" hint="以公告披露为准" />
        ) : (
          <StatCard color="#F5A94B" label="岗位 / 职位数合计" value={positions} suffix="个" hint="以公告披露为准" />
        )}
      </motion.div>
      <motion.div variants={item}>
        <StatCard color="#C084FC" label="本科高校数" value={universityCount} suffix="所" />
      </motion.div>
    </motion.div>
  )
}
