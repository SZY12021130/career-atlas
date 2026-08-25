import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { fetchIndex, fetchProvince, MUNICIPALITY_ADCODES } from '@/lib/data'
import type { City, ProvinceData, University } from '@/lib/data'
import { recordCityVisit } from '@/lib/recent'
import CityHeader from '@/components/city/CityHeader'
import CityKpis from '@/components/city/CityKpis'
import TrendChart from '@/components/city/TrendChart'
import CategoryDonut from '@/components/city/CategoryDonut'
import PortalGrid from '@/components/city/PortalGrid'
import ColumnEntrances from '@/components/city/ColumnEntrances'
import AnnouncementSection from '@/components/city/AnnouncementSection'
import AttachmentSection from '@/components/city/AttachmentSection'
import UniversityGrid from '@/components/city/UniversityGrid'
import CityNotFound from '@/components/city/CityNotFound'

type PageState =
  | { status: 'loading'; adcode: number | null }
  | { status: 'notfound'; adcode: number; provinceName: string | null; provinceAdcode: number | null }
  | { status: 'degraded'; adcode: number; provinceName: string | null; provinceAdcode: number | null }
  | {
      status: 'ready'
      adcode: number
      province: ProvinceData
      city: City
      universities: University[]
      provinceAdcode: number
    }

/** 由城市 adcode 推导所属省 adcode（直辖市即本省；其余取前两位） */
function resolveProvinceAdcode(cityAdcode: number): number {
  if (MUNICIPALITY_ADCODES.has(cityAdcode)) return cityAdcode
  return Math.floor(cityAdcode / 10000) * 10000
}

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 md:py-16 animate-pulse">
      <div className="h-4 w-56 bg-paper-deep rounded" />
      <div className="mt-6 h-12 w-72 bg-paper-deep rounded-lg" />
      <div className="mt-6 h-5 w-96 bg-paper-deep rounded" />
      <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-paper-deep rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 h-96 bg-paper-deep rounded-2xl" />
        <div className="lg:col-span-4 h-96 bg-paper-deep rounded-2xl" />
      </div>
    </div>
  )
}

/**
 * 城市详情页 /city/:adcode（city.md 全部 7 个 Section）。
 * 数据缺失优雅降级；城市不存在时显示优雅 404 态并给出返回省份链接。
 */
export default function CityPage() {
  const { adcode } = useParams<{ adcode: string }>()
  const [state, setState] = useState<PageState>({ status: 'loading', adcode: null })

  const cityAdcode = useMemo(() => {
    const n = Number(adcode)
    return adcode && Number.isFinite(n) ? n : null
  }, [adcode])
  const isMunicipality = cityAdcode !== null && MUNICIPALITY_ADCODES.has(cityAdcode)

  useEffect(() => {
    if (cityAdcode === null) return
    let cancelled = false
    const provAdcode = resolveProvinceAdcode(cityAdcode)
    Promise.all([fetchIndex(), fetchProvince(provAdcode)]).then(([index, prov]) => {
      if (cancelled) return
      const provName = prov?.name ?? index?.provinces.find((p) => p.adcode === provAdcode)?.name ?? null
      if (!prov) {
        // 省级数据文件未就绪：优雅降级（已收录官方入口见省级页）
        setState({ status: 'degraded', adcode: cityAdcode, provinceName: provName, provinceAdcode: provAdcode })
        return
      }
      const city = (prov.cities ?? []).find((c) => c.adcode === cityAdcode)
      if (!city) {
        setState({ status: 'notfound', adcode: cityAdcode, provinceName: provName, provinceAdcode: provAdcode })
        return
      }
      const universities = (prov.universities ?? []).filter((u) => u.cityAdcode === cityAdcode)
      recordCityVisit({ adcode: city.adcode, name: city.name, provinceName: prov.name })
      setState({ status: 'ready', adcode: cityAdcode, province: prov, city, universities, provinceAdcode: provAdcode })
    })
    return () => {
      cancelled = true
    }
  }, [cityAdcode])

  if (cityAdcode === null) {
    return <CityNotFound kind="notfound" provinceName={null} provinceAdcode={null} isMunicipality={false} />
  }
  if (state.status === 'loading' || state.adcode !== cityAdcode) return <LoadingSkeleton />
  if (state.status === 'notfound') {
    return (
      <CityNotFound kind="notfound" provinceName={state.provinceName} provinceAdcode={state.provinceAdcode} isMunicipality={isMunicipality} />
    )
  }
  if (state.status === 'degraded') {
    return (
      <CityNotFound kind="degraded" provinceName={state.provinceName} provinceAdcode={state.provinceAdcode} isMunicipality={isMunicipality} />
    )
  }

  const { province, city, universities, provinceAdcode } = state
  const recruitments = city.recruitments ?? []
  const portals = city.portals ?? []

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 md:py-16">
      {/* Section 1 · 页头 */}
      <CityHeader
        city={city}
        provinceName={province.name}
        provinceAdcode={provinceAdcode}
        isMunicipality={isMunicipality}
        updatedAt={province.updatedAt ?? null}
      />

      {/* Section 2 · 统计总览 */}
      <div className="mt-14 md:mt-20">
        <CityKpis recruitments={recruitments} universityCount={universities.length} />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <TrendChart recruitments={recruitments} updatedAt={province.updatedAt ?? null} />
          <CategoryDonut recruitments={recruitments} updatedAt={province.updatedAt ?? null} />
        </div>
      </div>

      {/* Section 3 · 官方网站直达 */}
      <div className="mt-16 md:mt-24">
        <PortalGrid portals={portals} />
      </div>

      {/* Section 4 · 专栏入口 */}
      <div className="mt-16 md:mt-24">
        <ColumnEntrances adcode={String(city.adcode)} recruitments={recruitments} />
      </div>

      {/* Section 5 · 公告列表 */}
      <div className="mt-16 md:mt-24">
        <AnnouncementSection recruitments={recruitments} />
      </div>

      {/* Section 6 · 附件下载 */}
      <div className="mt-16 md:mt-24">
        <AttachmentSection recruitments={recruitments} cityAdcode={city.adcode} />
      </div>

      {/* Section 7 · 本市高校 */}
      <div className="mt-16 md:mt-24 mb-4">
        <UniversityGrid universities={universities} cityName={city.name} />
      </div>
    </div>
  )
}
