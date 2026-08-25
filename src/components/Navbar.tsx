import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { assetUrl } from '@/lib/data'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: '首页', to: '/' },
  { label: '数据说明', to: '/about' },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const goMap = () => {
    setOpen(false)
    if (location.pathname === '/') {
      document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/', { state: { scrollTo: 'map' } })
    }
  }

  return (
    <header className="sticky top-0 z-50 h-16 bg-paper/90 backdrop-blur-md border-b border-line">
      <div className="max-w-[1680px] mx-auto h-full px-6 lg:px-10 flex items-center justify-between gap-4">
        {/* 左：logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0" onClick={() => setOpen(false)}>
          <img src={assetUrl('logo.svg')} alt="职途图谱" className="w-9 h-9 rounded-lg" />
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
          <button
            type="button"
            onClick={goMap}
            className="relative py-1 text-sm text-ink-soft hover:text-ink transition-colors duration-200"
          >
            全国地图
          </button>
        </nav>

        {/* 右：快捷键提示 + 移动端汉堡 */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-ink-faint bg-surface border border-line rounded-full px-3 py-1 shrink-0">
            <kbd className="font-num text-ink-soft">Ctrl</kbd>
            <span className="text-ink-soft">+</span>
            <kbd className="font-num text-ink-soft">K</kbd>
            <span className="ml-1">快速搜索</span>
          </span>
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
            className="md:hidden absolute top-16 left-0 right-0 bg-paper border-b border-line shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]"
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
              <button
                type="button"
                onClick={goMap}
                className="py-2.5 text-left text-sm text-ink-soft hover:text-cinnabar transition-colors"
              >
                全国地图
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
