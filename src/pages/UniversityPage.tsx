import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  Globe,
  Users,
  ScrollText,
  Landmark,
  MapPin,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Building2,
  Briefcase,
  FileText,
  Compass,
} from 'lucide-react'
import Breadcrumb from '@/components/Breadcrumb'
import TagBadge from '@/components/TagBadge'
import ChannelCard from '@/components/university/ChannelCard'
import CityLinkCard from '@/components/university/CityLinkCard'
import { findUniversity, countRecruitments } from '@/components/university/university-data'
import type { UniversityRecord } from '@/components/university/university-data'
import { CATEGORY_COLORS } from '@/lib/theme'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

const container = (stagger: number, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
})
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}
const fadeLeft = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } },
}
const pop = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE } },
}

/** 区块标题 h2：Serif 700 + 左侧 6px 朱砂短竖线 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-serif font-bold text-ink text-[1.75rem] leading-tight">
      <span className="w-1.5 h-7 rounded-full bg-cinnabar shrink-0" />
      {children}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Section 1 · 页头
// ---------------------------------------------------------------------------

function Header({ record }: { record: UniversityRecord }) {
  const { university: uni, province } = record
  const initial = uni.name.charAt(0)
  return (
    <header className="mt-10 flex items-start gap-5 md:gap-7">
      {/* 校名首字印章：盖章感弹出 */}
      <motion.div
        initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-cinnabar flex items-center justify-center shrink-0 shadow-[0_8px_24px_-8px_rgba(181,73,58,.45)]"
      >
        <span className="font-serif font-black text-paper" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          {initial}
        </span>
      </motion.div>

      <div className="min-w-0">
        {/* 标题字符 stagger */}
        <motion.h1
          variants={container(0.04, 0.1)}
          initial="hidden"
          animate="show"
          className="font-serif font-bold text-ink leading-tight"
          style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
        >
          {Array.from(uni.name).map((ch, i) => (
            <motion.span key={`${ch}-${i}`} variants={fadeUp} className="inline-block">
              {ch}
            </motion.span>
          ))}
        </motion.h1>

        {/* 标签徽章行 */}
        {(uni.tags?.length ?? 0) > 0 && (
          <motion.div
            variants={container(0.06, 0.35)}
            initial="hidden"
            animate="show"
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            {uni.tags.map((tag) => (
              <motion.span key={tag} variants={pop} className="inline-flex">
                <TagBadge label={tag} variant="university" className="text-sm px-2.5 py-1" />
              </motion.span>
            ))}
          </motion.div>
        )}

        {/* 副行：省 · 市 */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.45, ease: EASE }}
          className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft"
        >
          <MapPin className="w-4 h-4 text-cinnabar" />
          {province.name} · {uni.city}
        </motion.p>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Section 2 · 官方渠道直达
// ---------------------------------------------------------------------------

