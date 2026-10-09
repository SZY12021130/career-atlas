/**
 * 数据回写：把新下载的附件合并进各省 JSON，并用发现阶段抓到的发布日期补齐空白 date。
 *
 * 原则：
 *  - 绝不删除或覆盖既有数据，只做增量合并
 *  - 附件按 URL 去重；已有记录仅补 local 字段
 *  - date 仅在该字段为空/无效时补齐，且必须来自官方公告页解析结果
 *  - 写回前对每个省文件做结构校验，避免写出损坏的 JSON
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadJSON } from './state.mjs'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 应用下载结果与日期补齐。
 * @param {string} dataDir public/data 目录
 * @param {Map|Object} resultsByProv provFile -> [{cityAdcode,pageUrl,attUrl,local,name,title}]
 * @returns {{updatedRecs:number,newAtt:number,datesFilled:number,provinces:number}}
 */
export function applyResults(dataDir, resultsByProv) {
  const manifest = loadJSON('manifest.json', {}) || {}

  /** pageUrl -> 发布日期（发现阶段解析结果） */
  const dateByUrl = new Map()
  for (const entries of Object.values(manifest)) {
    for (const e of entries || []) {
      if (e.url && e.date && DATE_RE.test(e.date)) dateByUrl.set(e.url, e.date)
    }
  }

  let updatedRecs = 0
  let newAtt = 0
  let datesFilled = 0
  let provinces = 0

  const provFiles = new Set()
  // 收集需要改动的省文件：下载结果涉及的 + 有日期可补的
  for (const provFile of Object.keys(resultsByProv || {})) provFiles.add(provFile)
  for (const f of fs.readdirSync(dataDir).filter((x) => /^\d+\.json$/.test(x))) {
    provFiles.add(f)
  }

  for (const provFile of provFiles) {
    const fp = path.join(dataDir, provFile)
    if (!fs.existsSync(fp)) continue

    const raw = fs.readFileSync(fp, 'utf8')
    let d
    try {
      d = JSON.parse(raw)
    } catch (e) {
      console.error(`  ⚠️ ${provFile} JSON 解析失败，跳过：${e.message}`)
      continue
    }
    if (!d || !Array.isArray(d.cities)) {
      console.error(`  ⚠️ ${provFile} 结构异常（无 cities 数组），跳过`)
      continue
    }

    const before = JSON.stringify(d)
    const items = (resultsByProv && resultsByProv.get
      ? resultsByProv.get(provFile)
      : resultsByProv[provFile]) || []

    // ---- 1) 合并新附件 ----
    for (const it of items) {
      const city = d.cities.find((c) => c.adcode === it.cityAdcode)
      if (!city) continue
      const rec = (city.recruitments || []).find((r) => r.url === it.pageUrl)
      if (!rec) continue

      rec.attachments = rec.attachments || []
      const known = new Set(rec.attachments.map((a) => a.url).filter(Boolean))

      if (known.has(it.attUrl)) {
        // 已有记录：仅补 local
        const ex = rec.attachments.find((a) => a.url === it.attUrl)
        if (ex && !ex.local) {
          ex.local = it.local
          updatedRecs++
        }
        continue
      }
      rec.attachments.push({
        name: it.name || path.basename(it.local || ''),
        url: it.attUrl,
        local: it.local || null,
      })
      known.add(it.attUrl)
      newAtt++
      updatedRecs++
    }

    // ---- 2) 补齐空白日期 ----
    for (const city of d.cities) {
      for (const rec of city.recruitments || []) {
        if (!rec.url) continue
        const hasValid = rec.date && DATE_RE.test(rec.date)
        if (hasValid) continue
        const found = dateByUrl.get(rec.url)
        if (found) {
          rec.date = found
          datesFilled++
        }
      }
    }

    const after = JSON.stringify(d)
    if (after !== before) {
      // 更新日期戳（保留原有 updatedAt 若为今日则不变）
      const today = new Date().toISOString().slice(0, 10)
      if (!d.updatedAt || d.updatedAt < today) d.updatedAt = today
      fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8')
      provinces++
    }
  }

  return { updatedRecs, newAtt, datesFilled, provinces }
}
