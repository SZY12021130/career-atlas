import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger)

export interface StatCardProps {
  /** 分类色圆点颜色 */
  color?: string
  label: string
  value: number
  suffix?: string
  /** 右下角小字同比说明 */
  hint?: string
  /** 是否滚动计数（默认 true） */
  countUp?: boolean
  className?: string
}

/**
 * KPI 卡：surface 底 + 左上分类色圆点 + Fraunces 大数字（GSAP 滚动计数）+ 右下小字说明。
 * hover 微抬升（纯 CSS transform，避免与 GSAP 混用动画库）。
 */
export default function StatCard({ color = '#F0635A', label, value, suffix, hint, countUp = true, className }: StatCardProps) {
  const numRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!countUp || !numRef.current || !cardRef.current) {
      if (numRef.current) numRef.current.textContent = value.toLocaleString('zh-CN')
      return
    }
    const el = numRef.current
    const counter = { n: 0 }
    const tween = gsap.to(counter, {
      n: value,
      duration: 1.2,
      ease: 'power2.out',
      scrollTrigger: { trigger: cardRef.current, start: 'top 80%', once: true },
      onUpdate: () => {
        el.textContent = Math.round(counter.n).toLocaleString('zh-CN')
      },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [value, countUp])

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative bg-surface rounded-2xl border border-line p-6 md:p-8',
        'shadow-[0_1px_0_rgba(0,0,0,.25)] transition-all duration-200',
        'hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[15px] text-ink-soft">{label}</span>
      </div>
      <div className="font-num font-semibold text-ink leading-none" style={{ fontSize: 'clamp(2.75rem, 4.5vw, 3.75rem)', fontVariantNumeric: 'tabular-nums' }}>
        <span ref={numRef}>0</span>
        {suffix && <span className="text-xl md:text-2xl text-ink-soft ml-1.5 font-sans font-normal">{suffix}</span>}
      </div>
      {hint && <div className="absolute right-5 bottom-4 text-sm text-ink-faint">{hint}</div>}
    </div>
  )
}
