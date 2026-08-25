import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as echarts from 'echarts'
import {
  Landmark,
  GraduationCap,
  Building2,
  FileText,
  Briefcase,
  Globe,
  FlaskConical,
  ShieldCheck,
  MousePointerClick,
  History,
  X,
} from 'lucide-react'
import EChart from '@/components/EChart'
import SearchBar from '@/components/SearchBar'
import StatCard from '@/components/StatCard'
import TagBadge from '@/components/TagBadge'
import { clearRecentCities, getRecentCities } from '@/lib/recent'
import type { RecentCity } from '@/lib/recent'
import {
  assetUrl,
  fetchGeo,
  fetchIndex,
  fetchProvince,
  aggregateNational,
  summarizeProvince,
  MUNICIPALITY_ADCODES,
} from '@/lib/data'
import type { DataIndex, GeoJSON, ProvinceData } from '@/lib/data'
import { CINNABAR, INK, provinceColor } from '@/lib/theme'

gsap.registerPlugin(ScrollTrigger)

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

// ---------------------------------------------------------------------------
// Section 1 · Hero
// ---------------------------------------------------------------------------

const TITLE_CHARS = ['一', '图', '览', '尽', '山', '河', '职', '途']
const HOT_CITIES = [
  { name: '北京市', to: '/city/110000' },
  { name: '上海市', to: '/city/310000' },
  { name: '深圳市', to: '/city/440300' },
  { name: '杭州市', to: '/city/330100' },
  { name: '成都市', to: '/city/510100' },
]

/** 山影背景：独立 GSAP 组件（载入淡入 + 滚动视差），与 Framer Motion 隔离 */
const HeroMountains = memo(function HeroMountains() {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 0.5, duration: 1.2, ease: 'power1.out' })
      gsap.to(el, {
        y: -140, // 约 0.3 倍滚动速率上移
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top top', end: 'bottom top', scrub: true },
      })
    })
    return () => ctx.revert()
  }, [])

  return (
    <img
      ref={ref}
      src={assetUrl('hero-ink-mountains.svg')}
      alt=""
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 w-full select-none"
      style={{ opacity: 0 }}
    />
  )
})

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative max-w-[1680px] mx-auto px-6 lg:px-10 pt-20 pb-40 md:pt-28 md:pb-56">
        {/* eyebrow */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[13px] tracking-[0.3em] text-ink-faint mb-8"
        >
          {['公务员', '选调', '事业单位', '人才引进'].map((w, i) => (
            <span key={w} className="flex items-center gap-3">
              {i > 0 && <span className="w-1.5 h-1.5 rounded-full bg-cinnabar inline-block" />}
              {w}
            </span>
          ))}
        </motion.p>

        {/* 主标题：字符级拆分 */}
        <h1
          className="font-serif font-black text-ink leading-tight mb-6"
          style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', letterSpacing: '0.02em' }}
        >
          {TITLE_CHARS.map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              style={i >= 4 ? { color: CINNABAR } : undefined}
              initial={{ opacity: 0, y: 30, rotate: 2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.05, ease: EASE }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>

        {/* 副标题 */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: EASE }}
          className="text-[17px] text-ink-soft max-w-2xl leading-relaxed mb-10"
        >
          覆盖全国 34 个省级行政区的公务员、选调生、事业单位与人才引进一手官方信息。
          点击地图任意省份，下钻至市、区县，直达官方公告与录用公示。
        </motion.p>

        {/* 全局搜索 */}
        <SearchBar className="max-w-2xl" delay={0.8} />

        {/* 最近访问（localStorage，v2.0 需求 2） */}
        <RecentCities />

        {/* 热搜提示 */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 1 } } }}
          className="mt-4 flex items-center flex-wrap gap-x-2 gap-y-1 text-[13px] text-ink-faint"
        >
          <motion.span variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>热门：</motion.span>
          {HOT_CITIES.map((c, i) => (
            <motion.span key={c.name} variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="flex items-center gap-2">
              {i > 0 && <span className="text-line">·</span>}
              <Link to={c.to} className="hover:text-cinnabar transition-colors duration-200">
                {c.name}
              </Link>
            </motion.span>
          ))}
        </motion.div>
      </div>
      <HeroMountains />
    </section>
  )
}

