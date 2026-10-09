/**
 * 附件文件名归一化（README 规范：年份+省市+文档名称）
 *
 * 处理三类问题（保守策略，详见 scripts/lib/naming.mjs）：
 *  1. 序号噪声：开头的「附件1：」「2-1.」「（1）」「一、」，
 *     以及地区名之后的中缀噪声（如「黑龙江哈尔滨附件2：…」）
 *  2. 年份不在开头：「山西太原2026年度…」→「2026年山西太原…」
 *  3. 完全缺年份：用所属公告的 year 字段补齐。该字段来自采集时的
 *     官方公告原文，是已存在的真实年度，不是推测值
 *
 * 刻意不做的事：
 *  - 不新增省 / 市前缀。附件存放于某市目录不等于该市是文档主体，
 *    例如山西省级职位表存放在太原市目录，强行加「太原」属错误归属
 *  - 不改写正文用词
 *  - 含多个不同年份（如「2023年和2024年」）时保持原文，避免拆散语义
 *
 * 安全性：
 *  - 先 dry-run 输出改名清单，确认无误再 --apply
 *  - 磁盘重命名与数据 JSON 的 name/local 字段同步更新，保持一致
 *  - 目标名已存在时不覆盖，追加序号并报告
 *  - 只处理数据中被引用的附件，不触碰未引用文件
 *
 * 用法：node scripts/normalize-names.mjs [--apply]
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeFilename } from './lib/naming.mjs'

const DATA_DIR = path.resolve('public/data')
const PUB = path.resolve('public')
const APPLY = process.argv.includes('--apply')

// ---------------------------------------------------------------------------
// 扫描
// ---------------------------------------------------------------------------
const plan = [] // {provFile, cityAdcode, oldRel, newRel, oldName, newName}
const targetCount = new Map() // 目标相对路径 -> 次数，检测冲突

for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const fp = path.join(DATA_DIR, f)
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'))
  for (const city of d.cities || []) {
    for (const rec of city.recruitments || []) {
      for (const att of rec.attachments || []) {
        if (!att.local) continue
        const oldRel = att.local.replace(/\\/g, '/')
        const oldAbs = path.join(PUB, oldRel)
        if (!fs.existsSync(oldAbs)) continue
        const raw = path.basename(oldRel)
        const next = normalizeFilename(raw, { fallbackYear: rec.year || null })
        if (next === raw) continue

        const dirRel = oldRel.slice(0, oldRel.lastIndexOf('/'))
        const newRel = `${dirRel}/${next}`
        plan.push({ provFile: f, prov: d.name, cityAdcode: city.adcode, oldRel, newRel, oldName: raw, newName: next })
        targetCount.set(newRel, (targetCount.get(newRel) || 0) + 1)
      }
    }
  }
}

// 冲突检测：目标名已存在于磁盘（且不是自身）或被多个源指向
const conflicts = []
const finalPlan = []
for (const p of plan) {
  const newAbs = path.join(PUB, p.newRel)
  const dupTarget = (targetCount.get(p.newRel) || 0) > 1
  const existsOther = fs.existsSync(newAbs) && path.resolve(newAbs) !== path.resolve(path.join(PUB, p.oldRel))
  if (dupTarget || existsOther) {
    // 追加序号避让，绝不覆盖
    const ext = p.newName.includes('.') ? p.newName.slice(p.newName.lastIndexOf('.')) : ''
    const stem = p.newName.slice(0, p.newName.length - ext.length)
    let i = 2
    let candidate = `${stem}_${i}${ext}`
    let candRel = `${p.newRel.slice(0, p.newRel.lastIndexOf('/') + 1)}${candidate}`
    while (fs.existsSync(path.join(PUB, candRel)) && i < 40) {
      i++
      candidate = `${stem}_${i}${ext}`
      candRel = `${p.newRel.slice(0, p.newRel.lastIndexOf('/') + 1)}${candidate}`
    }
    conflicts.push({ ...p, resolved: candRel })
    finalPlan.push({ ...p, newRel: candRel, newName: candidate })
  } else {
    finalPlan.push(p)
  }
}

// ---------------------------------------------------------------------------
// 输出计划
// ---------------------------------------------------------------------------
console.log(`=== 归一化计划（${APPLY ? 'APPLY' : 'DRY-RUN'}）===`)
console.log(`  待改名 ${finalPlan.length} 个 · 冲突避让 ${conflicts.length} 个`)
console.log('')
const shown = finalPlan.slice(0, 40)
for (const p of shown) {
  console.log(`  ${p.prov} (${p.cityAdcode})`)
  console.log(`    旧: ${p.oldName}`)
  console.log(`    新: ${p.newName}`)
}
if (finalPlan.length > shown.length) console.log(`  … 另有 ${finalPlan.length - shown.length} 条`)

if (!APPLY) {
  console.log('\n(dry-run，未做任何修改。确认无误后加 --apply 执行)')
  process.exit(0)
}

// ---------------------------------------------------------------------------
// 执行：先改磁盘，再改 JSON（全部成功后统一写回）
// ---------------------------------------------------------------------------
let renamed = 0
const failed = []
for (const p of finalPlan) {
  const oldAbs = path.join(PUB, p.oldRel)
  const newAbs = path.join(PUB, p.newRel)
  try {
    if (fs.existsSync(newAbs)) {
      failed.push({ ...p, reason: 'target-exists' })
      continue
    }
    fs.renameSync(oldAbs, newAbs)
    renamed++
  } catch (e) {
    failed.push({ ...p, reason: e.message.slice(0, 60) })
  }
}
console.log(`\n磁盘重命名成功 ${renamed} 个 · 失败 ${failed.length} 个`)
for (const f of failed.slice(0, 10)) console.log(`  ⚠️ ${f.reason}: ${f.oldRel}`)

// 回写 JSON：按 oldRel -> newRel 映射更新 name/local
const renamedMap = new Map(finalPlan.filter((p) => !failed.some((x) => x.oldRel === p.oldRel)).map((p) => [p.oldRel, p]))
let updatedFiles = 0
let updatedAtts = 0
for (const f of fs.readdirSync(DATA_DIR).filter((x) => /^\d+\.json$/.test(x))) {
  const fp = path.join(DATA_DIR, f)
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'))
  let changed = false
  for (const city of d.cities || []) {
    for (const rec of city.recruitments || []) {
      for (const att of rec.attachments || []) {
        if (!att.local) continue
        const rel = att.local.replace(/\\/g, '/')
        const hit = renamedMap.get(rel)
        if (!hit) continue
        att.local = hit.newRel
        att.name = hit.newName
        changed = true
        updatedAtts++
      }
    }
  }
  if (changed) {
    fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8')
    updatedFiles++
  }
}
console.log(`数据回写：${updatedAtts} 条附件记录 · ${updatedFiles} 个省文件`)
