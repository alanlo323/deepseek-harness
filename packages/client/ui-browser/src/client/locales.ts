/** `browser` namespace dictionaries for the viewport column and overlay. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'browser'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '浏览器',
  'empty': '暂无画面',
  'dismiss': '收起',
  'enlarge': '放大',
  'shrink': '缩小',
}

/** Traditional Chinese dictionary, checked complete against the zh key set. */
export const zhHant = {
  'title': '瀏覽器',
  'empty': '暫無畫面',
  'dismiss': '收起',
  'enlarge': '放大',
  'shrink': '縮小',
}

/** English dictionary (same key set). */
export const en: Record<BrowserKey, string> = {
  'title': 'Browser',
  'empty': 'No frame yet',
  'dismiss': 'Hide',
  'enlarge': 'Enlarge',
  'shrink': 'Shrink',
}

/** Union of this namespace's dictionary keys. */
export type BrowserKey = keyof typeof zh
