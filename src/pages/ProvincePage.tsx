import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import Breadcrumb from '@/components/Breadcrumb'
import { fetchProvince } from '@/lib/data'
import type { ProvinceData } from '@/lib/data'

/** 省级下钻页（占位 stub，后续由页面 agent 实现 province.md） */
export default function ProvincePage() {
  const { adcode } = useParams<{ adcode: string }>()
  const [data, setData] = useState<ProvinceData | null>(null)

  useEffect(() => {
    if (!adcode) return
    fetchProvince(Number(adcode)).then(setData)
  }, [adcode])

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: data?.name ?? `省份 ${adcode}` }]} />
      <h1 className="font-serif font-bold text-ink mt-6" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
        {data?.name ?? `省份 ${adcode}`}
      </h1>
      <p className="mt-4 text-ink-soft text-sm">省级下钻页建设中：地级市地图、省级官网入口、省内统计速览、高校分布。</p>
      {!data && (
        <div className="mt-10 flex flex-col items-center text-center">
          <img src="/map-empty.svg" alt="" className="w-48 h-auto opacity-90" />
          <p className="mt-4 text-sm text-ink-faint">该省数据正在采集中，敬请期待。</p>
        </div>
      )}
    </div>
  )
}
