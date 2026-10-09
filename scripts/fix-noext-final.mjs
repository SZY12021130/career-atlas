/**
 * 无扩展名附件终修（34 个，覆盖两类成因）
 *
 * 关键：前端下载按钮用 data 的 name 字段作为另存文件名（AttachmentItem download 属性），
 * 因此即便磁盘文件有正确后缀，只要 name 缺扩展名，用户下载后仍打不开。必须修 name。
 *
 * 两类处理：
 *  A. 磁盘 basename 有扩展名、name 缺   → 直接把磁盘 basename 赋给 name（纯数据修正，零磁盘操作）
 *  B. 磁盘 basename 也无扩展名（6 个）  → 读文件头判型得 ext，磁盘重命名 +ext，同步 name/local
 *
 * 对 B 类里名称残缺的（如唐山「2025年唐山市202」），额外参考所属公告标题给出可辨识名，
 * 但不臆造：判型只依据文件头 magic bytes。
 *
 * 用法：node scripts/fix-noext-final.mjs [--apply]
 */
import fs from 'node:fs'
import path from 'node:path'
import { detectExt } from './lib/magictype.mjs'
import { normalizeFilename } from './lib/naming.mjs'

const DATA_DIR = path.resolve('public/data')
const PUB = path.resolve('public')
const APPLY = process.argv.includes('--apply')
const EX = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)$/i

/**
 * 从附件官方 URL 恢复真实文件名与扩展名。
 * 官方 URL 尾段常带完整中文名（唐山残缺文件、被判 zip 的 xlsx 皆可由此纠正），
 * 这是取自官方源的确定信息，不是臆造。返回 { name, ext } 或 null。
 */
function nameFromUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    let base = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
    base = base.split('?')[0].split('#')[0]
    const m = EX.exec(base)
    if (!m) return null
    return { name: base, ext: m[0].slice(1).toLowerCase() }
  } catch {
    return null
  }
}

const planA = [] // 仅改 name：{provFile, local, name, fixName}
const planB = [] // 磁盘重命名 + 改 name/local：{provFile, oldRel, newRel, oldName}

for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (!a.local || EX.test(a.name || '')) continue
        const rel = a.local.replace(/\\/g, '/')
        const abs = path.join(PUB, rel)
        if (!fs.existsSync(abs)) continue // 断链另有处理，这里不碰
        const bn = path.basename(rel)
        if (EX.test(bn)) {
          // A：磁盘有后缀，补 name
          planA.push({ provFile: f, url: a.url, name: a.name, fixName: bn })
        } else {
          // B：磁盘也无后缀。
          //  扩展名优先取官方 URL 尾段（权威）—— xlsx 本质是 zip 容器，大文件中央目录
          //  未进文件头前 64KB 时会被 detectExt 误判成 zip，URL 能纠正。URL 无扩展名才兜底判型。
          const fromUrl = nameFromUrl(a.url)
          let ext = fromUrl?.ext || detectExt(fs.readFileSync(abs))
          if (!ext) continue // 判不了类型，保留（不猜测）

          // 文件名主体：磁盘 bn 已在上游规范过，若它以文档实词结尾则信任它；
          // 否则视为被截断（如「2025年唐山市202」），用 URL 全名规范化恢复。
          const looksComplete = /(表|名单|目录|大纲|公告|须知|指南|简章|计划|岗位|信息|方案|情况|一览|说明|证明|承诺书|推荐表|报名表)$/.test(bn)
          let stem
          if (looksComplete) {
            stem = bn
          } else if (fromUrl) {
            // 用 URL 名（去扩展名后）规范化：去「附件N：」前缀、年份前移
            const urlBase = fromUrl.name.slice(0, fromUrl.name.length - path.extname(fromUrl.name).length)
            const norm = normalizeFilename(`${urlBase}.x`) // 借用规范化，扩展名占位后剥离
            stem = norm.slice(0, norm.length - 2)
          } else {
            stem = bn
          }
          if (!stem) continue

          const newBase = `${stem}.${ext}`
          const dirRel = rel.slice(0, rel.lastIndexOf('/'))
          planB.push({ provFile: f, oldRel: rel, newRel: `${dirRel}/${newBase}`, url: a.url, oldName: a.name, ext, cityAdcode: Number(c.adcode) })
        }
      }
    }
  }
}

console.log(`=== 无扩展名终修（${APPLY ? 'APPLY' : 'DRY-RUN'}）===`)
console.log(`  A 类（仅补 name，磁盘有后缀）：${planA.length}`)
console.log(`  B 类（磁盘判型重命名+补 name）：${planB.length}`)
const extDist = new Map()
for (const p of planB) extDist.set(p.ext, (extDist.get(p.ext) || 0) + 1)
console.log(`  B 类判型分布：${JSON.stringify(Object.fromEntries(extDist))}`)

console.log('\n  A 类样本（前 6）：')
for (const p of planA.slice(0, 6)) console.log(`    name「${p.name}」→「${p.fixName}」`)
console.log('\n  B 类样本：')
for (const p of planB) console.log(`    ${path.basename(p.oldRel)} → ${path.basename(p.newRel)}  (${p.cityAdcode})`)

if (!APPLY) { console.log('\n(dry-run，未修改。加 --apply 执行)'); process.exit(0) }

// B 类：先磁盘重命名（冲突避让），收集 old→new
const renamedB = new Map()
for (const p of planB) {
  const oldAbs = path.join(PUB, p.oldRel)
  const newAbs = path.join(PUB, p.newRel)
  if (fs.existsSync(newAbs)) {
    const ext = path.extname(p.newRel)
    const stem = p.newRel.slice(0, p.newRel.length - ext.length)
    const dir = p.newRel.slice(0, p.newRel.lastIndexOf('/') + 1)
    let i = 2
    let cand = `${dir}${stem}_${i}${ext}`
    while (fs.existsSync(path.join(PUB, cand))) { i++; cand = `${dir}${stem}_${i}${ext}` }
    fs.renameSync(oldAbs, path.join(PUB, cand))
    renamedB.set(p.oldRel, cand)
  } else {
    fs.renameSync(oldAbs, newAbs)
    renamedB.set(p.oldRel, p.newRel)
  }
}

// 回写数据：A 补 name，B 改 name+local
let wa = 0, wb = 0
const touched = new Set()
for (const f of new Set([...planA.map((x) => x.provFile), ...planB.map((x) => x.provFile)])) {
  const fp = path.join(DATA_DIR, f)
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (!a.local) continue
        const rel = a.local.replace(/\\/g, '/')
        const inA = planA.find((p) => p.provFile === f && p.url === a.url && EX.test(p.fixName) && !EX.test(a.name || ''))
        if (inA) { a.name = inA.fixName; wa++; touched.add(f); continue }
        const newRel = renamedB.get(rel)
        if (newRel) { a.local = newRel; a.name = path.basename(newRel); wb++; touched.add(f) }
      }
    }
  }
  if (touched.has(f)) fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8')
}
console.log(`\n完成：A 补 name ${wa} 条 · B 重命名并更新 ${wb} 条 · 触及 ${touched.size} 个省文件`)