function ChannelSection({ record }: { record: UniversityRecord }) {
  const { university: uni } = record
  return (
    <section className="mt-14">
      <SectionTitle>官方渠道直达</SectionTitle>
      <motion.div
        variants={container(0.08, 0.1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={fadeUp}>
          <ChannelCard
            icon={Globe}
            title="学校官网"
            desc="官方网站 · 学校概况与新闻"
            url={uni.website || null}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <ChannelCard
            icon={Users}
            title="人事处 / 人才招聘"
            desc="招聘公告 · 岗位需求 · 报名方式"
            url={uni.hrUrl || null}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <ChannelCard
            icon={ScrollText}
            title="人才引进政策"
            desc="引才待遇 · 安家补贴 · 职称政策"
            url={uni.talentPolicyUrl || null}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <ChannelCard
            icon={Landmark}
            title="所在城市人才政策"
            desc="市级人才政策与补贴（站内）"
            to={`/city/${uni.cityAdcode}/rencai`}
            className="h-full"
          />
        </motion.div>
      </motion.div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 3 · 同城就业联动
// ---------------------------------------------------------------------------

function CityLinkSection({ record }: { record: UniversityRecord }) {
  const { university: uni, city } = record
  const adcode = uni.cityAdcode
  const cards = [
    {
      icon: Compass,
      label: '公务员总览',
      desc: `${uni.city}公务员招录统计与官网入口`,
      to: `/city/${adcode}`,
      count: countRecruitments(city, '公务员'),
      color: CATEGORY_COLORS['公务员'],
    },
    {
      icon: FileText,
      label: '选调专栏',
      desc: '定向 / 普通选调公告与统计',
      to: `/city/${adcode}/xuandiao`,
      count: countRecruitments(city, '选调生'),
      color: CATEGORY_COLORS['选调生'],
    },
    {
      icon: Building2,
      label: '事业单位专栏',
      desc: '事业单位招聘与录用统计',
      to: `/city/${adcode}/shiye`,
      count: countRecruitments(city, '事业单位'),
      color: CATEGORY_COLORS['事业单位'],
    },
    {
      icon: Briefcase,
      label: '人才引进专栏',
      desc: '人才政策 · 补贴 · 公告统计',
      to: `/city/${adcode}/rencai`,
      count: countRecruitments(city, '人才引进'),
      color: CATEGORY_COLORS['人才引进'],
    },
  ]
  return (
    <section className="mt-16">
      <SectionTitle>{uni.city} · 公职就业信息</SectionTitle>
      <p className="mt-3 text-[13px] text-ink-faint">
        该校所在地市的公务员 / 选调 / 事业单位 / 人才引进统计
      </p>
      <motion.div
        variants={container(0.08, 0.1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {cards.map((c) => (
          <motion.div key={c.label} variants={fadeLeft}>
            <CityLinkCard {...c} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 4 · 同城高校墙
// ---------------------------------------------------------------------------

const PEER_LIMIT = 12

function PeerSection({ record }: { record: UniversityRecord }) {
  const { university: uni, peers } = record
  const [expanded, setExpanded] = useState(false)
  const visible = useMemo(
    () => (expanded ? peers : peers.slice(0, PEER_LIMIT)),
    [expanded, peers],
  )
  if (peers.length === 0) return null
  return (
    <section className="mt-16">
      <SectionTitle>{uni.city}其他本科高校</SectionTitle>
      <motion.div
        variants={container(0.02, 0.1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="mt-6 flex flex-wrap gap-2.5"
      >
        {visible.map((peer) => (
          <motion.span key={peer.name} variants={pop} className="inline-flex">
            <Link
              to={`/university/${encodeURIComponent(peer.name)}`}
              className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface border border-line text-sm text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-cinnabar/50 hover:shadow-[0_8px_20px_-10px_rgba(42,39,35,.2)]"
            >
              <GraduationCap className="w-4 h-4 text-ink-faint group-hover:text-cinnabar transition-colors duration-200" />
              {peer.name}
              {(peer.tags?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  {peer.tags.slice(0, 2).map((t) => (
                    <TagBadge key={t} label={t} variant="university" />
                  ))}
                </span>
              )}
            </Link>
          </motion.span>
        ))}
      </motion.div>
      {peers.length > PEER_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-cinnabar transition-colors duration-200"
        >
          {expanded ? (
            <>
              收起 <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              展开全部（共 {peers.length} 所） <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 加载 / 未收录态
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-64 rounded bg-paper-deep" />
      <div className="mt-10 flex items-start gap-6">
        <div className="w-20 h-20 rounded-2xl bg-paper-deep shrink-0" />
        <div className="flex-1">
          <div className="h-10 w-72 rounded bg-paper-deep" />
          <div className="mt-4 h-5 w-40 rounded bg-paper-deep" />
        </div>
      </div>
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-paper-deep" />
        ))}
      </div>
    </div>
  )
}

function NotFound({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="py-16 flex flex-col items-center text-center"
    >
      <img src="/map-empty.svg" alt="暂未收录" className="w-64 h-auto" />
      <h1 className="mt-8 font-serif font-bold text-ink text-2xl">暂未收录「{name}」</h1>
      <p className="mt-3 text-sm text-ink-soft max-w-md leading-7">
        高校数据按省份持续采集中，该校可能尚未入库。您可以返回全国地图，按省份浏览已收录的高校与公职信息。
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cinnabar text-paper text-sm font-medium hover:bg-cinnabar-deep transition-colors duration-200"
      >
        返回全国地图
      </Link>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

export default function UniversityPage() {
  const { name = '' } = useParams<{ name: string }>()
  const [record, setRecord] = useState<UniversityRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setRecord(null)
    findUniversity(name).then((r) => {
      if (!alive) return
      setRecord(r)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [name])

  const breadcrumbItems = record
    ? [
        { label: '首页', to: '/' as const },
        { label: record.province.name, to: `/province/${record.province.adcode}` },
        { label: record.university.city, to: `/city/${record.university.cityAdcode}` },
        { label: record.university.name },
      ]
    : [
        { label: '首页', to: '/' as const },
        { label: name || '高校' },
      ]

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <Breadcrumb items={breadcrumbItems} />

      {loading ? (
        <PageSkeleton />
      ) : !record ? (
        <NotFound name={name} />
      ) : (
        <>
          <Header record={record} />
          <ChannelSection record={record} />
          <CityLinkSection record={record} />
          <PeerSection record={record} />

          {/* Section 5 · 提示条 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mt-16 flex items-start gap-3 bg-surface rounded-2xl border border-line p-5"
          >
            <ShieldCheck className="w-4 h-4 mt-0.5 text-pine shrink-0" />
            <p className="text-[13px] text-ink-faint leading-6">
              高校招聘信息以人事处官网实时发布为准；本站收录链接更新于 {record.province.updatedAt || '未知日期'}。
            </p>
          </motion.div>
        </>
      )}
    </div>
  )
}
