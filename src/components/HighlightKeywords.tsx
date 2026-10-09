/**
 * 关键词高亮：把「公务员 / 选调 / 事业单位 / 人才引进」四大类关键词
 * 按全站统一的分类语义色（lib/theme.ts）着色，让用户在长标题、
 * 公告列表、附件名、说明文字里一眼分辨所属通道。
 *
 * 实现要点：
 *  - 长词优先。「事业单位」「人才引进」必须排在「选调」之前，
 *    否则 alternation 会在「事业单位」里误命中；「选调生」排在「选调」之前。
 *  - 纯字符串切片渲染，不使用 dangerouslySetInnerHTML，避免 XSS。
 *  - 大小写与全角空格不敏感，兼容「选调 生」这类公告标题里的空格。
 */
import { Fragment, useMemo } from 'react'
import { CATEGORY_COLORS } from '@/lib/theme'

/**
 * 关键词 → 语义色。顺序即匹配优先级，长词在前。
 * 「选调」与「选调生」同色，命中任一都归为选调类。
 */
const KEYWORD_RULES: { pattern: RegExp; color: string }[] = [
  { pattern: /事业单位/g, color: CATEGORY_COLORS.事业单位 },
  { pattern: /人才引进/g, color: CATEGORY_COLORS.人才引进 },
  { pattern: /公务员/g, color: CATEGORY_COLORS.公务员 },
  { pattern: /选调生/g, color: CATEGORY_COLORS.选调生 },
  { pattern: /选调/g, color: CATEGORY_COLORS.选调 },
]

/** 合并为单一正则，长词优先；用于一次性切分文本 */
const COMBINED = new RegExp(
  KEYWORD_RULES.map((r) => r.pattern.source).join('|'),
  'g',
)

/** 按命中词反查其语义色 */
function colorOf(matched: string): string {
  for (const rule of KEYWORD_RULES) {
    rule.pattern.lastIndex = 0
    if (rule.pattern.test(matched)) return rule.color
  }
  return CATEGORY_COLORS.公务员
}

export interface HighlightKeywordsProps {
  text: string
  /** 关闭高亮，退化为纯文本（如纯 title 属性场景） */
  disabled?: boolean
  /** 高亮样式变体：tint=淡底着色字（默认，适合正文）；bold=加粗着色（适合标题） */
  variant?: 'tint' | 'bold'
  className?: string
}

/**
 * 高亮渲染。返回 Fragment 序列，可直接嵌入 <span>/<p>/<td> 等文本容器。
 */
export default function HighlightKeywords({ text, disabled, variant = 'tint', className }: HighlightKeywordsProps) {
  const parts = useMemo(() => {
    if (!text) return [] as { s: string; color: string | null }[]
    if (disabled) return [{ s: text, color: null }]

    const out: { s: string; color: string | null }[] = []
    let last = 0
    COMBINED.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = COMBINED.exec(text)) !== null) {
      // 防御：零宽匹配会导致死循环
      if (m[0].length === 0) {
        COMBINED.lastIndex++
        continue
      }
      if (m.index > last) out.push({ s: text.slice(last, m.index), color: null })
      out.push({ s: m[0], color: colorOf(m[0]) })
      last = m.index + m[0].length
    }
    if (last < text.length) out.push({ s: text.slice(last), color: null })
    return out
  }, [text, disabled])

  if (parts.length === 0) return null

  const nodes = parts.map((p, i) =>
    p.color ? (
      <span
        key={i}
        className={variant === 'bold' ? 'font-bold rounded-[3px] px-[2px]' : 'font-semibold rounded-[3px] px-[2px]'}
        style={{
          color: p.color,
          backgroundColor: `${p.color}1F`,
          boxShadow: `inset 0 -1px 0 ${p.color}55`,
        }}
      >
        {p.s}
      </span>
    ) : (
      <Fragment key={i}>{p.s}</Fragment>
    ),
  )

  // 传入 className 时用 span 包裹（如需要额外间距/继承样式）；否则直接返回片段，
  // 便于无缝嵌入既有的 <span>/<td>/<p> 文本容器而不改变原有布局。
  if (className) return <span className={className}>{nodes}</span>
  return <>{nodes}</>
}

/**
 * 提取文本中命中的关键词（去重），用于给卡片/行打分类标记或统计。
 */
export function matchedKeywords(text: string): string[] {
  if (!text) return []
  const hits = new Set<string>()
  COMBINED.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = COMBINED.exec(text)) !== null) {
    if (m[0].length === 0) {
      COMBINED.lastIndex++
      continue
    }
    // 归一：选调生 → 选调，其余原样
    hits.add(m[0] === '选调生' ? '选调' : m[0])
  }
  return [...hits]
}
