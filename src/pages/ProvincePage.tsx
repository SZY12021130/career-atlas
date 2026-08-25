import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { motion } from 'framer-motion'
import * as echarts from 'echarts'
import { ArrowLeft, ChevronRight, GraduationCap, MapPin, MousePointerClick } from 'lucide-react'
import Breadcrumb from '@/components/Breadcrumb'
import ChartCard from '@/components/ChartCard'
import EChart from '@/components/EChart'
import PortalCard from '@/components/PortalCard'
import TagBadge from '@/components/TagBadge'
import {
  assetUrl,
  fetchGeo,
  fetchIndex,
  fetchProvince,
  summarizeProvince,
  MUNICIPALITY_ADCODES,
} from '@/lib/data'
import type { City, GeoJSON, ProvinceData, RecruitmentCategory, University } from '@/lib/data'
import {
  CINNABAR,
  INK,
  INK_FAINT,
  INK_SOFT,
  categoryColor,
  provinceColor,
} from '@/lib/theme'
import { cn } from '@/lib/utils'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

/** 省级入口固定四类（province.md §3） */
const PORTAL_SLOTS = ['公务员', '事业单位', '选调', '人才引进'] as const

const DONUT_CATEGORIES: RecruitmentCategory[] = ['公务员', '选调生', '事业单位', '人才引进', '录用公示']

interface CityStat {
  adcode: number
  name: string
  recruitments: number
  universities: number
}

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

