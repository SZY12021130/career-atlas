/**
 * 报考通道指南页（/guide）
 *
 * 单页四节 + 顶部 Tab 切换：公务员 / 选调 / 事业单位 / 人才引进，
 * 每节含「基本信息」与「考试信息」两大板块，附横向对比表、全年报考日历与全国级官方入口。
 *
 * 视觉：沿用全站深色科技风（font-serif 标题 + 分类语义色 + Framer Motion 入场）。
 * 内容：全部事实来自 src/lib/guide-data.ts，其中已核实数据标注 confirmed，
 *       规律性推断明确标注为「参考」，不做无依据断言。
 */
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  Globe,
  Info,
  Landmark,
  ListChecks,
  Scale,
  Sparkles,
  Users,
} from 'lucide-react'
import Breadcrumb from '@/components/Breadcrumb'
import HighlightKeywords from '@/components/HighlightKeywords'
import { CHANNELS, COMPARE_ROWS, CALENDAR, NATIONAL_PORTALS, GUIDE_UPDATED_AT } from '@/lib/guide-data'
import type { ChannelGuide, ChannelKey } from '@/lib/guide-data'
import { cn } from '@/lib/utils'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

// ---------------------------------------------------------------------------
// 页头 + Tab
// ---------------------------------------------------------------------------

function GuideHeader() {
  return (
    <header>
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
        <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '报考通道指南' }]} />
      </motion.div>

      <div className="mt-6 flex items-start gap-4">
        <motion.span
          className="w-1 rounded-full bg-cinnabar shrink-0 origin-top self-stretch"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
        <div className="min-w-0">
          <h1
            className="font-serif font-black text-ink leading-tight"
            style={{ fontSize: 'clamp(2rem, 4.4vw, 3.4rem)', letterSpacing: '0.02em' }}
          >
            {['报', '考', '通', '道', '指', '南'].map((ch, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 * i, ease: EASE }}
              >
                {ch}
              </motion.span>
            ))}
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
            className="mt-3 text-[15px] md:text-base text-ink-soft leading-7 max-w-4xl"
          >
            <HighlightKeywords text="公务员" variant="bold" />、<HighlightKeywords text="选调" variant="bold" />、
            <HighlightKeywords text="事业单位" variant="bold" />、<HighlightKeywords text="人才引进" variant="bold" />
            四类通道的编制性质、报考条件、考试科目、录用程序与年度时间线，一次讲清。内容依据官方法规文件与
            2026 年度已发布公告核实整理。
          </motion.p>
        </div>
      </div>
    </header>
  )
}

/** 顶部通道 Tab：分类色滑动选中态，移动端横向滚动 */
function ChannelTabs({
  value,
  onChange,
}: {
  value: ChannelKey
  onChange: (k: ChannelKey) => void
}) {
  return (
    <div className="sticky top-16 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-3 bg-paper/92 backdrop-blur-md border-y border-line">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {CHANNELS.map((c) => {
          const active = c.key === value
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange(c.key)}
              className={cn(
                'relative shrink-0 px-5 py-2 rounded-full text-sm transition-colors duration-200 border',
                active ? 'text-paper font-bold border-transparent' : 'text-ink-soft border-line bg-surface hover:text-ink',
              )}
              style={active ? { backgroundColor: c.color } : undefined}
            >
              {c.tab}
            </button>
          )
        })}
        <span className="shrink-0 ml-auto hidden md:flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Info className="w-3.5 h-3.5" />
          内容截至 {GUIDE_UPDATED_AT}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 通用块
// ---------------------------------------------------------------------------

