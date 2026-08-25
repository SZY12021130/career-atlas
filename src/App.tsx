import { useEffect } from 'react'
import { Routes, Route, useLocation, matchPath } from 'react-router'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import ProvincePage from '@/pages/ProvincePage'
import CityPage from '@/pages/CityPage'
import ColumnPage from '@/pages/ColumnPage'
import UniversityPage from '@/pages/UniversityPage'
import ReservedPage from '@/pages/ReservedPage'
import AboutPage from '@/pages/AboutPage'

const COLUMN_TITLES: Record<string, string> = {
  xuandiao: '选调专栏',
  shiye: '事业单位专栏',
  rencai: '人才引进专栏',
}
const RESERVED_TITLES: Record<string, string> = {
  guoqi: '国企/央企',
  dachang: '互联网大厂',
  boshi: '博士后',
}

/** 动态页面标题（利于分享与浏览器标签识别） */
function usePageTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    let title = '职途图谱 · 公务员/选调/事业单位/人才引进一手信息平台'
    const dec = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }
    const mCol = matchPath('/city/:adcode/:column', pathname)
    const mCity = matchPath('/city/:adcode', pathname)
    const mProv = matchPath('/province/:adcode', pathname)
    const mUni = matchPath('/university/:name', pathname)
    const mRes = matchPath('/reserved/:tag', pathname)
    if (mCol?.params.column) title = `${COLUMN_TITLES[mCol.params.column] ?? '专栏'} · 职途图谱`
    else if (mCity) title = '城市就业信息 · 职途图谱'
    else if (mProv) title = '省级地图 · 职途图谱'
    else if (mUni?.params.name) title = `${dec(mUni.params.name)} · 职途图谱`
    else if (mRes?.params.tag) title = `${RESERVED_TITLES[mRes.params.tag] ?? '预留标签'} · 职途图谱`
    else if (pathname === '/about') title = '数据说明 · 职途图谱'
    document.title = title
  }, [pathname])
}

function TitleWatcher() {
  usePageTitle()
  return null
}

export default function App() {
  return (
    <>
      <TitleWatcher />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="province/:adcode" element={<ProvincePage />} />
          <Route path="city/:adcode" element={<CityPage />} />
          <Route path="city/:adcode/xuandiao" element={<ColumnPage kind="xuandiao" />} />
          <Route path="city/:adcode/shiye" element={<ColumnPage kind="shiye" />} />
          <Route path="city/:adcode/rencai" element={<ColumnPage kind="rencai" />} />
          <Route path="university/:name" element={<UniversityPage />} />
          <Route path="reserved/:tag" element={<ReservedPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </>
  )
}
