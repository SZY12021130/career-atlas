import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { motion } from 'framer-motion'
import Lenis from 'lenis'
import Navbar from './Navbar'
import Footer from './Footer'

/**
 * 全站布局（pattern B：嵌套路由 + <Outlet/>）。
 * - Navbar sticky 置顶，正常文档流，页面无需偏移记账
 * - Lenis 全站平滑滚动（lerp 0.1, smoothWheel）
 * - 页面转场：opacity 0→1, y 16→0, 0.45s cubic-bezier(0.22,1,0.36,1)
 */
export default function Layout() {
  const location = useLocation()

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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-paper">
      <Navbar />
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
    </div>
  )
}
