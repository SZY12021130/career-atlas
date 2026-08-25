import { Link, Navigate, useParams } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, Compass, Briefcase, Globe, FlaskConical } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Breadcrumb from '@/components/Breadcrumb'
import { assetUrl } from '@/lib/data'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

interface TagMeta {
  /** 面包屑 / 徽章文案 */
  badge: string
  title: string
  icon: LucideIcon
  /** 规划内容预览（三个灰态小项） */
  preview: string[]
}

const TAG_META: Record<string, TagMeta> = {
  guoqi: {
    badge: '国企 / 央企',
    title: '国企 · 央企就业信息',
    icon: Briefcase,
    preview: ['央企名录', '校招公告', '录取统计'],
  },
  dachang: {
    badge: '互联网大厂',
    title: '互联网大厂就业信息',
    icon: Globe,
    preview: ['大厂目录', '校招时间线', 'offer 参考'],
  },
  boshi: {
    badge: '博士后',
    title: '博士后流动站信息',
    icon: FlaskConical,
    preview: ['流动站名录', '招收政策', '出站去向'],
  },
}

/** 预留标签页 /reserved/:tag（reserved.md）：优雅占位 + 规划预览灰态卡；非法 tag 重定向首页 */
export default function ReservedPage() {
  const { tag } = useParams<{ tag: string }>()
  const meta = tag ? TAG_META[tag] : undefined

  // 路由守卫：非 guoqi / dachang / boshi 重定向首页
  if (!meta) return <Navigate to="/" replace />

  const Icon = meta.icon

  return (
    <div className="max-w-[1680px] mx-auto px-6 lg:px-10 pt-8 pb-16">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: meta.badge }]} />

      <div className="min-h-[70vh] flex items-center">
        <div className="max-w-3xl mx-auto w-full flex flex-col items-center text-center">
          {/* 插画：入场淡入缩放，随后 3s 循环轻微浮动 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <motion.img
              src={assetUrl('reserved-illustration.svg')}
              alt="正在建设"
              className="w-[320px] h-auto"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            />
          </motion.div>

          {/* 标签徽章：弹出 */}
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2, ease: EASE }}
            className="mt-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-ink text-ink text-sm font-medium"
          >
            <Icon className="w-4 h-4" />
            {meta.badge}
            <span className="w-1 h-1 rounded-full bg-ink-faint" />
            <span className="text-ink-faint font-normal">标签预留 · 后续开发</span>
          </motion.span>

          {/* 标题：字符 stagger */}
          <motion.h1
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.04, delayChildren: 0.3 } },
            }}
            initial="hidden"
            animate="show"
            className="mt-5 font-serif font-bold text-ink leading-tight"
            style={{ fontSize: '2rem' }}
          >
            {Array.from(meta.title).map((ch, i) => (
              <motion.span
                key={`${ch}-${i}`}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
                }}
                className="inline-block"
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            ))}
          </motion.h1>

          {/* 副文案 */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55, ease: EASE }}
            className="mt-4 text-[15px] text-ink-soft leading-7 max-w-xl"
          >
            该标签已预留，数据结构待后续开发完善。届时将在此呈现与公务员 / 选调 /
            事业单位同等规格的官方入口、统计图表与公告附件。
          </motion.p>

          {/* 规划内容预览灰态卡（仅展示不可点） */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7, ease: EASE }}
            className="mt-8 w-full max-w-xl bg-surface rounded-2xl border border-line p-6"
          >
            <p className="text-xs tracking-[0.2em] text-ink-faint mb-4">规划内容预览</p>
            <div className="grid grid-cols-3 gap-3">
              {meta.preview.map((item) => (
                <div
                  key={item}
                  aria-disabled
                  className="cursor-default select-none rounded-xl border border-line px-3 py-3.5 text-[13px] text-ink-faint"
                >
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          {/* 操作按钮：移动端纵向堆叠全宽 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.85, ease: EASE }}
            className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
          >
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-cinnabar text-paper text-sm font-medium hover:bg-cinnabar-deep transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              返回全国地图
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-ink/25 text-ink text-sm hover:bg-ink hover:text-paper transition-colors duration-200"
            >
              <Compass className="w-4 h-4" />
              先逛逛人才引进专栏
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
