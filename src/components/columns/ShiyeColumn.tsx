/**
 * 事业单位专栏（shiye.md）：招聘 vs 录用双折线、岗位来源 Top5 横向条形、
 * 年份筛选 chips 驱动全页过滤、备考提示卡、公告表与附件区。
 * 主题色：pine #3F6C5B
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

const PINE = '#3F6C5B'
const GRAY = '#8A8378'

type YearFilter = '全部' | '2026' | '2025' | '2024'
const YEAR_OPTIONS: readonly YearFilter[] = ['全部', '2026', '2025', '2024']

type Metric = '条数' | '人数'

function byYearFilter(list: Recruitment[], yf: YearFilter): Recruitment[] {
  if (yf === '全部') return list
  const y = Number(yf)
  return list.filter((r) => r.year === y)
}

export default function ShiyeColumn({ ctx }: { ctx: CityContext }) {
  const [yearFilter, setYearFilter] = useState<YearFilter>('全部')
  const [metric, setMetric] = useState<Metric>('条数')
  const { city, cityName, provinceName, province, adcode, loading } = ctx

  const recruitAll = useMemo(() => (city?.recruitments ?? []).filter((r) => r.category === '事业单位'), [city])
  const noticeAll = useMemo(() => (city?.recruitments ?? []).filter((r) => r.category === '录用公示'), [city])

  const recruit = useMemo(() => byYearFilter(recruitAll, yearFilter), [recruitAll, yearFilter])
  const notice = useMemo(() => byYearFilter(noticeAll, yearFilter), [noticeAll, yearFilter])
  const filtered = useMemo(
    () => [...recruit, ...notice].sort((a, b) => b.date.localeCompare(a.date)),
    [recruit, notice],
  )

  const headcountTotal = recruit.reduce((s, r) => s + (r.headcount ?? 0), 0)
  const positionsTotal = recruit.reduce((s, r) => s + (r.positions ?? 0), 0)

  const seriesOf = (list: Recruitment[]) =>
    YEARS.map((y) => {
      const rows = list.filter((r) => r.year === y)
      return metric === '条数' ? rows.length : rows.reduce((s, r) => s + (r.headcount ?? 0), 0)
    })

  const trendOption: EChartsOption = useMemo(
    () => ({
      animationDuration: 600,
      grid: { left: 8, right: 16, top: 40, bottom: 0, containLabel: true },
      legend: { top: 0, textStyle: { color: '#5C564B', fontSize: 12 } },
      xAxis: { type: 'category', data: YEARS.map(String), boundaryGap: false },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          name: '招聘公告',
          type: 'line',
          data: seriesOf(recruitAll),
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: PINE, width: 3 },
          itemStyle: { color: PINE, borderColor: '#FDFBF5', borderWidth: 2 },
        },
        {
          name: '录用公示',
          type: 'line',
          data: seriesOf(noticeAll),
          smooth: true,
          symbol: 'rect',
          symbolSize: 8,
          lineStyle: { color: GRAY, width: 2, type: 'dashed' },
          itemStyle: { color: GRAY, borderColor: '#FDFBF5', borderWidth: 2 },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recruitAll, noticeAll, metric],
  )

  const topSources = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of recruit) counts.set(r.source, (counts.get(r.source) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [recruit])

  const sourceOption: EChartsOption = useMemo(() => {
    const names = topSources.map(([name]) => name).reverse()
    const values = topSources.map(([, n]) => n).reverse()
    const max = Math.max(1, values[values.length - 1] ?? 1)
    return {
      animationDuration: 600,
      grid: { left: 8, right: 32, top: 8, bottom: 0, containLabel: true },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          color: '#5C564B',
          fontSize: 12,
          width: 96,
          overflow: 'truncate',
        },
      },
      series: [
        {
          name: '公告数',
          type: 'bar',
          data: values.map((v) => ({
            value: v,
            itemStyle: {
              color: `rgba(63,108,91,${0.45 + 0.55 * (v / max)})`,
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barMaxWidth: 22,
          label: { show: true, position: 'right', color: '#5C564B', fontSize: 12 },
        },
      ],
    }
  }, [topSources])

  const attachments = useMemo(() => collectAttachments(filtered), [filtered])

  const observation =
    recruitAll.length > 0
      ? `近三年事业编公告 ${recruitAll.length} 条，招录 ${recruitAll.reduce((s, r) => s + (r.headcount ?? 0), 0)} 人；${
          topSources[0] ? `主要发布渠道为 ${topSources[0][0]}。` : '主要发布渠道见下方入口。'
        }`
      : '近三年暂未收录事业编公告数据，可通过下方官方入口查询最新信息。'

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 space-y-16">
      <ColumnHeader
        color={PINE}
        title="事业单位专栏"
        subtitle={`${cityName} · 事业编制招聘与录用统计`}
        provinceName={provinceName}
        cityName={cityName}
        adcode={adcode}
        control={<FilterChips options={YEAR_OPTIONS} value={yearFilter} onChange={setYearFilter} color={PINE} layoutId="sy-year" />}
      />

      {/* Section 2 · 统计仪表盘 */}
      <section className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard color={PINE} label="招聘公告数" value={recruit.length} suffix="条" hint={`当前筛选：${yearFilter}`} />
          <StatCard color={PINE} label="招录人数合计" value={headcountTotal} suffix="人" />
          <StatCard color={PINE} label="岗位数合计" value={positionsTotal} suffix="个" />
          <StatCard color={GRAY} label="录用公示条数" value={notice.length} suffix="条" />
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
              title="近三年招聘与录用趋势"
              option={trendOption}
              height={340}
              updatedAt={province?.updatedAt}
              extra={
                <FilterChips
                  options={['条数', '人数'] as const}
                  value={metric}
                  onChange={setMetric}
                  color={PINE}
                  layoutId="sy-metric"
                />
              }
            />
          </motion.div>
          <motion.div
            className="lg:col-span-5"
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
          >
            {topSources.length > 0 ? (
              <ChartCard
                title="岗位来源分布 Top 5"
                option={sourceOption}
                height={340}
                updatedAt={province?.updatedAt}
                extra={<span>按公告来源聚合 · 单位：条</span>}
              />
            ) : (
              <ChartCard title="岗位来源分布 Top 5" option={{}} updatedAt={province?.updatedAt}>
                <div className="flex flex-col items-center text-center py-8">
                  <img src="/map-empty.svg" alt="暂无数据" className="w-40 h-auto opacity-90" />
                  <p className="mt-4 text-sm text-ink-faint">暂无来源分布数据。</p>
                </div>
              </ChartCard>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Section 3 · 备考提示卡 */}
      <section className="space-y-6">
        <SectionTitle>备考提示</SectionTitle>
        <InfoCardGrid>
          <InfoCard color={PINE} title="事业编 vs 公务员">
            事业编为事业单位编制，考试多为《职业能力倾向测验》+《综合应用能力》；公务员为行政编制，考试为行测+申论。事业编岗位类型更细（教育/医疗/科研等），专业对口度更高。
          </InfoCard>
          <InfoCard color={PINE} title="博士考事业编">
            多数地区对博士放宽年龄至 40 周岁，部分人才引进通道可免笔试直接考核聘用；入职后在职称认定、岗位等级上通常有政策倾斜。
          </InfoCard>
          <InfoCard color={PINE} title={`${cityName}观察`}>
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
          categories={['事业单位', '录用公示']}
        />
      </section>

      {/* Section 5 · 公告与附件 */}
      <section className="space-y-6">
        <SectionTitle>公告与附件</SectionTitle>
        <RecruitmentTable
          recruitments={filtered}
          emptyText={loading ? '数据加载中…' : '该市暂未收录事业单位公告，可通过上方官方入口查询'}
        />
        <AttachmentGroups items={attachments} cityAdcode={adcode} />
      </section>

      {/* Section 6 · 底部联动条 */}
      <BottomLinks cityName={cityName} adcode={adcode} current="shiye" />
    </div>
  )
}
