import { useParams } from 'react-router'
import Breadcrumb from '@/components/Breadcrumb'

/** 城市详情页（占位 stub，后续由页面 agent 实现 city.md） */
export default function CityPage() {
  const { adcode } = useParams<{ adcode: string }>()
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: `城市 ${adcode}` }]} />
      <h1 className="font-serif font-bold text-ink mt-6" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
        城市详情
      </h1>
      <p className="mt-4 text-ink-soft text-sm">城市页建设中：统计总览、官网入口、附件下载、高校列表、三大专栏入口。</p>
    </div>
  )
}
