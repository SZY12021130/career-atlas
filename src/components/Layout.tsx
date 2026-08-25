import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import Lenis from 'lenis'
import { ArrowUp } from 'lucide-react'
import Navbar from './Navbar'
import Footer from './Footer'

/** 导航栏下方滚动进度条 */
function ScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setP(max > 0 ? h.scrollTop / max : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="fixed top-16 left-0 right-0 h-0.5 z-40 pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-cinnabar-deep to-cinnabar shadow-[0_0_8px_rgba(34,211,238,.6)]"
        style={{ width: `${p * 100}%` }}
      />
    </div>
  )
}

/** 返回顶部悬浮按钮：滚动超过一屏出现 */
function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          aria-label="返回顶部"
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-surface border border-cinnabar/50 text-cinnabar flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(34,211,238,.45)] hover:bg-cinnabar hover:text-paper transition-colors duration-200"
        >
          <ArrowUp className="w-5 h-5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/**
 * 全站布局（pattern B：嵌套路由 + <Outlet/>）。
 * - Navbar sticky 置顶，正常文档流，页面无需偏移记账
 * - Lenis 全站平滑滚动（lerp 0.1, smoothWheel）
 * - 页面转场：opacity 0→1, y 16→0, 0.45s cubic-bezier(0.22,1,0.36,1)
 * - 全局快捷键：Ctrl/⌘+K 或 "/" 唤起并聚焦全站搜索（v2.0 需求 1）
 */
export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      // 地图等原生滚轮缩放区域不参与 Lenis 平滑滚动
      prevent: (node) => !!node.closest?.('[data-lenis-prevent]'),
    })
    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  // 路由切换回到顶部（hash 导航除外）
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  // 全局搜索快捷键：Ctrl/⌘+K 或 "/"
  useEffect(() => {
    const focusSearch = () => {
      if (location.pathname === '/') {
        document.getElementById('global-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        document.getElementById('global-search-input')?.focus()
      } else {
        navigate('/', { state: { focusSearch: true } })
      }
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        focusSearch()
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        focusSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [location.pathname, navigate])

  return (
    <div className="min-h-[100dvh] flex flex-col bg-paper">
      <Navbar />
      <ScrollProgress />
      <main className="flex-1">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}
