import { fetchIndex, fetchProvince } from '@/lib/data'
import type { City, RecruitmentCategory, University } from '@/lib/data'

/**
 * 高校详情页数据聚合 helper（/university/:name）。
 * 从 34 省 data JSON 聚合查找高校，数据缺失时优雅降级（返回 null / 空数组）。
 */

export interface UniversityRecord {
  university: University
  province: { adcode: number; name: string; updatedAt: string }
  /** 所在城市数据（可能未收录 → null） */
  city: City | null
  /** 同城其他高校（排除自身） */
  peers: University[]
}

/** 按校名在全部省份数据中查找高校；未收录或索引缺失返回 null */
export async function findUniversity(name: string): Promise<UniversityRecord | null> {
  const target = name.trim()
  if (!target) return null
  const index = await fetchIndex()
  if (!index) return null
  const provinces = await Promise.all(index.provinces.map((p) => fetchProvince(p.adcode)))
  for (const p of provinces) {
    if (!p) continue
    const uni = (p.universities ?? []).find((u) => u.name === target)
    if (uni) {
      return {
        university: uni,
        province: { adcode: p.adcode, name: p.name, updatedAt: p.updatedAt },
        city: (p.cities ?? []).find((c) => c.adcode === uni.cityAdcode) ?? null,
        peers: (p.universities ?? []).filter(
          (u) => u.cityAdcode === uni.cityAdcode && u.name !== uni.name,
        ),
      }
    }
  }
  return null
}

/** 某城市指定分类的近三年公告数（数据缺失按 0 计） */
export function countRecruitments(city: City | null, category: RecruitmentCategory): number {
  if (!city) return 0
  return (city.recruitments ?? []).filter((r) => r.category === category).length
}
