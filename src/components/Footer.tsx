import { Link } from 'react-router'
import { Github } from 'lucide-react'

const RESERVED_TAGS = [
  { label: '国企 / 央企', to: '/reserved/guoqi' },
  { label: '互联网大厂', to: '/reserved/dachang' },
  { label: '博士后', to: '/reserved/boshi' },
]

export default function Footer() {
  return (
    <footer className="bg-ink text-paper/70">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* 项目说明 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <img src="/logo.svg" alt="职途图谱" className="w-8 h-8 rounded-md" />
            <span className="font-serif font-bold text-paper text-base">职途图谱</span>
          </div>
          <p className="text-sm leading-7 text-paper/60">
            面向大学生与博士生的一站式官方招录信息图谱。本站所有公告与附件链接均指向各官方招录网站，原始发布为准，仅做索引与可视化整理。
          </p>
        </div>
        {/* 快速入口 */}
        <div>
          <h3 className="text-sm font-bold text-paper mb-4 tracking-wide">快速入口</h3>
          <ul className="space-y-2.5 text-sm">
            {RESERVED_TAGS.map((t) => (
              <li key={t.to}>
                <Link to={t.to} className="hover:text-paper transition-colors duration-200">
                  {t.label}
                  <span className="ml-2 text-xs text-paper/40">预留</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {/* 仓库 */}
        <div>
          <h3 className="text-sm font-bold text-paper mb-4 tracking-wide">开源</h3>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm hover:text-paper transition-colors duration-200"
          >
            <Github className="w-4 h-4" />
            GitHub 仓库
          </a>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 text-center text-xs text-paper/45">
          © 2026 职途图谱 · 数据来源于各官方招录网站 · 仅供学习参考
        </div>
      </div>
    </footer>
  )
}
