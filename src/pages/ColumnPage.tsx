import { useParams } from 'react-router'
import Breadcrumb from '@/components/Breadcrumb'
import TagBadge from '@/components/TagBadge'

const META: Record<string, { title: string; category: string; desc: string }> = {
  xuandiao: { title: '选调专栏', category: '选调生', desc: '定向/普通选调统计与公告。' },
  shiye: { title: '事业单位专栏', category: '事业单位', desc: '事业编招聘/录用统计与公告。' },
  rencai: { title: '人才引进专栏', category: '人才引进', desc: '高层次人才政策、补贴与公告统计。' },
}

/** 城市专栏页（占位 stub，后续由页面 agent 实现 xuandiao/shiye/rencai.md） */
export default function ColumnPage({ kind }: { kind: 'xuandiao' | 'shiye' | 'rencai' }) {
  const { adcode } = useParams<{ adcode: string }>()
  const meta = META[kind]
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: `城市 ${adcode}`, to: `/city/${adcode}` }, { label: meta.title }]} />
      <div className="mt-6 flex items-center gap-3">
        <h1 className="font-serif font-bold text-ink" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>{meta.title}</h1>
        <TagBadge label={meta.category} />
      </div>
      <p className="mt-4 text-ink-soft text-sm">{meta.desc} 页面建设中。</p>
      <div className="mt-10 flex flex-col items-center text-center">
        <img src="/map-empty.svg" alt="" className="w-48 h-auto opacity-90" />
        <p className="mt-4 text-sm text-ink-faint">该类别暂无数据，已收录官方入口。</p>
      </div>
    </div>
  )
}
