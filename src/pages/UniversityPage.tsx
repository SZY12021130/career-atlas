import { useParams } from 'react-router'
import Breadcrumb from '@/components/Breadcrumb'

/** 高校详情页（占位 stub，后续由页面 agent 实现 university.md） */
export default function UniversityPage() {
  const { name } = useParams<{ name: string }>()
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '高校' }, { label: name ?? '' }]} />
      <h1 className="font-serif font-bold text-ink mt-6" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
        {name}
      </h1>
      <p className="mt-4 text-ink-soft text-sm">高校页建设中：官网/人事处/人才政策跳转、同城岗位联动。</p>
    </div>
  )
}
