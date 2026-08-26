/**
 * 人才引进专栏（rencai.md）：引进公告柱+人数折线、引进主体玫瑰图、
 * 政策要点卡、高校人才政策直达区（官网/人事处/人才政策三快捷链接）、公告表与附件区。
 * 主题色：plum #C084FC
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { ExternalLink, GraduationCap } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import type { Recruitment, University } from '@/lib/data'
import { assetUrl } from '@/lib/data'
import StatCard from '@/components/StatCard'
import ChartCard from '@/components/ChartCard'
import RecruitmentTable from '@/components/RecruitmentTable'
import TagBadge from '@/components/TagBadge'
import { cn } from '@/lib/utils'
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

const PLUM = '#C084FC'
const INK = '#E6ECF5'

type YearFilter = '全部' | '2026' | '2025' | '2024'
const YEAR_OPTIONS: readonly YearFilter[] = ['全部', '2026', '2025', '2024']

/** 按标题/来源关键词粗分引进主体 */
function classify(r: Recruitment): string {
  const text = `${r.title} ${r.source}`
  if (/大学|学院|高校|职业技术学院/.test(text)) return '高校'
  if (/医院|卫生|医疗|疾控中心|卫健/.test(text)) return '医疗卫生'
  if (/研究院|科学院|研究所|科研|实验室/.test(text)) return '科研院所'
  if (/党委|政府|组织部|机关|人社|党校|党群/.test(text)) return '党政机关'
  return '其他'
}

const SUBJECT_ORDER = ['党政机关', '高校', '医疗卫生', '科研院所', '其他'] as const
const SUBJECT_COLORS: Record<string, string> = {
  党政机关: '#C084FC',
  高校: '#A78BFA',
  医疗卫生: '#9385E8',
  科研院所: '#7E93D4',
  其他: '#6D7FB8',
}

function QuickLink({ href, label, color }: { href: string | null; label: string; color: string }) {
  if (!href) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-line text-ink-faint cursor-not-allowed">
        {label}
        <span className="text-[10px]">暂未收录</span>
      </span>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors duration-200"
      style={{ borderColor: color, color }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = `${color}14`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  )
}

