/**
 * 选调专栏（xuandiao.md）：定向/普通选调三态 Tab 驱动全页过滤，
 * 双轨年度对比分组柱 + 招录人数趋势 + 选调科普卡 + 公告表 + 附件区。
 * 主题色：ochre #F5A94B
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { EChartsOption } from 'echarts'
import type { Recruitment } from '@/lib/data'
import StatCard from '@/components/StatCard'
import ChartCard from '@/components/ChartCard'
import RecruitmentTable from '@/components/RecruitmentTable'
import {
  AttachmentGroups,
  BottomLinks,
  ColumnHeader,
  FilterChips,
  InfoCard,
  InfoCardGrid,
  PortalGrid,
  SectionTitle,
} from './shared'
import { YEARS, collectAttachments, type CityContext } from './useCityContext'

const OCHRE = '#F5A94B'
const GRAY = '#7A8BA8'

type Track = '全部' | '定向选调' | '普通选调'
const TRACKS: readonly Track[] = ['全部', '定向选调', '普通选调']

function isDirected(r: Recruitment): boolean {
  return r.subCategory === '定向选调'
}

export default function XuandiaoColumn({ ctx }: { ctx: CityContext }) {
  const [track, setTrack] = useState<Track>('全部')
  const { city, cityName, provinceName, province, adcode, loading } = ctx

  const all = useMemo(() => (city?.recruitments ?? []).filter((r) => r.category === '选调生'), [city])
  const filtered = useMemo(
    () => (track === '全部' ? all : all.filter((r) => (track === '定向选调' ? isDirected(r) : !isDirected(r)))),
    [all, track],
  )

  const directed = useMemo(() => all.filter(isDirected), [all])
  const normal = useMemo(() => all.filter((r) => !isDirected(r)), [all])

  const countByYear = (list: Recruitment[]) => YEARS.map((y) => list.filter((r) => r.year === y).length)
  const headcountByYear = (list: Recruitment[]) =>
    YEARS.map((y) => {
      const rows = list.filter((r) => r.year === y && r.headcount != null)
      return rows.length ? rows.reduce((s, r) => s + (r.headcount ?? 0), 0) : null
    })

  const compareOption: EChartsOption = useMemo(() => {
    const dimDirected = track === '普通选调'
    const dimNormal = track === '定向选调'
    return {
      animationDuration: 600,
      grid: { left: 8, right: 8, top: 40, bottom: 0, containLabel: true },
      legend: { top: 0, textStyle: { color: '#9AA7BE', fontSize: 12 } },
      xAxis: { type: 'category', data: YEARS.map(String) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          name: '定向选调',
          type: 'bar',
          data: countByYear(directed),
          barMaxWidth: 36,
          itemStyle: {
            color: OCHRE,
            borderRadius: [4, 4, 0, 0],
            opacity: dimDirected ? 0.25 : 1,
          },
          emphasis: { focus: 'series' },
        },
        {
          name: '普通选调',
          type: 'bar',
          data: countByYear(normal),
          barMaxWidth: 36,
          itemStyle: {
            color: 'rgba(245,169,75,0.4)',
            borderColor: OCHRE,
            borderWidth: 1,
            borderRadius: [4, 4, 0, 0],
            opacity: dimNormal ? 0.25 : 1,
          },
          emphasis: { focus: 'series' },
        },
      ],
    }
  }, [directed, normal, track])

  const trendOption: EChartsOption = useMemo(() => {
    const data = headcountByYear(filtered)
    return {
      animationDuration: 600,
      grid: { left: 8, right: 16, top: 40, bottom: 0, containLabel: true },
      xAxis: { type: 'category', data: YEARS.map(String), boundaryGap: false },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          name: '招录人数',
          type: 'line',
          data,
          connectNulls: false,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: OCHRE, width: 3 },
          itemStyle: { color: OCHRE, borderColor: '#0B1220', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245,169,75,0.14)' },
                { offset: 1, color: 'rgba(245,169,75,0)' },
              ],
            },
          },
        },
      ],
    }
  }, [filtered])

  const attachments = useMemo(() => collectAttachments(filtered), [filtered])

  const observation =
    all.length > 0
      ? `近三年共发布 ${all.length} 条选调公告，其中定向 ${directed.length} 条、普通 ${normal.length} 条；官方信息见下方入口。`
      : '近三年暂未收录选调公告数据，可通过下方官方入口查询最新信息。'

  return (
    <div className="max-w-[1680px] mx-auto px-6 lg:px-10 py-12 space-y-16">
      <ColumnHeader
        color={OCHRE}
        title="选调生专栏"
        subtitle={`${cityName} · 定向选调与普通选调调查统计`}
        provinceName={provinceName}
        cityName={cityName}
        adcode={adcode}
        control={<FilterChips options={TRACKS} value={track} onChange={setTrack} color={OCHRE} layoutId="xd-track" />}
      />

      {/* Section 2 · 统计仪表盘 */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard color={OCHRE} label="近三年选调公告数" value={filtered.length} suffix="条" hint={`当前筛选：${track}`} />
          <StatCard color={OCHRE} label="定向选调公告数" value={directed.length} suffix="条" hint="两轨对比" />
          <StatCard color={GRAY} label="普通选调公告数" value={normal.length} suffix="条" hint="两轨对比" />
        </div>
        <motion.div
          className="grid gap-6 lg:grid-cols-12"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
        >
          <motion.div
            className="lg:col-span-7"
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
          >
            <ChartCard
              title="定向 vs 普通 · 年度对比"
              option={compareOption}
              height={340}
              source={city?.portals?.find((p) => p.category === '选调')?.name ?? undefined}
              updatedAt={province?.updatedAt}
              extra={<span>单位：公告条数 · 2024—2026</span>}
            />
          </motion.div>
          <motion.div
            className="lg:col-span-5"
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
          >
            <ChartCard
              title="招录人数趋势"
              option={trendOption}
              height={340}
              updatedAt={province?.updatedAt}
              extra={<span>以公告披露为准 · 断点为无数据年份</span>}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Section 3 · 选调要点信息卡 */}
      <section className="space-y-6">
        <SectionTitle>选调要点</SectionTitle>
        <InfoCardGrid>
          <InfoCard color={OCHRE} title="什么是定向选调">
            面向指定高校（多为双一流）定向招录应届毕业生，竞争范围小、岗位明确，入职后通常定岗培养、跟踪管理，是博士进入党政机关的快车道。
          </InfoCard>
          <InfoCard color={OCHRE} title="什么是普通选调">
            面向全国高校应届毕业生公开选拔，一般要求中共党员（含预备党员）、学生干部经历或校级以上奖励等条件，先到基层锻炼再择优调任。
          </InfoCard>
          <InfoCard color={OCHRE} title={`${cityName}选调观察`}>
            {observation}
          </InfoCard>
        </InfoCardGrid>
      </section>

      {/* Section 4 · 官方入口 */}
      <section className="space-y-6">
        <SectionTitle>官方入口</SectionTitle>
        <PortalGrid
          cityPortals={city?.portals ?? []}
          provincePortals={province?.provincePortals ?? []}
          categories={['选调']}
        />
      </section>

      {/* Section 5 · 公告与附件 */}
      <section className="space-y-6">
        <SectionTitle>公告与附件</SectionTitle>
        <RecruitmentTable
          recruitments={filtered}
          emptyText={loading ? '数据加载中…' : `该市暂未收录${track === '全部' ? '' : track}选调公告，可通过上方官方入口查询`}
        />
        <AttachmentGroups items={attachments} cityAdcode={adcode} />
      </section>

      {/* Section 6 · 底部联动条 */}
      <BottomLinks cityName={cityName} adcode={adcode} current="xuandiao" />
    </div>
  )
}
