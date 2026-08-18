import type { CommonKey } from './zh.ts'

/** Traditional Chinese dictionary for the common namespace, checked complete against the zh key set. */
export const zhHant = {
  'ok': '確定',
  'cancel': '取消',
  'close': '關閉',
  'copy': '複製',
  'copied': '複製成功',
  'retry': '重試',
  'loading': '載入中…',
  'load.failed': '載入失敗',
  'submit': '提交',
  'submitting': '正在提交…',
  'next': '下一步',
  'previous': '上一步',
  'skip': '跳過',
  'delete': '刪除',
  'edit': '編輯',
  'save': '儲存',
  'search': '搜尋',
  'more': '更多',
  'collapse': '收合',
  'expand': '展開',
  'back': '返回',
  'unknown': '未知',
  'none': '無',
  'truncated': '已截斷',
} satisfies Record<CommonKey, string>