export default function ProvincePage() {
  const { adcode: adcodeParam } = useParams<{ adcode: string }>()
  const adcode = Number(adcodeParam)

  const [province, setProvince] = useState<ProvinceData | null>(null)
  const [geo, setGeo] = useState<GeoJSON | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [fallbackName, setFallbackName] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(adcode)) return
    let alive = true
    setLoaded(false)
    setProvince(null)
    setGeo(null)

    fetchIndex().then((idx) => {
      if (!alive || !idx) return
      const entry = idx.provinces.find((p) => p.adcode === adcode)
      if (entry) setFallbackName(entry.name)
    })

    const mapName = `province-${adcode}`
    Promise.all([
      fetchProvince(adcode),
      fetchGeo(adcode).then((g) => {
        if (g) echarts.registerMap(mapName, g as never)
        return g
      }),
    ]).then(([p, g]) => {
      if (!alive) return
      setProvince(p)
      setGeo(g)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [adcode])

  // 直辖市（京津沪渝）不经过本页，直接跳城市页
  if (MUNICIPALITY_ADCODES.has(adcode)) {
    return <Navigate to={`/city/${adcode}`} replace />
  }

  const name = province?.name ?? fallbackName ?? `省份 ${adcodeParam ?? ''}`
  const hasData = province !== null

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 md:py-16">
      <HeaderSection province={province} name={name} loaded={loaded} />

      {!loaded ? (
        <LoadingBlock />
      ) : !hasData && !geo ? (
        <EmptyBlock />
      ) : (
        <>
          <MapSection adcode={adcode} province={province} geo={geo} />
          {hasData && (
            <>
              <PortalsSection province={province} />
              <StatsSection province={province} />
              <UniversitiesSection province={province} />
            </>
          )}
          {!hasData && (
            <div className="mt-16">
              <EmptyBlock compact />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 1 · 页头
// ---------------------------------------------------------------------------

function HeaderSection({ province, name, loaded }: { province: ProvinceData | null; name: string; loaded: boolean }) {
  const summary = summarizeProvince(province)
  return (
    <header>
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <Breadcrumb items={[{ label: '首页', to: '/' }, { label: name }]} />
      </motion.div>

      <div className="mt-6 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-4 flex-wrap">
            <h1
              className="font-serif font-bold text-ink tracking-[0.02em]"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
              aria-label={name}
            >
              {name.split('').map((ch, i) => (
                <motion.span
                  key={`${ch}-${i}`}
                  className="inline-block"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.1 + i * 0.04 }}
                >
                  {ch}
                </motion.span>
              ))}
            </h1>
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="px-2.5 py-1 rounded-full border border-line bg-surface text-xs text-ink-faint"
            >
              省级行政区
            </motion.span>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-3 text-sm text-ink-soft"
          >
            {loaded && province
              ? `下辖 ${summary.cities} 个地级市 · 收录 ${summary.universities} 所本科高校 · ${summary.recruitments} 条官方公告 · 更新于 ${province.updatedAt}`
              : loaded
                ? '该省招录数据整理中'
                : '数据加载中…'}
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.4 }}>
          <Link
            to="/"
            state={{ scrollTo: 'map' }}
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-cinnabar transition-colors duration-200 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            返回全国地图
          </Link>
        </motion.div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Section 2 · 省级地图 + 省内速览面板
// ---------------------------------------------------------------------------

function MapSection({ adcode, province, geo }: { adcode: number; province: ProvinceData | null; geo: GeoJSON | null }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState<string | null>(null)
  const [chart, setChart] = useState<echarts.ECharts | null>(null)
  const handleReady = useCallback((c: echarts.ECharts) => setChart(c), [])

  /** 城市统计（adcode / 名称 双键索引，兼容 geo 与 data 的名称差异） */
  const { statByAdcode, statByName } = useMemo(() => {
    const byAdcode = new Map<number, CityStat>()
    const byName = new Map<string, CityStat>()
    for (const city of province?.cities ?? []) {
      const stat: CityStat = {
        adcode: city.adcode,
        name: city.name,
        recruitments: city.recruitments?.length ?? 0,
        universities: (province?.universities ?? []).filter((u) => u.cityAdcode === city.adcode || u.city === city.name).length,
      }
      byAdcode.set(city.adcode, stat)
      byName.set(city.name, stat)
      // geo 名称常带「市」后缀归一化匹配
      byName.set(city.name.replace(/(市|地区|盟|自治州|州)$/, ''), stat)
    }
    return { statByAdcode: byAdcode, statByName: byName }
  }, [province])

  const lookup = useCallback(
    (featureName: string, featureAdcode: number | undefined): CityStat | undefined => {
      if (featureAdcode != null && statByAdcode.has(featureAdcode)) return statByAdcode.get(featureAdcode)
      return (
        statByName.get(featureName) ??
        statByName.get(featureName.replace(/(市|地区|盟|自治州|州)$/, ''))
      )
    },
    [statByAdcode, statByName],
  )

  /** 城市列表：优先 data.cities 顺序，geo 中多出的板块补在末尾 */
  const cityRows = useMemo((): CityStat[] => {
    const rows: CityStat[] = []
    const seen = new Set<number>()
    for (const city of province?.cities ?? []) {
      const stat = statByAdcode.get(city.adcode)
      if (stat) {
        rows.push(stat)
        seen.add(stat.adcode)
      }
    }
    for (const f of geo?.features ?? []) {
      const fAdcode = f.properties.adcode
      if (seen.has(fAdcode)) continue
      const stat = lookup(f.properties.name, fAdcode)
      if (stat && !seen.has(stat.adcode)) {
        seen.add(stat.adcode)
        rows.push(stat)
      } else if (!stat) {
        seen.add(fAdcode)
        rows.push({ adcode: fAdcode, name: f.properties.name, recruitments: 0, universities: 0 })
      }
    }
    return rows
  }, [province, geo, statByAdcode, lookup])

  const topCity = useMemo(() => {
    let top: CityStat | null = null
    for (const r of cityRows) if (r.recruitments > (top?.recruitments ?? -1)) top = r
    return top && top.recruitments > 0 ? top : null
  }, [cityRows])

  const option = useMemo((): echarts.EChartsOption => {
    if (!geo) return {}
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; data?: { adcode?: number } }
          const s = lookup(p.name, p.data?.adcode)
          const line = s ? `公告 ${s.recruitments} 条 · 高校 ${s.universities} 所` : '数据整理中'
          return `<div style="font-weight:700;margin-bottom:2px">${p.name}</div><div style="opacity:.8">${line}</div>`
        },
      },
      series: [
        {
          type: 'map',
          map: `province-${adcode}`,
          roam: true,
          scaleLimit: { min: 1, max: 4 },
          label: { show: true, fontSize: 10, color: INK_SOFT },
          itemStyle: { borderColor: '#FDFBF5', borderWidth: 1 },
          emphasis: {
            label: { show: true, fontWeight: 'bold', color: INK, fontSize: 11 },
            itemStyle: {
              borderColor: CINNABAR,
              borderWidth: 2,
              shadowBlur: 12,
              shadowColor: 'rgba(42,39,35,.25)',
              shadowOffsetY: 4,
            },
          },
          select: { disabled: true },
          data: (geo.features ?? []).map((f, i) => {
            const stat = lookup(f.properties.name, f.properties.adcode)
            return {
              name: f.properties.name,
              adcode: stat?.adcode ?? f.properties.adcode,
              itemStyle: { areaColor: provinceColor(f.properties.subFeatureIndex, i) },
            }
          }),
          animationDurationUpdate: 100,
        } as never,
      ],
    }
  }, [geo, adcode, lookup])

  const mapEvents = useMemo(
    () => ({
      click: (params: unknown) => {
        const p = params as { data?: { adcode?: number } }
        if (p.data?.adcode != null) navigate(`/city/${p.data.adcode}`)
      },
      mouseover: (params: unknown) => {
        const p = params as { componentType?: string; name?: string }
        if (p.componentType === 'series' && p.name) setHovered(p.name)
      },
      mouseout: () => setHovered(null),
    }),
    [navigate],
  )

  /** 列表 hover → 地图板块高亮（双向联动的列表侧） */
  const prevHover = useRef<string | null>(null)
  useEffect(() => {
    if (!chart) return
    if (prevHover.current && prevHover.current !== hovered) {
      chart.dispatchAction({ type: 'downplay', seriesIndex: 0, name: prevHover.current })
    }
    if (hovered) chart.dispatchAction({ type: 'highlight', seriesIndex: 0, name: hovered })
    prevHover.current = hovered
  }, [chart, hovered])

  const hoveredRow = useMemo(
    () => (hovered ? cityRows.find((r) => r.name === hovered || lookup(hovered, undefined)?.adcode === r.adcode) : undefined),
    [hovered, cityRows, lookup],
  )

  return (
    <section className="mt-12 md:mt-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 地图 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="lg:col-span-8 relative bg-surface rounded-2xl border border-line shadow-[0_1px_0_rgba(42,39,35,.04)] overflow-hidden"
        >
          {/* 左上图例 */}
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-xs text-ink-faint bg-surface/85 backdrop-blur-sm rounded-full px-3 py-1.5 border border-line">
            <MousePointerClick className="w-3.5 h-3.5 text-cinnabar" />
            点击城市进入详情
          </div>
          <div data-lenis-prevent className="h-[380px] lg:h-[560px] cursor-pointer">
            {geo ? (
              <EChart option={option} onEvents={mapEvents} onReady={handleReady} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-ink-faint gap-3">
                <img src={assetUrl('map-empty.svg')} alt="" className="w-40 h-auto opacity-80" />
                <span className="text-sm">地图数据整理中</span>
              </div>
            )}
          </div>
          {/* 底部脚注 */}
          <div className="absolute left-4 bottom-4 text-xs text-ink-faint bg-surface/85 backdrop-blur-sm rounded-full px-3 py-1.5 border border-line">
            配色为均衡示意，不代表数值
          </div>
        </motion.div>

        {/* 右侧「省内速览」面板 */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 self-start w-full">
          <div className="bg-surface rounded-2xl border border-line p-6 shadow-[0_1px_0_rgba(42,39,35,.04)]">
            <h3 className="font-serif font-bold text-lg text-ink mb-1">省内速览</h3>
            <p className="text-xs text-ink-faint mb-4">共 {cityRows.length} 个地级行政区</p>

            {cityRows.length > 0 ? (
              <motion.ul
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } } }}
                className="max-h-96 overflow-y-auto -mx-2 px-2 divide-y divide-line/60"
                data-lenis-prevent
              >
                {cityRows.map((row) => {
                  const active = hoveredRow?.adcode === row.adcode
                  return (
                    <motion.li
                      key={row.adcode}
                      variants={{ hidden: { opacity: 0, x: 16 }, show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/city/${row.adcode}`)}
                        onMouseEnter={() => setHovered(row.name)}
                        onMouseLeave={() => setHovered(null)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-100',
                          active ? 'bg-paper-deep' : 'hover:bg-paper-deep',
                        )}
                      >
                        <MapPin className={cn('w-3.5 h-3.5 shrink-0 transition-colors duration-100', active ? 'text-cinnabar' : 'text-ink-faint')} />
                        <span className="flex-1 min-w-0">
                          <span className={cn('block text-sm font-medium truncate transition-colors duration-100', active ? 'text-cinnabar' : 'text-ink')}>
                            {row.name}
                          </span>
                          <span className="block text-xs text-ink-faint">
                            公告 {row.recruitments} 条 · 高校 {row.universities} 所
                          </span>
                        </span>
                        <ChevronRight className={cn('w-4 h-4 shrink-0 transition-all duration-100', active ? 'text-cinnabar translate-x-0.5' : 'text-ink-faint')} />
                      </button>
                    </motion.li>
                  )
                })}
              </motion.ul>
            ) : (
              <div className="py-6 flex flex-col items-center text-center gap-3">
                <img src={assetUrl('map-empty.svg')} alt="" className="w-32 h-auto opacity-80" />
                <span className="text-sm text-ink-faint">城市数据整理中</span>
              </div>
            )}

            {/* 底部 mini 统计条 */}
            <div className="mt-4 pt-4 border-t border-line/60 text-xs text-ink-faint">
              公告最多的城市：
              {topCity ? (
                <Link to={`/city/${topCity.adcode}`} className="text-cinnabar font-medium hover:underline">
                  {topCity.name}
                </Link>
              ) : (
                <span>数据整理中</span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 3 · 省级官方入口
// ---------------------------------------------------------------------------

function PortalsSection({ province }: { province: ProvinceData }) {
  return (
    <section className="mt-16 md:mt-24">
      <SectionTitle title={`${province.name}官方信息平台`} />
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-15% 0px' }}
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
        className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {PORTAL_SLOTS.map((slot) => {
          const portal = (province.provincePortals ?? []).find((p) => p.category === slot)
          return (
            <motion.div
              key={slot}
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
              whileHover={portal ? { y: -4 } : undefined}
              whileTap={portal ? { scale: 0.97 } : undefined}
            >
              {portal ? (
                <PortalCard portal={portal} className="h-full" />
              ) : (
                <div
                  className="h-full flex items-center gap-4 rounded-2xl border border-dashed border-line bg-paper-deep/40 p-5 pl-6 opacity-70 cursor-not-allowed select-none"
                  style={{ borderLeft: `4px solid ${categoryColor(slot)}` }}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-sans font-bold text-ink-faint">{slot}平台</span>
                    <span className="block text-xs text-ink-faint mt-1">暂未收录</span>
                  </span>
                </div>
              )}
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 4 · 省内统计速览
// ---------------------------------------------------------------------------

function StatsSection({ province }: { province: ProvinceData }) {
  const barData = useMemo(() => {
    return (province.cities ?? [])
      .map((c: City) => ({ name: c.name, value: c.recruitments?.length ?? 0 }))
      .sort((a, b) => b.value - a.value)
  }, [province])

  const barOption = useMemo((): echarts.EChartsOption => {
    const max = Math.max(1, ...barData.map((d) => d.value))
    return {
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#EAE3D3' } } },
      yAxis: {
        type: 'category',
        inverse: true,
        data: barData.map((d) => d.name),
        axisLabel: { color: INK_SOFT, fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 18,
          data: barData.map((d) => ({
            value: d.value,
            itemStyle: {
              // 单色系朱砂透明度梯度（按数值占比）
              color: `rgba(181, 73, 58, ${(0.35 + 0.65 * (d.value / max)).toFixed(3)})`,
              borderRadius: [0, 6, 6, 0],
            },
          })),
          label: { show: true, position: 'right', color: INK_FAINT, fontSize: 12 },
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
      ],
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number }
          return `<div style="font-weight:700">${p.name}</div><div style="opacity:.8">公告 ${p.value} 条</div>`
        },
      },
    }
  }, [barData])

  const donut = useMemo(() => {
    const counts = new Map<string, number>()
    for (const city of province.cities ?? []) {
      for (const r of city.recruitments ?? []) {
        counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
      }
    }
    const data = DONUT_CATEGORIES.map((cat) => ({
      name: cat as string,
      value: counts.get(cat) ?? 0,
      itemStyle: { color: categoryColor(cat) },
    })).filter((d) => d.value > 0)
    const total = data.reduce((s, d) => s + d.value, 0)
    return { data, total }
  }, [province])

  const donutOption = useMemo((): echarts.EChartsOption => {
    return {
      title: {
        text: String(donut.total),
        subtext: '公告总数',
        left: 'center',
        top: '42%',
        itemGap: 4,
        textStyle: { fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 34, color: INK },
        subtextStyle: { fontSize: 12, color: INK_FAINT },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number }
          return `<div style="font-weight:700">${p.name}</div><div style="opacity:.8">${p.value} 条 · ${p.percent}%</div>`
        },
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: INK_SOFT, fontSize: 12 },
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '74%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          label: { show: false },
          emphasis: { scale: true, scaleSize: 6, label: { show: false } },
          itemStyle: { borderColor: '#FDFBF5', borderWidth: 2 },
          data: donut.data,
        },
      ],
    }
  }, [donut])

  if (barData.length === 0 && donut.total === 0) {
    return (
      <section className="mt-16 md:mt-24">
        <SectionTitle title="省内统计速览" />
        <EmptyBlock compact className="mt-8" />
      </section>
    )
  }

  return (
    <section className="mt-16 md:mt-24">
      <SectionTitle title="省内统计速览" />
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-20% 0px' }}
        variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
        className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        <motion.div
          variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
          className="lg:col-span-7"
        >
          <ChartCard
            title="各市公告数量分布"
            extra="按公告数降序"
            option={barOption}
            height={Math.max(320, barData.length * 30 + 60)}
            updatedAt={province.updatedAt}
            className="h-full"
          />
        </motion.div>
        <motion.div
          variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
          className="lg:col-span-5"
        >
          <ChartCard
            title="公告分类构成"
            option={donutOption}
            height={360}
            updatedAt={province.updatedAt}
            className="h-full"
          />
        </motion.div>
      </motion.div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 5 · 高校分布
// ---------------------------------------------------------------------------

function UniversitiesSection({ province }: { province: ProvinceData }) {
  const navigate = useNavigate()

  const groups = useMemo(() => {
    const map = new Map<string, { city: string; cityAdcode: number; list: University[] }>()
    for (const u of province.universities ?? []) {
      const key = `${u.cityAdcode}-${u.city}`
      if (!map.has(key)) map.set(key, { city: u.city, cityAdcode: u.cityAdcode, list: [] })
      map.get(key)!.list.push(u)
    }
    return [...map.values()].sort((a, b) => b.list.length - a.list.length)
  }, [province])

  const total = province.universities?.length ?? 0

  return (
    <section className="mt-16 md:mt-24">
      <SectionTitle title={`本科高校分布 · 共 ${total} 所`} />
      {total === 0 ? (
        <EmptyBlock compact className="mt-8" />
      ) : (
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-15% 0px' }}
          variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
          className="mt-8 space-y-8"
        >
          {groups.map((g) => (
            <motion.div
              key={`${g.cityAdcode}-${g.city}`}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } }}
            >
              <button
                type="button"
                onClick={() => navigate(`/city/${g.cityAdcode}`)}
                className="group flex items-center gap-2 text-sm font-bold text-ink hover:text-cinnabar transition-colors duration-200 mb-3"
              >
                <GraduationCap className="w-4 h-4 text-ink-faint group-hover:text-cinnabar transition-colors duration-200" />
                {g.city}
                <span className="text-xs font-normal text-ink-faint">{g.list.length} 所</span>
                <ChevronRight className="w-3.5 h-3.5 text-ink-faint opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
              </button>
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-10% 0px' }}
                variants={{ show: { transition: { staggerChildren: 0.02 } } }}
                className="flex flex-wrap gap-2.5"
              >
                {g.list.map((u) => (
                  <motion.button
                    key={u.name}
                    type="button"
                    variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } } }}
                    whileHover={{ y: -2, boxShadow: '0 8px 20px -8px rgba(42,39,35,.25)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/university/${encodeURIComponent(u.name)}`)}
                    className="flex items-center gap-2 bg-surface rounded-full border border-line pl-4 pr-3 py-1.5 text-sm text-ink transition-colors duration-200 hover:border-cinnabar/50"
                  >
                    <span>{u.name}</span>
                    <span className="flex items-center gap-1">
                      {(u.tags ?? []).map((t) => (
                        <TagBadge key={t} label={t} variant="university" />
                      ))}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 通用小块
// ---------------------------------------------------------------------------

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="font-serif font-bold text-[1.75rem] text-ink flex items-center gap-3">
      <span className="w-1.5 h-7 bg-cinnabar rounded-full inline-block" />
      {title}
    </h2>
  )
}

function LoadingBlock() {
  return (
    <div className="mt-16 flex flex-col items-center text-center gap-3 py-16">
      <img src={assetUrl('map-empty.svg')} alt="" className="w-40 h-auto opacity-60 animate-pulse" />
      <span className="text-sm text-ink-faint">数据加载中…</span>
    </div>
  )
}

function EmptyBlock({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center text-center gap-3', compact ? 'py-10' : 'py-20 mt-8', className)}>
      <img src={assetUrl('map-empty.svg')} alt="" className="w-44 h-auto opacity-85" />
      <p className="text-sm text-ink-faint">该省数据整理中，敬请期待</p>
    </div>
  )
}
