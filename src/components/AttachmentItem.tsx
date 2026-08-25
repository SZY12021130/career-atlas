import { Download, ExternalLink, FileSpreadsheet, FileText, File } from 'lucide-react'
import type { Attachment } from '@/lib/data'
import { attachmentUrl } from '@/lib/data'
import { cn } from '@/lib/utils'

const EXT_STYLE: Record<string, { color: string; icon: typeof FileText }> = {
  xlsx: { color: '#3F6C5B', icon: FileSpreadsheet },
  xls: { color: '#3F6C5B', icon: FileSpreadsheet },
  csv: { color: '#3F6C5B', icon: FileSpreadsheet },
  pdf: { color: '#B5493A', icon: FileText },
  doc: { color: '#C08A3E', icon: FileText },
  docx: { color: '#C08A3E', icon: FileText },
}

function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/**
 * 附件下载条：类型图标（xlsx=pine / pdf=cinnabar / doc=ochre）+ 文件名 + 下载或官网获取。
 * local 存在 → 静态路径直接下载；local 为 null → 跳源站。
 */
export default function AttachmentItem({ attachment, cityAdcode, className }: { attachment: Attachment; cityAdcode: number; className?: string }) {
  const ext = extOf(attachment.name)
  const { color, icon: Icon } = EXT_STYLE[ext] ?? { color: '#9A9184', icon: File }
  const local = attachmentUrl(cityAdcode, attachment)

  const inner = (
    <>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}14` }}>
        <Icon className="w-4.5 h-4.5" style={{ color, width: 18, height: 18 }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-ink truncate" title={attachment.name}>{attachment.name}</span>
        <span className="block text-xs text-ink-faint mt-0.5 uppercase">{ext || 'file'}</span>
      </span>
      {local ? (
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-ink text-paper group-hover:bg-cinnabar transition-colors duration-200 shrink-0">
          <Download className="w-3.5 h-3.5" />
          下载
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-line text-ink-soft group-hover:border-cinnabar group-hover:text-cinnabar transition-colors duration-200 shrink-0">
          官网获取
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      )}
    </>
  )

  return (
    <a
      href={local ?? attachment.url}
      target={local ? undefined : '_blank'}
      rel="noreferrer"
      download={local ? attachment.name : undefined}
      className={cn(
        'group flex items-center gap-3 bg-surface rounded-xl border border-line px-4 py-3',
        'transition-all duration-200 hover:shadow-[0_12px_32px_-12px_rgba(42,39,35,.18)]',
        className,
      )}
    >
      {inner}
    </a>
  )
}
