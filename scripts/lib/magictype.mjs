/**
 * 按文件头 magic bytes 判定文档类型。
 *
 * 采集阶段只校验「是不是文档」（fetcher.looksLikeDocument），
 * 落地文件名缺扩展名时需进一步判出具体类型，本模块供
 * fix-extensions.mjs / fix-noext-final.mjs 共用，避免两处规则分叉。
 */

/**
 * 判定扩展名（不含点），无法判定时返回 null。
 */
export function detectExt(buf) {
  if (!buf || buf.length < 8) return null
  const h = buf.slice(0, 8)
  const hex = h.toString('hex')
  const latin = h.toString('latin1')

  // PDF
  if (latin.startsWith('%PDF-')) return 'pdf'
  // OLE2 复合文档：老式 .doc/.xls/.ppt/.wps
  if (hex === 'd0cf11e0a1b11ae1') return oleSubtype(buf)
  // ZIP 容器：docx/xlsx/pptx/ofd/zip
  if (h[0] === 0x50 && h[1] === 0x4b) return zipSubtype(buf)
  // RAR
  if (latin.startsWith('Rar!')) return 'rar'
  // 7z
  if (h[0] === 0x37 && h[1] === 0x7a) return '7z'
  return null
}

/**
 * OLE2 细分：按内部特征流名判定（流名以 UTF-16LE 存于目录区，
 * 直接在字节流里搜其特征子串即可）。兜底 doc（Word 最常见）。
 */
function oleSubtype(buf) {
  const scan = buf.slice(0, Math.min(buf.length, 262144)).toString('latin1')
  if (scan.includes('W\x00o\x00r\x00k\x00b\x00o\x00o\x00k') || scan.includes('B\x00o\x00o\x00k')) return 'xls'
  if (scan.includes('P\x00o\x00w\x00e\x00r\x00P\x00o\x00i\x00n\x00t')) return 'ppt'
  if (scan.includes('W\x00o\x00r\x00d\x00D\x00o\x00c\x00u\x00m\x00e\x00n\x00t')) return 'doc'
  if (scan.includes('W\x00P\x00S')) return 'wps'
  return 'doc'
}

/** ZIP 容器细分：从本地文件头搜 Office/OFD 特征目录项 */
function zipSubtype(buf) {
  const head = buf.slice(0, Math.min(buf.length, 65536)).toString('latin1')
  if (head.includes('word/document.xml')) return 'docx'
  if (head.includes('xl/workbook.xml')) return 'xlsx'
  if (head.includes('ppt/presentation.xml')) return 'pptx'
  if (head.includes('OFD.xml') || head.includes('Doc_0/')) return 'ofd'
  if (head.includes('wps/')) return 'wps'
  return 'zip'
}
