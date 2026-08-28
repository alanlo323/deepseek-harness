/** `settings.theme` namespace dictionaries (the Appearance and font-size rows' copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'appearance.title': '外观',
  'appearance.light': '浅色',
  'appearance.dark': '深色',
  'appearance.system': '跟随系统',
  'fontSize.title': '字号大小',
  'fontSize.description': '仅影响会话内容的字号',
  'fontSize.unit': 'px',
  'fontSize.increase': '增大字号',
  'fontSize.decrease': '减小字号',
} satisfies Record<string, string>


/** Traditional Chinese dictionary, checked complete against the zh key set. */
export const zhHant = {
  'appearance.title': '外觀',
  'appearance.light': '淺色',
  'appearance.dark': '深色',
  'appearance.system': '跟隨系統',
  'fontSize.title': '字號大小',
  'fontSize.description': '僅影響會話內容的字號',
  'fontSize.unit': 'px',
  'fontSize.increase': '增大字號',
  'fontSize.decrease': '減小字號',
} satisfies typeof zh

/** The settings.theme namespace key union. */
export type ThemeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
  'fontSize.title': 'Font size',
  'fontSize.description': 'Only affects conversation content',
  'fontSize.unit': 'px',
  'fontSize.increase': 'Increase font size',
  'fontSize.decrease': 'Decrease font size',
} satisfies Record<ThemeKey, string>
