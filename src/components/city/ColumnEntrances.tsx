import { useEffect, useRef } from 'react'
import { animate, motion, useInView } from 'framer-motion'
import { ArrowRight, Briefcase, GraduationCap, Landmark } from 'lucide-react'
import { Link } from 'react-router'
import type { Recruitment } from '@/lib/data'
import { countByCategory } from './cityUtils'
import SectionTitle from './SectionTitle'

interface ColumnDef {
  key: 'xuandiao' | 'shiye' | 'rencai'
  title: string
  desc: string
  color: string
  category: string
  icon: typeof Landmark
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'xuandiao',
    title: '选调专栏',
    desc: '定向选调 · 普通选调 · 报考条件与录用统计',
    color: '#F5A94B',
    category: '选调生',
    icon: Landmark,
  },
  {
    key: 'shiye',
    title: '事业单位专栏',
    desc: '事业编招聘公告 · 岗位分布 · 录用公示',
    color: '#3ED598',
    category: '事业单位',
    icon: Briefcase,
  },
  {
    key: 'rencai',
    title: '人才引进专栏',
    desc: '高层次人才政策 · 博士岗位 · 补贴待遇',
    color: '#C084FC',
    category: '人才引进',
    icon: GraduationCap,
  },
]

/** 数字随卡片入场计数（framer-motion animate，1.2s） */
function CountUp({ value, start }: { value: number; start: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!start || !ref.current) return
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = Math.round(v).toLocaleString('zh-CN')
      },
    })
    return () => controls.stop()
  }, [value, start])
  return <span ref={ref}>0</span>
}

function ColumnCard({ def, adcode, count, index }: { def: ColumnDef; adcode: string; count: number; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const Icon = def.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
    >
      <Link
        ref={ref}
        to={`/city/${adcode}/${def.key}`}
        className="group relative flex items-center gap-5 bg-surface rounded-2xl border border-line p-6 overflow-hidden shadow-[0_1px_0_rgba(0,0,0,.25)] transition-shadow duration-200 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]"
      >
        {/* hover 分类色 4% 底 */}
        <span
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{ backgroundColor: `${def.color}0A` }}
        />
        <span
          className="relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${def.color}14` }}
        >
          <Icon className="w-5 h-5" style={{ color: def.color }} />
        </span>
        <span className="relative flex-1 min-w-0">
          <span className="block font-serif font-bold text-lg text-ink">{def.title}</span>
          <span className="block text-[13px] text-ink-faint mt-0.5 truncate">{def.desc}</span>
        </span>
        <span className="relative text-right shrink-0 hidden sm:block">
          <span className="block font-num font-semibold text-2xl text-ink leading-none tabular-nums">
            <CountUp value={count} start={inView} />
          </span>
          <span className="block text-xs text-ink-faint mt-1">近三年公告</span>
        </span>
        <ArrowRight
          className="relative w-6 h-6 text-ink-faint shrink-0 transition-transform duration-200 group-hover:translate-x-2"
          style={{ color: undefined }}
        />
      </Link>
    </motion.div>
  )
}

export interface ColumnEntrancesProps {
  adcode: string
  recruitments: Recruitment[]
}

/** Section 4 · 三大专栏入口通栏卡 */
export default function ColumnEntrances({ adcode, recruitments }: ColumnEntrancesProps) {
  return (
    <section>
      <SectionTitle>三大专栏 · 深入查看</SectionTitle>
      <div className="flex flex-col gap-4">
        {COLUMNS.map((def, i) => (
          <ColumnCard key={def.key} def={def} adcode={adcode} count={countByCategory(recruitments, def.category)} index={i} />
        ))}
      </div>
    </section>
  )
}
