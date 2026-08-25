import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, RefreshCw, Share2 } from 'lucide-react'
import { Link } from 'react-router'
import Breadcrumb from '@/components/Breadcrumb'
import TagBadge from '@/components/TagBadge'
import type { City } from '@/lib/data'
import { cityTypeLabel } from './cityUtils'

export interface CityHeaderProps {
  city: City
  provinceName: string
  provinceAdcode: number
  isMunicipality: boolean
  updatedAt: string | null
}

const badgeContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.35 } },
}
const badgeItem = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

/** 分享本页：一键复制当前链接（v2.0 需求 3） */
function ShareButton() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // 降级：临时输入框复制
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-cinnabar border border-line hover:border-cinnabar rounded-full px-4 py-2 transition-colors duration-200 bg-surface"
    >
      {copied ? <Check className="w-4 h-4 text-pine" /> : <Share2 className="w-4 h-4" />}
      {copied ? '已复制链接' : '分享本页'}
    </button>
  )
}

/**
 * Section 1 · 页头：面包屑 + 城市名（字符 stagger）+ 类型徽章 + 区县 TagBadge 流 + 返回省份链接。
 */
export default function CityHeader({ city, provinceName, provinceAdcode, isMunicipality, updatedAt }: CityHeaderProps) {
  const crumbItems = isMunicipality
    ? [{ label: '首页', to: '/' }, { label: city.name }]
    : [{ label: '首页', to: '/' }, { label: provinceName, to: `/province/${provinceAdcode}` }, { label: city.name }]

  return (
    <header className="flex items-start justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <Breadcrumb items={crumbItems} />
        </motion.div>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <h1
            className="font-serif font-bold text-ink leading-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '0.02em' }}
          >
            {city.name.split('').map((ch, i) => (
              <motion.span
                key={`${ch}-${i}`}
                className="inline-block"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.045, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                {ch}
              </motion.span>
            ))}
          </h1>
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <TagBadge label={cityTypeLabel(city.name, city.adcode)} variant="university" />
          </motion.span>
        </div>

        {city.districts.length > 0 && (
          <motion.div
            className="mt-4 flex items-center gap-2 flex-wrap"
            variants={badgeContainer}
            initial="hidden"
            animate="show"
          >
            <span className="text-[13px] text-ink-faint shrink-0">下辖区县：</span>
            {city.districts.map((d) => (
              <motion.span key={d} variants={badgeItem} className="inline-flex">
                <TagBadge label={d} variant="university" />
              </motion.span>
            ))}
          </motion.div>
        )}

        {updatedAt && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint">
            <RefreshCw className="w-3 h-3" />
            更新于 {updatedAt}
          </p>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex items-center gap-2.5 shrink-0"
      >
        <ShareButton />
        <Link
          to={isMunicipality ? '/' : `/province/${provinceAdcode}`}
          className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-cinnabar border border-line hover:border-cinnabar rounded-full px-4 py-2 transition-colors duration-200 bg-surface"
        >
          <ArrowLeft className="w-4 h-4" />
          {isMunicipality ? '返回全国地图' : `返回${provinceName}地图`}
        </Link>
      </motion.div>
    </header>
  )
}
