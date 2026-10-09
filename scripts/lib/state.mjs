/**
 * 采集状态管理：支持断点续传，避免重复抓取。
 * 状态文件位于 scripts/.state/，已在 .gitignore 中排除，不进入版本库。
 */
import fs from 'node:fs'
import path from 'node:path'

const STATE_DIR = path.resolve('scripts/.state')

function ensureDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true })
}

export function stateFile(name) {
  ensureDir()
  return path.join(STATE_DIR, name)
}

/** 读取已处理 URL 集合（断点续传核心） */
export function loadDone(name) {
  const f = stateFile(name)
  if (!fs.existsSync(f)) return new Set()
  try {
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    return new Set(lines.filter(Boolean))
  } catch {
    return new Set()
  }
}

/** 追加写入流：批量 flush，避免频繁 IO */
export function createAppender(name) {
  ensureDir()
  const f = stateFile(name)
  let buf = []
  return {
    push(line) {
      buf.push(line)
      if (buf.length >= 25) this.flush()
    },
    flush() {
      if (buf.length === 0) return
      try {
        fs.appendFileSync(f, buf.join('\n') + '\n', 'utf8')
      } catch {
        /* 状态写入失败不应中断采集 */
      }
      buf = []
    },
  }
}

/** 读取/写入 JSON 报告 */
export function loadJSON(name, fallback = null) {
  const f = stateFile(name)
  if (!fs.existsSync(f)) return fallback
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return fallback
  }
}

export function saveJSON(name, data) {
  ensureDir()
  fs.writeFileSync(stateFile(name), JSON.stringify(data, null, 2), 'utf8')
}
