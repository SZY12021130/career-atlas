import { useParams, Link } from 'react-router'
import { motion } from 'framer-motion'
import { Briefcase, Globe, FlaskConical, ArrowLeft } from 'lucide-react'
import Breadcrumb from '@/components/Breadcrumb'

const TAG_META: Record<string, { label: string; icon: typeof Briefcase; desc: string }> = {
  guoqi: { label: '国企 / 央企', icon: Briefcase, desc: '中央企业、地方国企校招与社招信息图谱。' },
  dachang: { label: '互联网大厂', icon: Globe, desc: '头部互联网企业校招 timeline 与内推入口。' },
  boshi: { label: '博士后', icon: FlaskConical, desc: '博士后流动站、出站政策与资助项目汇总。' },
}

/** 预留标签页（占位 stub，后续由页面 agent 实现 reserved.md） */
export default function ReservedPage() {
  const { tag } = useParams<{ tag: string }>()
  const meta = TAG_META[tag ?? ''] ?? { label: tag ?? '未知标签', icon: Briefcase, desc: '' }
  const Icon = meta.icon

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: meta.label }]} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-12 flex flex-col items-center text-center"
      >
        <img src="/reserved-illustration.svg" alt="正在建设" className="w-72 h-auto" />
        <span className="mt-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-xs font-medium">
          <Icon className="w-3.5 h-3.5" />
          标签预留 · 后续开发
        </span>
        <h1 className="mt-4 font-serif font-bold text-ink" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
          {meta.label}
        </h1>
        <p className="mt-3 text-ink-soft text-sm max-w-md leading-7">
          {meta.desc || '该标签内容正在规划中。'}
          博士的出路不止一条——标签已就位，内容持续开发中。
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-ink/25 text-ink text-sm hover:bg-ink hover:text-paper transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>
      </motion.div>
    </div>
  )
}
