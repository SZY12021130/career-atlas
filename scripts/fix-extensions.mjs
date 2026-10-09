/**
 * 无扩展名附件修复：按文件头 magic bytes 判定真实类型，补全扩展名。
 *
 * 这些文件内容已校验为真实文档，只是采集时锚文本/URL 都无扩展名，
 * 导致文件名缺失后缀 —— 用户下载后系统无法识别类型。
 *
 * 安全：
 *  - 只处理「无扩展名」的文件，已有扩展名的一律不动
 *  - 磁盘重命名 + 数据 JSON 的 name/local 同步更新
 *  - 目标名已存在时追加序号，绝不覆盖
 *  - 先 dry-run 输出清单，确认后 --apply
 *
 * 用法：node scripts/fix-extensions.mjs [--apply]
 */
import fs from 'node:fs'
import path from 'node:path'
import { detectExt } from './lib/magictype.mjs'

const DATA_DIR = path.resolve('public/data')
const PUB = path.resolve('public')
const APPLY = process.argv.includes('--apply')

/** 判型实现见 scripts/lib/magictype.mjs（与 fix-noext-final.mjs 共用，避免规则分叉） */

/** 已有合法扩展名则跳过 */
const HAS_EXT = /\.(docx?|xlsx?|pptx?|pdf|wps|et|dps|zip|rar|7z|txt|csv|ofd)$/i

// ---------------------------------------------------------------------------
// 扫描：数据中被引用、local 存在、但文件名无扩展名的附件
// ---------------------------------------------------------------------------
const plan = [] // {provFile, cityAdcode, oldRel, newRel}
const targetCount = new Map()

for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const fp = path.join(DATA_DIR, f)
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'))
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (!a.local) continue
        const rel = a.local.replace(/\\/g, '/')
        const base = path.basename(rel)
        if (HAS_EXT.test(base)) continue // 已有扩展名，跳过
        const abs = path.join(PUB, rel)
        if (!fs.existsSync(abs)) continue

        let buf
        try { buf = fs.readFileSync(abs) } catch { continue }
        const ext = detectExt(buf)
        if (!ext) continue // 无法判定类型，保持原名（不猜测）

        const newBase = `${base}.${ext}`
        const dirRel = rel.slice(0, rel.lastIndexOf('/'))
        const newRel = `${dirRel}/${newBase}`
        plan.push({ provFile: f, cityAdcode: Number(c.adcode), oldRel: rel, newRel, oldName: a.name, newName: `${a.name}.${ext}`, ext })
        targetCount.set(newRel, (targetCount.get(newRel) || 0) + 1)
      }
    }
  }
}

// 类型分布
const extDist = new Map()
for (const p of plan) extDist.set(p.ext, (extDist.get(p.ext) || 0) + 1)

console.log(`=== 无扩展名附件修复（${APPLY ? 'APPLY' : 'DRY-RUN'}）===`)
console.log(`  待修复 ${plan.length} 个`)
console.log(`  判定类型分布: ${JSON.stringify(Object.fromEntries([...extDist.entries()].sort((a, b) => b[1] - a[1])))}`)
console.log('')
for (const p of plan.slice(0, 20)) {
  console.log(`  ${p.oldName.slice(0, 34).padEnd(36)} → .${p.ext}`)
}
if (plan.length > 20) console.log(`  … 另有 ${plan.length - 20} 条`)

if (!APPLY) { console.log('\n(dry-run，未修改。加 --apply 执行)'); process.exit(0) }

// ---------------------------------------------------------------------------
// 执行：先改磁盘（含冲突避让），再回写 JSON
// ---------------------------------------------------------------------------
let renamed = 0
const failed = []
const finalMap = new Map() // oldRel -> newRel（实际落地名）
for (const p of plan) {
  const oldAbs = path.join(PUB, p.oldRel)
  let newAbs = path.join(PUB, p.newRel)
  let newRel = p.newRel
  if (fs.existsSync(newAbs) && path.resolve(newAbs) !== path.resolve(oldAbs)) {
    const ext = path.extname(p.newRel)
    const stem = p.newRel.slice(0, p.newRel.length - ext.length)
    const dir = p.newRel.slice(0, p.newRel.lastIndexOf('/') + 1)
    let i = 2
    while (fs.existsSync(newAbs) && i < 40) { newRel = `${dir}${stem}_${i}${ext}`; newAbs = path.join(PUB, newRel); i++ }
    if (fs.existsSync(newAbs)) { failed.push({ ...p, reason: 'target-exists' }); continue }
  }
  try {
    fs.renameSync(oldAbs, newAbs)
    renamed++
    finalMap.set(p.oldRel, newRel)
  } catch (e) {
    failed.push({ ...p, reason: e.message.slice(0, 50) })
  }
}
console.log(`\n磁盘重命名成功 ${renamed} 个 · 失败 ${failed.length} 个`)
for (const f of failed.slice(0, 8)) console.log(`  ⚠️ ${f.reason}: ${f.oldName}`)

// 回写 JSON
let wb = 0
const filesChanged = new Set()
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const fp = path.join(DATA_DIR, f)
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'))
  let changed = false
  for (const c of d.cities || []) {
    for (const r of c.recruitments || []) {
      for (const a of r.attachments || []) {
        if (!a.local) continue
        const rel = a.local.replace(/\\/g, '/')
        const newRel = finalMap.get(rel)
        if (!newRel) continue
        a.local = newRel
        const ext = newRel.slice(newRel.lastIndexOf('.'))
        if (!HAS_EXT.test(a.name || '')) a.name = `${a.name}${ext}`
        changed = true; wb++
      }
    }
  }
  if (changed) { fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8'); filesChanged.add(f) }
}
console.log(`数据回写：${wb} 条附件记录 · ${filesChanged.size} 个省文件`)
