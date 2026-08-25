import XuandiaoColumn from '@/components/columns/XuandiaoColumn'
import ShiyeColumn from '@/components/columns/ShiyeColumn'
import RencaiColumn from '@/components/columns/RencaiColumn'
import { useCityContext } from '@/components/columns/useCityContext'

/**
 * 城市专栏页出口：按 App.tsx 路由传入的 kind 分发到三个专栏子组件
 * （/city/:adcode/xuandiao | shiye | rencai）。
 */
export default function ColumnPage({ kind }: { kind: 'xuandiao' | 'shiye' | 'rencai' }) {
  const ctx = useCityContext()
  if (kind === 'xuandiao') return <XuandiaoColumn ctx={ctx} />
  if (kind === 'shiye') return <ShiyeColumn ctx={ctx} />
  return <RencaiColumn ctx={ctx} />
}
