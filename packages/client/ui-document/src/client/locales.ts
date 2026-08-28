/** `document` namespace dictionaries for the Report view and present_document card. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'document'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'view.document': '报告',
  'card.title': '提交文档',
  'card.open': '查看报告',
  'source.snapshot': '提交时快照',
  'source.live': '工作区现况',
  'empty': '没有可显示的报告',
  'missing': '无法读取这份报告',
  'truncated': '正文超过上限，请改看工作区现况',
  'imageFailed': '图片无法显示',
  'copy': '复制',
  'copied': '复制成功',
  'footnotes': '脚注',
}

/** Traditional Chinese dictionary, checked complete against the zh key set. */
export const zhHant = {
  'view.document': '報告',
  'card.title': '提交文件',
  'card.open': '查看報告',
  'source.snapshot': '提交時快照',
  'source.live': '工作區現況',
  'empty': '沒有可顯示的報告',
  'missing': '無法讀取這份報告',
  'truncated': '正文超過上限，請改看工作區現況',
  'imageFailed': '圖片無法顯示',
  'copy': '複製',
  'copied': '複製成功',
  'footnotes': '腳註',
}

/** English dictionary (same key set). */
export const en: Record<DocumentKey, string> = {
  'view.document': 'Report',
  'card.title': 'Present document',
  'card.open': 'View report',
  'source.snapshot': 'Snapshot at submit',
  'source.live': 'Workspace now',
  'empty': 'No report to display',
  'missing': 'This report is unreadable',
  'truncated': 'The body exceeded the cap; switch to the workspace file',
  'imageFailed': 'Image failed to load',
  'copy': 'Copy',
  'copied': 'Copied',
  'footnotes': 'Footnotes',
}

/** Union of this namespace's dictionary keys. */
export type DocumentKey = keyof typeof zh
