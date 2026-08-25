import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, FileText, Database, MapPin, GraduationCap, AlertCircle, GitBranch, Download } from 'lucide-react'
import Breadcrumb from '@/components/Breadcrumb'
import { fetchIndex, fetchProvince } from '@/lib/data'
import type { DataIndex, ProvinceData } from '@/lib/data'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

const SECTIONS = [
  {
    icon: Database,
    title: '数据来源',
    body: '本站所有公告、招录人数、录用公示与附件链接，均来自各官方招录网站原始发布：各省（区、市）党委组织部（组工网/党建网/先锋网）、人力资源和社会保障厅（局）、人事考试网（院/中心）、公务员局（考试录用网/专题）以及各本科高校官网与人事处页面。我们不生产数据，只做官方一手信息的索引与结构化整理。',
  },
  {
    icon: FileText,
    title: '统计口径',
    body: '招聘公告收录范围为 2024 年 1 月 1 日至今（2024 / 2025 / 2026 三个年度），按发布年份归入统计图表；「招录人数」「职位数」仅收录公告原文明确写出的数字，未明确披露的一律留空显示为「—」，绝不用第三方估算数字代替。录用公示与招聘公告分开统计，避免重复计数。',
  },
  {
    icon: Download,
    title: '附件规范',
    body: '职位表、简章、拟录用名单等附件按『年份+省市+文档名称』统一命名（例如「2026年天津市定向选调职位表.xlsx」）。可直接下载的附件已托管于本站；因官方网站反爬限制无法镜像的附件，提供「官网获取」直达链接跳转至源站下载。',
  },
  {
    icon: MapPin,
    title: '覆盖范围',
    body: '全国 34 个省级行政区的地图下钻均已开通。各省官方入口（省级 portals）100% 覆盖并经过人工核验；地级市公告数据按采集进度持续扩充，未覆盖城市页面会显示「数据整理中」并提供已收录的官方入口直达。香港、澳门、台湾按其本地公职体系收录官方渠道。',
  },
  {
    icon: GraduationCap,
    title: '高校口径',
    body: '高校收录范围为教育部公布的全国普通高等学校名单中的全部本科层次高校（含职业本科），标签体系为 985 / 211 / 双一流 / 省属重点 / 普通本科 / 民办。高校「人事处/人才招聘」链接仅在经过实际验证后收录，未验证的一律显示「暂未收录」，不放置臆测链接。',
  },
  {
    icon: AlertCircle,
    title: '免责声明',
    body: '本站为公益性的信息索引工具，所有公告内容、时间与人数以各官方网站正式发布为准；报考前请务必回到官方入口核对原文。本站与任何政府机关、考试机构无隶属关系，不提供报名、培训等任何收费服务。',
  },
]

const ROADMAP = [
  { title: '报名日历与截止提醒', desc: '从公告中结构化提取报名起止时间，生成可订阅的报考日历（进行中）' },
  { title: '收藏与对比', desc: '支持收藏关注的城市/高校，并横向对比多城市招录热度' },
  { title: '公告更新订阅', desc: '目标城市发布新公告时邮件/推送通知（需后端支持）' },
  { title: '国企央企 / 互联网大厂 / 博士后', desc: '预留标签的正式内容建设，纳入同一套官方信源标准' },
  { title: '区县级下钻', desc: '从地级市进一步下钻到区县级的公告与统计' },
]

export default function AboutPage() {
  const [stats, setStats] = useState<{ provinces: number; cities: number; recruitments: number; universities: number } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const idx: DataIndex | null = await fetchIndex()
      if (!idx || !alive) return
      const list = await Promise.all(idx.provinces.map((p) => fetchProvince(p.adcode)))
      if (!alive) return
      let cities = 0, recs = 0, unis = 0
      for (const p of list as (ProvinceData | null)[]) {
        if (!p) continue
        cities += p.cities?.length ?? 0
        unis += p.universities?.length ?? 0
        for (const c of p.cities ?? []) recs += c.recruitments?.length ?? 0
      }
      setStats({ provinces: idx.provinces.length, cities, recruitments: recs, universities: unis })
    })()
    return () => { alive = false }
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 md:py-16">
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
        <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '数据说明' }]} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: EASE }}
        className="font-serif font-bold text-ink mt-6 mb-4"
        style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
      >
        数据说明
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
        className="text-ink-soft text-[15px] leading-7 max-w-3xl"
      >
        「职途图谱」只做一件事：把分散在数百个官方网站上的公务员、选调生、事业单位、人才引进一手信息，以及本科高校的官网与人事处入口，收进一张可点击的地图里。
      </motion.p>

      {/* 实时覆盖统计 */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
          className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: '省级行政区', value: stats.provinces },
            { label: '收录城市/地区', value: stats.cities },
            { label: '官方公告', value: stats.recruitments },
            { label: '本科高校', value: stats.universities },
          ].map((s) => (
            <div key={s.label} className="bg-surface rounded-2xl border border-line p-6">
              <div className="text-xs text-ink-faint mb-2">{s.label}</div>
              <div className="font-num font-semibold text-3xl text-ink tabular-nums">{s.value.toLocaleString()}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* 六条说明 */}
      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
        {SECTIONS.map((sec, i) => (
          <motion.div
            key={sec.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: (i % 2) * 0.08, ease: EASE }}
            className="bg-surface rounded-2xl border border-line p-6 md:p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-xl bg-cinnabar/10 flex items-center justify-center">
                <sec.icon className="w-4.5 h-4.5 text-cinnabar" />
              </span>
              <h2 className="font-serif font-bold text-lg text-ink">{sec.title}</h2>
            </div>
            <p className="text-sm text-ink-soft leading-7">{sec.body}</p>
          </motion.div>
        ))}
      </div>

      {/* 路线图 */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mt-14 bg-paper-deep rounded-2xl p-8 md:p-10"
      >
        <div className="flex items-center gap-3 mb-6">
          <GitBranch className="w-5 h-5 text-ochre" />
          <h2 className="font-serif font-bold text-[1.5rem] text-ink">产品路线图</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROADMAP.map((r) => (
            <div key={r.title} className="bg-surface/70 rounded-xl border border-line border-dashed p-5">
              <h3 className="text-sm font-bold text-ink mb-1.5">{r.title}</h3>
              <p className="text-xs text-ink-faint leading-5">{r.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mt-12 text-center text-[13px] text-ink-faint leading-7 flex items-center justify-center gap-2 flex-wrap"
      >
        <ShieldCheck className="w-4 h-4 text-pine shrink-0" />
        所有内容仅供学习参考，报考请以各官方网站正式公告为准。
      </motion.p>
    </div>
  )
}
