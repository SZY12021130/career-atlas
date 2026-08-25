import { Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import ProvincePage from '@/pages/ProvincePage'
import CityPage from '@/pages/CityPage'
import ColumnPage from '@/pages/ColumnPage'
import UniversityPage from '@/pages/UniversityPage'
import ReservedPage from '@/pages/ReservedPage'

export default function App() {
  return (
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
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
