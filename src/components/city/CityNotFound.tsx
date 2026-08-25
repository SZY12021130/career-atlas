import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router'
import Breadcrumb from '@/components/Breadcrumb'

export interface CityNotFoundProps {
  /** 优雅的 404：城市在数据中不存在 */
  kind: 'notfound' | 'degraded'
  provinceName: string | null
  provinceAdcode: number | null
  isMunicipality: boolean
}

/** 城市不存在 / 省级数据未就绪时的优雅降级页（map-empty.svg 空态） */
export default function CityNotFound({ kind, provinceName, provinceAdcode, isMunicipality }: CityNotFoundProps) {
  const crumbItems =
    provinceName && !isMunicipality
      ? [
          { label: '首页', to: '/' },
          provinceAdcode ? { label: provinceName, to: `/province/${provinceAdcode}` } : { label: provinceName },
          { label: kind === 'notfound' ? '未找到城市' : '数据整理中' },
        ]
      : [{ label: '首页', to: '/' }, { label: kind === 'notfound' ? '未找到城市' : '数据整理中' }]

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 md:py-16">
      <Breadcrumb items={crumbItems} />
      <div className="mt-16 mb-20 flex flex-col items-center text-center">
        <img src="/map-empty.svg" alt="空态" className="w-64 h-auto opacity-90" />
        {kind === 'notfound' ? (
          <>
            <h1 className="mt-8 font-serif font-bold text-2xl text-ink">未找到该城市</h1>
            <p className="mt-3 text-sm text-ink-faint max-w-md">
              该城市暂未收录于{provinceName ? `「${provinceName}」` : '本站'}数据中，可能是链接有误或数据仍在采集。
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-8 font-serif font-bold text-2xl text-ink">数据整理中</h1>
            <p className="mt-3 text-sm text-ink-faint max-w-md">
              {provinceName ? `「${provinceName}」的详细数据正在整理中，` : '该地区详细数据正在整理中，'}
              已收录官方入口，可先从省份页查看官方招录网站直达链接。
            </p>
          </>
        )}
        <div className="mt-8 flex items-center gap-3 flex-wrap justify-center">
          {provinceName && provinceAdcode && !isMunicipality && (
            <Link
              to={`/province/${provinceAdcode}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink text-paper text-sm hover:bg-cinnabar transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              返回{provinceName}
            </Link>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-line text-ink-soft text-sm hover:border-cinnabar hover:text-cinnabar transition-colors duration-200 bg-surface"
          >
            <Compass className="w-4 h-4" />
            返回全国地图
          </Link>
        </div>
      </div>
    </div>
  )
}
