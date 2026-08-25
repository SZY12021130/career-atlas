import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: '首页', to: '/' },
  { label: '全国地图', to: '/#map' },
  { label: '数据说明', to: '/#data-note' },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const goSearch = () => {
    setOpen(false)
    if (location.pathname === '/') {
      document.getElementById('global-search-input')?.focus()
      document.getElementById('global-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      navigate('/#search')
    }
  }

  return (
    <header className="sticky top-0 z-50 h-16 bg-paper/90 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto h-full px-6 lg:px-10 flex items-center justify-between gap-4">
        {/* 左：logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0" onClick={() => setOpen(false)}>
          <img src="/logo.svg" alt="职途图谱" className="w-9 h-9 rounded-lg" />
          <span className="leading-none">
            <span className="block font-serif font-black text-lg text-ink tracking-wide">职途图谱</span>
            <span className="block text-[10px] tracking-[0.28em] text-ink-faint mt-0.5">CAREER ATLAS</span>
          </span>
        </Link>

        {/* 中：导航链接（桌面端） */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => {
            const active = link.to === '/' && location.pathname === '/' && !location.hash
            return (
              <Link
                key={link.label}
                to={link.to}
                className={cn(
                  'relative py-1 text-sm transition-colors duration-200',
                  active ? 'text-cinnabar font-medium' : 'text-ink-soft hover:text-ink',
                )}
              >
                {link.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-cinnabar rounded-full"
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* 右：搜索入口 + 移动端汉堡 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goSearch}
            aria-label="全局搜索"
            className="flex items-center gap-2 h-9 px-3.5 rounded-full border border-line bg-surface text-sm text-ink-soft hover:border-cinnabar hover:text-cinnabar transition-colors duration-200"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">搜索城市 / 高校</span>
          </button>
          <button
            type="button"
            aria-label="菜单"
            className="md:hidden p-2 text-ink-soft hover:text-ink"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 移动端抽屉 */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="md:hidden absolute top-16 left-0 right-0 bg-paper border-b border-line shadow-[0_12px_32px_-12px_rgba(42,39,35,.18)]"
          >
            <div className="px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="py-2.5 text-sm text-ink-soft hover:text-cinnabar transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