function BlockTitle({
  icon: Icon,
  color,
  children,
  note,
}: {
  icon: LucideIcon
  color: string
  children: React.ReactNode
  note?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1F` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </span>
      <h2 className="font-serif font-bold text-[1.4rem] text-ink">{children}</h2>
      {note && <span className="text-xs text-ink-faint">{note}</span>}
    </div>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn('bg-surface rounded-2xl border border-line p-6 md:p-7', className)}
    >
      {children}
    </motion.div>
  )
}

/** 小标题 + 内容行 */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[7.5rem_1fr] gap-x-5 gap-y-1.5 py-3.5 border-b border-line/60 last:border-b-0">
      <div className="text-[13px] font-bold text-ink-faint md:pt-0.5">{label}</div>
      <div className="text-[13.5px] text-ink-soft leading-7 min-w-0">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 单通道内容
// ---------------------------------------------------------------------------

function ChannelSection({ ch }: { ch: ChannelGuide }) {
  return (
    <motion.div
      key={ch.key}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="space-y-12"
    >
      {/* 定位条 */}
      <div
        className="rounded-2xl border border-line p-5 md:p-6 flex items-start gap-4"
        style={{ backgroundColor: `${ch.color}0D`, borderColor: `${ch.color}33` }}
      >
        <Sparkles className="w-5 h-5 shrink-0 mt-0.5" style={{ color: ch.color }} />
        <div className="min-w-0">
          <div className="font-serif font-bold text-lg text-ink">
            <HighlightKeywords text={ch.title} variant="bold" />
          </div>
          <p className="mt-1.5 text-[13.5px] text-ink-soft leading-7">
            <HighlightKeywords text={ch.tagline} />
          </p>
        </div>
      </div>

      {/* 一、基本信息 */}
      <section>
        <BlockTitle icon={BookOpen} color={ch.color}>
          基本信息
        </BlockTitle>
        <Card>
          <FieldRow label="定义与定位">
            <HighlightKeywords text={ch.basic.definition} />
          </FieldRow>
          <FieldRow label="编制与身份">
            <HighlightKeywords text={ch.basic.identity} />
          </FieldRow>
          <FieldRow label="年龄口径">
            <HighlightKeywords text={ch.basic.age} />
          </FieldRow>
          <FieldRow label="政策依据">
            <ul className="space-y-1.5">
              {ch.basic.legal.map((l) => (
                <li key={l} className="flex items-start gap-2">
                  <Gavel className="w-3.5 h-3.5 shrink-0 mt-1.5" style={{ color: ch.color }} />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </FieldRow>
          <FieldRow label="报考条件">
            <ul className="space-y-1.5">
              {ch.basic.eligibility.map((e) => (
                <li key={e} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-1.5" style={{ color: ch.color }} />
                  <span>
                    <HighlightKeywords text={e} />
                  </span>
                </li>
              ))}
            </ul>
          </FieldRow>
        </Card>
      </section>

      {/* 二、考试信息 */}
      <section>
        <BlockTitle icon={ListChecks} color={ch.color}>
          考试信息
        </BlockTitle>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左：科目与组织 */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              <h3 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: ch.color }} />
                组织方式与笔试科目
              </h3>
              <p className="text-[13.5px] text-ink-soft leading-7 mb-5">
                <HighlightKeywords text={ch.exam.organizer} />
              </p>
              <div className="space-y-3">
                {ch.exam.subjects.map((s) => (
                  <div key={s.name} className="rounded-xl border border-line bg-paper/60 p-4">
                    <div className="text-[13px] font-bold text-ink mb-1.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                      {s.name}
                    </div>
                    <p className="text-[13px] text-ink-soft leading-6">
                      <HighlightKeywords text={s.detail} />
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: ch.color }} />
                面试与成绩合成
              </h3>
              <p className="text-[13.5px] text-ink-soft leading-7">
                <HighlightKeywords text={ch.exam.interview} />
              </p>
            </Card>
          </div>

          {/* 右：录用程序 */}
          <div className="lg:col-span-5">
            <Card className="h-full">
              <h3 className="text-sm font-bold text-ink mb-5 flex items-center gap-2">
                <Scale className="w-4 h-4" style={{ color: ch.color }} />
                录用程序
              </h3>
              <ol className="space-y-0">
                {ch.exam.procedure.map((p, i) => (
                  <li key={p} className="relative flex items-start gap-3.5 pb-4 last:pb-0">
                    {/* 连接线 */}
                    {i < ch.exam.procedure.length - 1 && (
                      <span
                        className="absolute left-[13px] top-7 bottom-0 w-px"
                        style={{ backgroundColor: `${ch.color}33` }}
                      />
                    )}
                    <span
                      className="relative z-10 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 font-num"
                      style={{ backgroundColor: `${ch.color}1F`, color: ch.color }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[13px] text-ink-soft leading-[26px] pt-0.5">
                      <HighlightKeywords text={p} />
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </section>

      {/* 三、年度时间线 */}
      <section>
        <BlockTitle icon={Calendar} color={ch.color} note="标注「已核实」的为官方公告确定日期，其余为历年规律参考">
          年度时间线
        </BlockTitle>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[640px]">
              <thead>
                <tr className="text-left text-ink-faint border-b border-line">
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap w-[15rem]">环节</th>
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap w-[17rem]">时间</th>
                  <th className="pb-3 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {ch.exam.timeline.map((t, i) => (
                  <tr
                    key={`${t.stage}-${i}`}
                    className={cn('border-b border-line/50 last:border-b-0', i % 2 === 0 ? 'bg-transparent' : 'bg-paper/40')}
                  >
                    <td className="py-3 pr-4 text-ink font-medium">
                      <HighlightKeywords text={t.stage} variant="bold" />
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        {t.confirmed ? (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: `${ch.color}26`, color: ch.color }}
                          >
                            已核实
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-line/50 text-ink-faint shrink-0">参考</span>
                        )}
                        <span className="text-ink-soft">{t.when}</span>
                      </span>
                    </td>
                    <td className="py-3 text-ink-soft leading-6">
                      {t.note ? <HighlightKeywords text={t.note} /> : <span className="text-ink-faint">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* 四、关键区别与提示 */}
      <section>
        <BlockTitle icon={Info} color={ch.color}>
          关键区别与报考提示
        </BlockTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ch.highlights.map((h) => (
            <Card key={h.title}>
              <h3 className="text-[13.5px] font-bold text-ink mb-2.5 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: ch.color }} />
                <HighlightKeywords text={h.title} variant="bold" />
              </h3>
              <p className="text-[13px] text-ink-soft leading-7">
                <HighlightKeywords text={h.body} />
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* 五、已核实的官方数据 */}
      <section>
        <BlockTitle icon={Landmark} color={ch.color} note="来源均为官方公告或官方公布数据">
          已核实的官方数据
        </BlockTitle>
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ch.verified.map((v) => (
              <div key={v.label} className="rounded-xl border border-line bg-paper/60 p-4">
                <div className="text-[11px] text-ink-faint mb-2 leading-5">{v.label}</div>
                <div className="font-num font-bold text-xl text-ink mb-2" style={{ color: ch.color }}>
                  <HighlightKeywords text={v.value} variant="bold" />
                </div>
                <div className="text-[11px] text-ink-faint leading-5">
                  <HighlightKeywords text={v.source} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// 横向对比表
// ---------------------------------------------------------------------------

const COMPARE_META: { key: ChannelKey; label: string; color: string }[] = [
  { key: 'gwy', label: '公务员', color: '#F0635A' },
  { key: 'xuandiao', label: '选调', color: '#F5A94B' },
  { key: 'shiye', label: '事业单位', color: '#3ED598' },
  { key: 'rencai', label: '人才引进', color: '#C084FC' },
]

function CompareSection({ onJump }: { onJump: (k: ChannelKey) => void }) {
  return (
    <section id="compare">
      <BlockTitle icon={Scale} color="#22D3EE" note="12 个维度横向对照，点击列标题跳到对应通道">
        四类通道横向对比
      </BlockTitle>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[900px]">
            <thead className="bg-paper-deep/70">
              <tr className="text-left">
                <th className="px-5 py-3.5 font-medium text-ink-faint whitespace-nowrap w-[9.5rem] sticky left-0 bg-paper-deep/95 backdrop-blur z-10">
                  对比维度
                </th>
                {COMPARE_META.map((c) => (
                  <th key={c.key} className="px-5 py-3.5 font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onJump(c.key)}
                      className="inline-flex items-center gap-1.5 hover:opacity-75 transition-opacity"
                      style={{ color: c.color }}
                    >
                      <HighlightKeywords text={c.label} variant="bold" />
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((r, i) => (
                <tr key={r.dim} className={cn('border-t border-line/60', i % 2 === 1 && 'bg-paper/40')}>
                  <td className="px-5 py-3.5 font-bold text-ink whitespace-nowrap sticky left-0 bg-surface z-10">
                    {r.dim}
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft leading-6 align-top">
                    <HighlightKeywords text={r.gwy} />
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft leading-6 align-top">
                    <HighlightKeywords text={r.xuandiao} />
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft leading-6 align-top">
                    <HighlightKeywords text={r.shiye} />
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft leading-6 align-top">
                    <HighlightKeywords text={r.rencai} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 全年报考日历
// ---------------------------------------------------------------------------

function CalendarSection() {
  const colorOf = (k: ChannelKey) => CHANNELS.find((c) => c.key === k)?.color ?? '#7A8BA8'
  const tabOf = (k: ChannelKey) => CHANNELS.find((c) => c.key === k)?.tab ?? k

  return (
    <section id="calendar">
      <BlockTitle icon={Calendar} color="#22D3EE" note="标注「已核实」的为 2026 年度官方公告确定日期">
        全年报考日历
      </BlockTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CALENDAR.map((m, i) => (
          <motion.div
            key={m.month}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: (i % 3) * 0.05, ease: EASE }}
            className="bg-surface rounded-2xl border border-line p-5"
          >
            <div className="flex items-baseline gap-2 mb-3.5 pb-2.5 border-b border-line">
              <span className="font-num font-bold text-2xl text-cinnabar tabular-nums">
                {m.month.replace(' 月', '')}
              </span>
              <span className="text-xs text-ink-faint">月</span>
            </div>
            <ul className="space-y-2.5">
              {m.items.map((it, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span
                    className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5"
                    style={{ backgroundColor: `${colorOf(it.channel)}26`, color: colorOf(it.channel) }}
                  >
                    {tabOf(it.channel)}
                  </span>
                  <span className="text-[12.5px] text-ink-soft leading-6 min-w-0">
                    <HighlightKeywords text={it.text} />
                    {it.confirmed && <span className="ml-1.5 text-[10px] text-pine">✓已核实</span>}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 全国级官方入口
// ---------------------------------------------------------------------------

function PortalsSection() {
  const colorOf = (k: ChannelKey) => CHANNELS.find((c) => c.key === k)?.color ?? '#7A8BA8'
  const tabOf = (k: ChannelKey) => CHANNELS.find((c) => c.key === k)?.tab ?? k

  return (
    <section id="portals">
      <BlockTitle icon={Globe} color="#22D3EE" note="全国级权威入口，省级与市级入口见各地城市页">
        全国级官方入口
      </BlockTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {NATIONAL_PORTALS.map((p) => (
          <motion.a
            key={p.url}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.45, ease: EASE }}
            whileHover={{ y: -4 }}
            className="group bg-surface rounded-2xl border border-line p-6 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)] transition-shadow"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-[15px] font-bold text-ink leading-snug">
                <HighlightKeywords text={p.name} variant="bold" />
              </h3>
              <ExternalLink className="w-4 h-4 text-ink-faint group-hover:text-cinnabar transition-colors shrink-0" />
            </div>
            <p className="text-[13px] text-ink-soft leading-6 mb-4">
              <HighlightKeywords text={p.scope} />
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {p.channels.map((k) => (
                <span
                  key={k}
                  className="px-2 py-0.5 rounded-full text-[11px]"
                  style={{ backgroundColor: `${colorOf(k)}1A`, color: colorOf(k) }}
                >
                  {tabOf(k)}
                </span>
              ))}
            </div>
          </motion.a>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

export default function GuidePage() {
  const location = useLocation()
  // 支持从首页专栏卡片带入目标通道：navigate('/guide', { state: { channel } })
  const initial = (location.state as { channel?: ChannelKey } | null)?.channel
  const [active, setActive] = useState<ChannelKey>(
    initial && CHANNELS.some((c) => c.key === initial) ? initial : 'gwy',
  )
  const ch = CHANNELS.find((c) => c.key === active) ?? CHANNELS[0]

  const jump = (k: ChannelKey) => {
    setActive(k)
    // 切 Tab 后回到内容顶部（对比表在页面下方，需要滚回 Tab 位置）
    requestAnimationFrame(() => {
      document.getElementById('channel-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="max-w-[1680px] mx-auto px-6 lg:px-10 py-10 md:py-14 space-y-14">
      <GuideHeader />

      {/* 四通道快速跳转卡（未选 Tab 时的总览入口） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CHANNELS.map((c) => (
          <motion.button
            key={c.key}
            type="button"
            onClick={() => jump(c.key)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'text-left rounded-2xl border p-5 transition-all duration-200',
              active === c.key ? 'bg-surface shadow-[0_12px_32px_-16px_rgba(0,0,0,.6)]' : 'bg-surface/60 hover:bg-surface',
            )}
            style={{ borderColor: active === c.key ? `${c.color}66` : undefined, borderLeft: `4px solid ${c.color}` }}
          >
            <div className="font-serif font-bold text-lg mb-1.5" style={{ color: c.color }}>
              {c.title}
            </div>
            <p className="text-[12px] text-ink-faint leading-5">
              <HighlightKeywords text={c.tagline} />
            </p>
          </motion.button>
        ))}
      </div>

      <ChannelTabs value={active} onChange={setActive} />

      <div id="channel-top" className="scroll-mt-36">
        <AnimatePresence mode="wait">
          <ChannelSection ch={ch} />
        </AnimatePresence>
      </div>

      <CompareSection onJump={jump} />
      <CalendarSection />
      <PortalsSection />

      {/* 免责与提示 */}
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center text-[13px] text-ink-faint leading-7 pt-4 border-t border-line"
      >
        本页「已核实」数据均来自官方公告原文与官方公布口径，「参考」项为历年规律归纳。
        <br />
        各省政策每年可能调整，报考前请务必回到报考地官方入口核对当年公告原文。
        <Link to="/about" className="text-cinnabar hover:underline ml-1">
          查看数据说明
        </Link>
      </motion.p>
    </div>
  )
}
