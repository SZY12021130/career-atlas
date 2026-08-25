/**
 * 专栏页数据加载：城市上下文 hook 与纯工具函数（与组件文件分离以满足 react-refresh 约束）。
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import type { Attachment, City, ProvinceData, Recruitment, University } from '@/lib/data'
import { fetchIndex, fetchProvince } from '@/lib/data'

export const YEARS = [2024, 2025, 2026] as const

export interface CityContext {
  loading: boolean
  /** 城市 adcode（路由参数解析失败时为 0） */
  adcode: number
  province: ProvinceData | null
  city: City | null
  provinceName: string
  cityName: string
  /** 本市本科高校（universities 按 cityAdcode 过滤） */
  universities: University[]
}

/** 由城市 adcode 推导省级 adcode（前 4 位 + 00，直辖市天然兼容） */
export function provinceAdcodeOf(cityAdcode: number): number {
  return Math.floor(cityAdcode / 10000) * 10000
}

interface LoadedCity {
  adcode: number
  province: ProvinceData | null
  city: City | null
}

/** 加载城市上下文：省 JSON → 城市记录 + 同城高校；全程 404/缺数据优雅降级 */
export function useCityContext(): CityContext {
  const { adcode: raw } = useParams<{ adcode: string }>()
  const adcode = Number(raw) || 0
  const [loaded, setLoaded] = useState<LoadedCity | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const provAdcode = provinceAdcodeOf(adcode)
      let prov = await fetchProvince(provAdcode)
      let found = prov?.cities?.find((c) => c.adcode === adcode) ?? null
      // 兜底：推导的省 JSON 缺失或不含该市时，扫一遍索引中的其他省份
      if (!found) {
        const index = await fetchIndex()
        for (const entry of index?.provinces ?? []) {
          if (entry.adcode === provAdcode) continue
          const p = await fetchProvince(entry.adcode)
          const c = p?.cities?.find((x) => x.adcode === adcode)
          if (p && c) {
            prov = p
            found = c
            break
          }
        }
      }
      if (!cancelled) setLoaded({ adcode, province: prov, city: found })
    })()
    return () => {
      cancelled = true
    }
  }, [adcode])

  // loading = 尚未拿到与当前 adcode 对应的结果（避免在 effect 里同步 setLoading）
  const current = loaded && loaded.adcode === adcode ? loaded : null
  const province = current?.province ?? null
  const city = current?.city ?? null

  const universities = useMemo(
    () => (province?.universities ?? []).filter((u) => u.cityAdcode === adcode),
    [province, adcode],
  )

  return {
    loading: current === null,
    adcode,
    province,
    city,
    provinceName: province?.name ?? '',
    cityName: city?.name ?? (adcode ? `城市 ${adcode}` : '未知城市'),
    universities,
  }
}

/** 汇总公告附件（按公告年份分组用） */
export function collectAttachments(recruitments: Recruitment[]): { year: number; attachment: Attachment }[] {
  const out: { year: number; attachment: Attachment }[] = []
  for (const r of recruitments) {
    for (const a of r.attachments ?? []) out.push({ year: r.year, attachment: a })
  }
  return out
}