function UniversityCard({ uni }: { uni: University }) {
  const navigate = useNavigate()
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/university/${encodeURIComponent(uni.name)}`)}
      className={cn(
        'group bg-surface rounded-2xl border border-line p-5 cursor-pointer',
        'shadow-[0_1px_0_rgba(0,0,0,.25)] transition-shadow duration-200',
        'hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${PLUM}14` }}>
          <GraduationCap className="w-4.5 h-4.5" style={{ color: PLUM, width: 18, height: 18 }} />
        </span>
        <div className="min-w-0">
          <h4 className="font-sans font-bold text-ink truncate transition-colors duration-200 group-hover:text-plum" title={uni.name}>
            {uni.name}
          </h4>
          {uni.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {uni.tags.map((t) => (
                <TagBadge key={t} label={t} variant="university" />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <QuickLink href={uni.website} label="官网" color={PLUM} />
        <QuickLink href={uni.hrUrl} label="人事招聘" color={PLUM} />
        <QuickLink href={uni.talentPolicyUrl} label="人才政策" color={PLUM} />
      </div>
    </motion.div>
  )
}

export default function RencaiColumn({ ctx }: { ctx: CityContext }) {
  const [yearFilter, setYearFilter] = useState<YearFilter>('全部')
  const { city, cityName, provinceName, province, adcode, loading, universities } = ctx

  const all = useMemo(() => (city?.recruitments ?? []).filter((r) => r.category === '人才引进'), [city])
  const filtered = useMemo(() => {
    const list = yearFilter === '全部' ? all : all.filter((r) => r.year === Number(yearFilter))
    return [...list].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [all, yearFilter])

  const headcountTotal = filtered.reduce((s, r) => s + (r.headcount ?? 0), 0)
  const positionsTotal = filtered.reduce((s, r) => s + (r.positions ?? 0), 0)

  const trendOption: EChartsOption = useMemo(
    () => ({
      animationDuration: 600,
      grid: { left: 8, right: 16, top: 40, bottom: 0, containLabel: true },
      legend: { top: 0, textStyle: { color: '#9AA7BE', fontSize: 12 } },
      xAxis: { type: 'category', data: YEARS.map(String) },
      yAxis: [
        { type: 'value', minInterval: 1, name: '公告数', nameTextStyle: { color: '#5E6C85' } },
        { type: 'value', minInterval: 1, name: '人数', nameTextStyle: { color: '#5E6C85' }, splitLine: { show: false } },
      ],
      series: [
        {
          name: '引进公告',
          type: 'bar',
          data: YEARS.map((y) => all.filter((r) => r.year === y).length),
          barMaxWidth: 36,
          itemStyle: { color: PLUM, borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '引进人数',
          type: 'line',
          yAxisIndex: 1,
          data: YEARS.map((y) => all.filter((r) => r.year === y).reduce((s, r) => s + (r.headcount ?? 0), 0)),
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: INK, width: 2.5 },
          itemStyle: { color: INK, borderColor: '#0B1220', borderWidth: 2 },
        },
      ],
    }),
    [all],
  )

  const subjects = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of filtered) {
      const k = classify(r)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return SUBJECT_ORDER.filter((k) => (counts.get(k) ?? 0) > 0).map((k) => ({
      name: k,
      value: counts.get(k) ?? 0,
    }))
  }, [filtered])

  const roseOption: EChartsOption = useMemo(
    () => ({
      animationDuration: 600,
      legend: { bottom: 0, textStyle: { color: '#9AA7BE', fontSize: 12 } },
      series: [
        {
          name: '引进主体',
          type: 'pie',
          roseType: 'radius',
          radius: ['18%', '68%'],
          center: ['50%', '46%'],
          itemStyle: { borderColor: '#0B1220', borderWidth: 2, borderRadius: 6 },
          label: { color: '#9AA7BE', fontSize: 12 },
          data: subjects.map((s) => ({ ...s, itemStyle: { color: SUBJECT_COLORS[s.name] } })),
        },
      ],
    }),
    [subjects],
  )

  const attachments = useMemo(() => collectAttachments(filtered), [filtered])

  const observation =
    all.length > 0
      ? `近三年人才引进公告 ${all.length} 条，引进 ${all.reduce((s, r) => s + (r.headcount ?? 0), 0)} 人；官方政策详见下方入口与附件。`
      : '近三年暂未收录人才引进公告数据，可通过下方官方入口与高校直达区查询最新政策。'

  return (
    <div className="max-w-[1680px] mx-auto px-6 lg:px-10 py-12 space-y-16">
      <ColumnHeader
        color={PLUM}
        title="人才引进专栏"
        subtitle={`${cityName} · 高层次人才政策与博士岗位`}
        provinceName={provinceName}
        cityName={cityName}
        adcode={adcode}
        control={<FilterChips options={YEAR_OPTIONS} value={yearFilter} onChange={setYearFilter} color={PLUM} layoutId="rc-year" />}
      />

      {/* Section 2 · 统计仪表盘 */}
      <section className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard color={PLUM} label="人才引进公告数" value={filtered.length} suffix="条" hint={`当前筛选：${yearFilter}`} />
          <StatCard color={PLUM} label="引进人数合计" value={headcountTotal} suffix="人" />
          <StatCard color={PLUM} label="涉及单位/岗位数" value={positionsTotal} suffix="个" />
          <StatCard color="#F5A94B" label="本市本科高校数" value={universities.length} suffix="所" hint="联动指标" />
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
              title="近三年引进公告趋势"
              option={trendOption}
              height={340}
              updatedAt={province?.updatedAt}
              extra={<span>柱：公告条数 · 线：引进人数</span>}
            />
          </motion.div>
          <motion.div
            className="lg:col-span-5"
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
          >
            {subjects.length > 0 ? (
              <ChartCard
                title="引进主体构成"
                option={roseOption}
                height={340}
                updatedAt={province?.updatedAt}
                extra={<span>按公告标题/来源关键词粗分</span>}
              />
            ) : (
              <ChartCard title="引进主体构成" option={{}} updatedAt={province?.updatedAt}>
                <div className="flex flex-col items-center text-center py-8">
                  <img src={assetUrl('map-empty.svg')} alt="暂无数据" className="w-40 h-auto opacity-90" />
                  <p className="mt-4 text-sm text-ink-faint">暂无可归类的引进公告数据。</p>
                </div>
              </ChartCard>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Section 3 · 政策要点卡 */}
      <section className="space-y-6">
        <SectionTitle>政策要点</SectionTitle>
        <InfoCardGrid>
          <InfoCard color={PLUM} title="人才引进常见待遇">
            常见配套包括：安家费与购房补贴（分档发放）、科研启动经费、人才公寓或租房补贴、配偶安置与子女入学协助。具体额度以各城市当年公告为准。
          </InfoCard>
          <InfoCard color={PLUM} title="博士引进通道">
            博士常见条款：直聘副高职称或校聘教授、周转编制（先入岗后落编）、博士后出站留用绿色通道、急需紧缺专业一事一议。部分城市免笔试、直接考核聘用。
          </InfoCard>
          <InfoCard color={PLUM} title={`${cityName}观察`}>
            {observation}
          </InfoCard>
        </InfoCardGrid>
      </section>

      {/* Section 4 · 高校人才政策直达 */}
      <section className="space-y-6">
        <SectionTitle>{cityName}高校 · 人才政策直达</SectionTitle>
        {universities.length > 0 ? (
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
          >
            {universities.map((u) => (
              <UniversityCard key={u.name} uni={u} />
            ))}
          </motion.div>
        ) : (
          <div className="bg-surface rounded-2xl border border-line p-10 flex flex-col items-center text-center">
            <img src={assetUrl('map-empty.svg')} alt="暂无数据" className="w-48 h-auto opacity-90" />
            <p className="mt-4 text-sm text-ink-faint">暂未收录本市本科高校数据。</p>
          </div>
        )}
      </section>

      {/* Section 5 · 官方入口与公告附件 */}
      <section className="space-y-6">
        <SectionTitle>官方入口</SectionTitle>
        <PortalGrid
          cityPortals={city?.portals ?? []}
          provincePortals={province?.provincePortals ?? []}
          categories={['人才引进']}
        />
      </section>

      <section className="space-y-6">
        <SectionTitle>公告与附件</SectionTitle>
        <RecruitmentTable
          recruitments={filtered}
          emptyText={loading ? '数据加载中…' : '该市暂未收录人才引进公告，可通过上方官方入口查询'}
        />
        <AttachmentGroups items={attachments} cityAdcode={adcode} />
      </section>

      {/* Section 6 · 底部联动条 */}
      <BottomLinks cityName={cityName} adcode={adcode} current="rencai" />
    </div>
  )
}
