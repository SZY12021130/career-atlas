import type { ReactNode } from 'react'

/** 区块标题：1.75rem Serif 700 + 左侧 6px 朱砂短竖线（design.md §3） */
export default function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
      <h2 className="flex items-center gap-3 font-serif font-bold text-ink text-[1.75rem] leading-snug">
        <span className="w-1.5 h-7 bg-cinnabar rounded-full shrink-0" aria-hidden />
        {children}
      </h2>
      {extra}
    </div>
  )
}