/** 最近访问城市快捷入口：访问过的城市以 chips 呈现，可一键清空 */
function RecentCities() {
  const [recent, setRecent] = useState<RecentCity[]>([])
  useEffect(() => {
    setRecent(getRecentCities())
  }, [])

  if (recent.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.9, ease: EASE }}
      className="mt-5 flex items-center flex-wrap gap-2"
    >
      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint shrink-0">
        <History className="w-3.5 h-3.5" />
        最近访问
      </span>
      {recent.map((c) => (
        <Link
          key={c.adcode}
          to={`/city/${c.adcode}`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-line bg-surface text-[13px] text-ink-soft hover:border-cinnabar hover:text-cinnabar transition-colors duration-200"
        >
          {c.name}
          <span className="text-[11px] text-ink-faint">{c.provinceName}</span>
        </Link>
      ))}
      <button
        type="button"
        aria-label="清空最近访问"
        onClick={() => {
          clearRecentCities()
          setRecent([])
        }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[12px] text-ink-faint hover:text-cinnabar transition-colors duration-200"
      >
        <X className="w-3 h-3" />
        清空
      </button>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Section 2 · 中国地图
// ---------------------------------------------------------------------------

interface MapSectionProps {
  index: DataIndex | null
  provinces: (ProvinceData | null)[]
}

function MapSection({ index, provinces }: MapSectionProps) {
  const navigate = useNavigate()
  const [geo, setGeo] = useState<GeoJSON | null>(null)
  const [hoverName, setHoverName] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true, margin: '-15% 0px' })

  const stats = useMemo(() => aggregateNational(index, provinces), [index, provinces])
  const summaryByAdcode = useMemo(() => {
    const m = new Map<number, { cities: number; universities: number; recruitments: number }>()
    for (const p of provinces) if (p) m.set(p.adcode, summarizeProvince(p))
    return m
  }, [provinces])

  useEffect(() => {
    let alive = true
    fetchGeo(100000).then(async (g) => {
      if (!alive || !g) return
      echarts.registerMap('china', g as never)
      setGeo(g)
    })
    return () => {
      alive = false
    }
  }, [])

  const option = useMemo((): echarts.EChartsOption => {
    if (!geo) return {}
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; data?: { adcode?: number } }
          const s = p.data?.adcode != null ? summaryByAdcode.get(p.data.adcode) : undefined
          const line = s
            ? `已收录 ${s.cities} 市 · ${s.universities} 所高校 · ${s.recruitments} 条公告`
            : '数据整理中'
          return `<div style="font-weight:700;margin-bottom:2px">${p.name}</div><div style="opacity:.8">${line}</div>`
        },
      },
      series: [
        {
          type: 'map',
          map: 'china',
          roam: true,
          scaleLimit: { min: 1, max: 5 },
          label: {
            show: true,
            fontSize: 14,
            color: INK,
            fontWeight: 'bold',
            textBorderColor: 'rgba(11,18,32,1)',
            textBorderWidth: 3,
          },
          labelLayout: {
            position: 'right',
            distance: 2,
          },
          itemStyle: { borderColor: '#0B1220', borderWidth: 1 },
          emphasis: {
            label: {
              show: true,
              fontWeight: 'bold',
              color: CINNABAR,
              fontSize: 13,
              textBorderColor: 'rgba(11,18,32,1)',
              textBorderWidth: 3,
            },
            itemStyle: {
              areaColor: '#1E3A5C',
              borderColor: CINNABAR,
              borderWidth: 2.5,
              shadowBlur: 24,
              shadowColor: 'rgba(34,211,238,.8)',
            },
          },
          select: { disabled: true },
          data: (geo.features ?? []).map((f, i) => ({
            name: f.properties.name,
            adcode: f.properties.adcode,
            itemStyle: { areaColor: provinceColor(f.properties.subFeatureIndex, i) },
          })),
          animationDurationUpdate: 600,
        } as never,
      ],
    }
  }, [geo, summaryByAdcode])

  const mapEvents = useMemo(
    () => ({
      click: (params: unknown) => {
        const p = params as { data?: { adcode?: number } }
        const adcode = p.data?.adcode
        if (adcode == null) return
        navigate(MUNICIPALITY_ADCODES.has(adcode) ? `/city/${adcode}` : `/province/${adcode}`)
      },
      mouseover: (params: unknown) => {
        const p = params as { componentType?: string; name?: string }
        if (p.componentType === 'series' && p.name) setHoverName(p.name)
      },
      mouseout: () => setHoverName(null),
    }),
    [navigate],
  )

  const sectionRef = useRef<HTMLElement>(null)

  return (
    <section id="map" ref={sectionRef} className="py-16 md:py-24">
      <div className="max-w-[1680px] mx-auto px-6 lg:px-10">
        <div className="mb-10">
          <h2 className="font-serif font-bold text-[1.75rem] text-ink flex items-center gap-3">
            <span className="w-1.5 h-7 bg-cinnabar rounded-full inline-block" />
            全国招录舆图
          </h2>
          <p className="mt-3 text-sm text-ink-soft">点击任意省份下钻至地级市地图；配色为均衡示意，不代表数值。</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 地图 */}
          <motion.div
            ref={wrapRef}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={inView ? { opacity: 1, scale: 1 } : undefined}
            transition={{ duration: 0.8, ease: EASE }}
            className="lg:col-span-8 relative bg-surface rounded-2xl border border-line shadow-[0_1px_0_rgba(0,0,0,.25)] overflow-hidden"
          >
            <div data-lenis-prevent className="h-[420px] lg:h-[640px] cursor-pointer">
              {geo ? (
                <EChart option={option} onEvents={mapEvents} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-ink-faint gap-3">
                  <img src={assetUrl('map-empty.svg')} alt="" className="w-40 h-auto opacity-80" />
                  <span className="text-sm">地图数据加载中…</span>
                </div>
              )}
            </div>
            {/* 图例说明条 */}
            <div className="absolute left-4 bottom-4 flex items-center gap-2 text-xs text-ink-faint bg-surface/85 backdrop-blur-sm rounded-full px-3 py-1.5 border border-line">
              <MousePointerClick className="w-3.5 h-3.5 text-cinnabar" />
              点击省份下钻至地级市地图 · 配色为均衡示意不代表数值
            </div>
          </motion.div>

          {/* 右侧信息面板 */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 self-start">
            <div className="bg-surface rounded-2xl border border-line p-6 shadow-[0_1px_0_rgba(0,0,0,.25)]">
              <h3 className="font-serif font-bold text-lg text-ink mb-1">全国总览</h3>
              <p className="text-xs text-ink-faint mb-4">
                数据更新：{stats.latestUpdate ?? '整理中'}
              </p>

              {/* hover 省份动态条 */}
              <AnimatePresence mode="popLayout">
                {hoverName && (
                  <motion.div
                    key={hoverName}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="mb-4 rounded-xl bg-cinnabar/10 text-cinnabar text-sm px-4 py-2.5 flex items-center gap-2"
                  >
                    <MousePointerClick className="w-4 h-4 shrink-0" />
                    正在浏览：{hoverName} → 点击查看详情
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-15% 0px' }}
                variants={{ show: { transition: { staggerChildren: 0.1 } } }}
                className="grid grid-cols-2 gap-4"
              >
                {[
                  { label: '覆盖省份', value: stats.provinces, color: CINNABAR },
                  { label: '收录城市', value: stats.cities, color: '#F5A94B' },
                  { label: '本科高校', value: stats.universities, color: '#3ED598' },
                  { label: '官方公告', value: stats.recruitments, color: '#C084FC' },
                ].map((s) => (
                  <motion.div key={s.label} variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}>
                    <StatCard color={s.color} label={s.label} value={s.value} className="p-5" />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 3 · 四大专栏
// ---------------------------------------------------------------------------

const COLUMNS = [
  {
    key: '公务员',
    icon: Landmark,
    color: '#F0635A',
    desc: '招录公告 · 职位表 · 录用公示——省考/国考市级岗位一站直达',
  },
  {
    key: '选调生',
    icon: GraduationCap,
    color: '#F5A94B',
    desc: '定向选调 · 普通选调分栏统计，报考条件与高校范围一览',
  },
  {
    key: '事业单位',
    icon: Building2,
    color: '#3ED598',
    desc: '事业编招聘公告、岗位分布与录用结果持续收录',
  },
  {
    key: '人才引进',
    icon: FileText,
    color: '#C084FC',
    desc: '高层次人才引进政策、补贴待遇与博士岗位汇总',
  },
]

function ColumnsSection() {
  return (
    <section className="py-16 md:py-24 bg-paper-deep/40">
      <div className="max-w-[1680px] mx-auto px-6 lg:px-10">
        <div className="mb-10">
          <h2 className="font-serif font-bold text-[1.75rem] text-ink flex items-center gap-3">
            <span className="w-1.5 h-7 bg-cinnabar rounded-full inline-block" />
            四大专栏 · 每个城市一份完整答卷
          </h2>
          <p className="mt-3 text-sm text-ink-soft">专栏数据以城市为粒度组织，请先选择城市。</p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {COLUMNS.map((col) => (
            <motion.button
              key={col.key}
              type="button"
              onClick={() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' })}
              variants={{ hidden: { opacity: 0, y: 32 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="group bg-surface rounded-2xl border border-line p-6 md:p-8 shadow-[0_1px_0_rgba(0,0,0,.25)] hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)] transition-shadow duration-200 flex flex-col"
            >
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center mb-5"
                style={{ backgroundColor: `${col.color}1A` }}
              >
                <col.icon className="w-6 h-6" style={{ color: col.color }} />
              </span>
              <h3 className="font-serif font-bold text-lg text-ink mb-2">{col.key}</h3>
              <p className="text-sm text-ink-soft leading-7 flex-1">{col.desc}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200" style={{ color: col.color }}>
                进入任意城市查看
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 4 · 预留标签
// ---------------------------------------------------------------------------

const RESERVED = [
  { label: '国企 / 央企', icon: Briefcase, to: '/reserved/guoqi' },
  { label: '互联网大厂', icon: Globe, to: '/reserved/dachang' },
  { label: '博士后', icon: FlaskConical, to: '/reserved/boshi' },
]

function ReservedSection() {
  const navigate = useNavigate()
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[1680px] mx-auto px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="bg-paper-deep rounded-2xl p-8 md:p-10 flex flex-col lg:flex-row lg:items-center gap-8"
        >
          <div className="flex-1">
            <h2 className="font-serif font-bold text-[1.75rem] text-ink mb-3">博士的出路不止一条</h2>
            <p className="text-sm text-ink-soft leading-7">
              国企央企、互联网大厂、博士后流动站——标签已就位，内容持续开发中。
            </p>
          </div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={{ show: { transition: { staggerChildren: 0.1 } } }}
            className="flex flex-wrap gap-3"
          >
            {RESERVED.map((t) => (
              <motion.button
                key={t.to}
                type="button"
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(t.to)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-ink/25 text-ink text-sm font-medium hover:bg-ink hover:text-paper hover:border-ink transition-colors duration-200"
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </motion.button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 4.5 · 全国级官方入口（国考 / 部委直属渠道）
// ---------------------------------------------------------------------------

const NATIONAL_PORTALS = [
  { name: '国家公务员局', desc: '中央机关及其直属机构考试录用', url: 'http://www.scs.gov.cn' },
  { name: '国考报名专题', desc: '国考公告·职位表·报名入口', url: 'http://bm.scs.gov.cn' },
  { name: '中国公共招聘网', desc: '人社部事业单位招聘全国平台', url: 'http://job.mohrss.gov.cn' },
  { name: '军队人才网', desc: '军队文职人员公开招考', url: 'http://81rc.81.cn' },
  { name: '国家大学生就业服务平台', desc: '教育部24365就业服务', url: 'https://www.ncss.cn' },
]

function NationalSection() {
  return (
    <section className="pb-16 md:pb-24">
      <div className="max-w-[1680px] mx-auto px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-7 bg-cinnabar rounded-full" />
            <h2 className="font-serif font-bold text-[1.75rem] text-ink">全国级官方入口</h2>
            <span className="text-xs text-ink-faint">国考 · 部委直属 · 军队文职</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {NATIONAL_PORTALS.map((p, i) => (
              <motion.a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
                whileHover={{ y: -4 }}
                className="group block bg-surface rounded-2xl border border-line border-l-4 border-l-cinnabar p-5 transition-shadow hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-ink">{p.name}</h3>
                  <Globe className="w-4 h-4 text-ink-faint group-hover:text-cinnabar transition-colors shrink-0" />
                </div>
                <p className="mt-2 text-xs text-ink-faint leading-5">{p.desc}</p>
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 4.6 · 最新公告速递（全国聚合）
// ---------------------------------------------------------------------------

interface LatestItem {
  title: string
  date: string | null
  category: string
  url: string
  cityName: string
  cityAdcode: number
  provinceName: string
}

function LatestSection({ provinces }: { provinces: (ProvinceData | null)[] }) {
  const items = useMemo<LatestItem[]>(() => {
    const all: LatestItem[] = []
    for (const p of provinces) {
      if (!p) continue
      for (const c of p.cities ?? []) {
        for (const r of c.recruitments ?? []) {
          all.push({
            title: r.title,
            date: r.date ?? null,
            category: r.category,
            url: r.url,
            cityName: c.name,
            cityAdcode: c.adcode,
            provinceName: p.name,
          })
        }
      }
    }
    return all
      .filter((i) => i.date)
      .sort((a, b) => (b.date! > a.date! ? 1 : -1))
      .slice(0, 10)
  }, [provinces])

  if (items.length === 0) return null

  return (
    <section className="pb-16 md:pb-24">
      <div className="max-w-[1680px] mx-auto px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-7 bg-cinnabar rounded-full" />
            <h2 className="font-serif font-bold text-[1.75rem] text-ink">最新公告速递</h2>
            <span className="text-xs text-ink-faint">来自各省官方招录网站 · 按发布日期排序</span>
          </div>
          <div className="bg-surface rounded-2xl border border-line divide-y divide-line overflow-hidden">
            {items.map((it, i) => (
              <motion.div
                key={`${it.cityAdcode}-${i}`}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
                className="flex items-center gap-4 px-5 md:px-7 py-4 hover:bg-paper-deep/50 transition-colors"
              >
                <span className="text-xs text-ink-faint tabular-nums shrink-0 w-24">{it.date}</span>
                <TagBadge label={it.category} />
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-sm text-ink truncate hover:text-cinnabar transition-colors"
                  title={it.title}
                >
                  {it.title}
                </a>
                <Link
                  to={`/city/${it.cityAdcode}`}
                  className="shrink-0 text-xs text-ink-faint hover:text-cinnabar transition-colors"
                >
                  {it.provinceName} · {it.cityName}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 5 · 数据说明条
// ---------------------------------------------------------------------------

function DataNote() {
  return (
    <section id="data-note" className="pb-16 md:pb-24">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto px-6 text-center text-[13px] text-ink-faint leading-7 flex items-center justify-center gap-2 flex-wrap"
      >
        <ShieldCheck className="w-4 h-4 text-pine shrink-0" />
        本站所有公告、附件均来自各官方招录网站原始发布，附件按『年份+省市+文档名称』规范命名，可直接下载。
      </motion.p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

export default function Home() {
  const [index, setIndex] = useState<DataIndex | null>(null)
  const [provinces, setProvinces] = useState<(ProvinceData | null)[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const idx = await fetchIndex()
      if (!alive) return
      setIndex(idx)
      if (idx) {
        const list = await Promise.all(idx.provinces.map((p) => fetchProvince(p.adcode)))
        if (alive) setProvinces(list)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // 跨页锚点：经 navigate('/', { state }) 回到首页后滚动定位 / 搜索聚焦
  const location = useLocation()
  useEffect(() => {
    const st = location.state as { scrollTo?: string; focusSearch?: boolean } | null
    if (!st) return
    const t = setTimeout(() => {
      if (st.focusSearch) {
        document.getElementById('global-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        document.getElementById('global-search-input')?.focus()
      } else if (st.scrollTo) {
        document.getElementById(st.scrollTo)?.scrollIntoView({ behavior: 'smooth' })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [location.state])

  return (
    <div className="min-h-[100dvh]">
      <Hero />
      <MapSection index={index} provinces={provinces} />
      <LatestSection provinces={provinces} />
      <ColumnsSection />
      <NationalSection />
      <ReservedSection />
      <DataNote />
    </div>
  )
}
