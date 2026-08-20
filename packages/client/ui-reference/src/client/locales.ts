/** `reference` namespace dictionaries for the unified `@` source. */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Dictionary namespace owned by this plugin. */
export const NS = 'reference'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.files': '文件与文件夹',
  'section.sessions': 'Session 对话',
  'candidate.file': '文件',
  'candidate.folder': '文件夹',
  'candidate.session': 'Session',
  'candidate.noCwd': '（无工作目录）',
} satisfies Record<string, string>

/** The reference namespace key union. */
export type ReferenceKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The unified `@` reference menu's copy. */
    reference: ReferenceKey
  }
}

/** Traditional Chinese dictionary, checked complete against the zh key set. */
export const zhHant = {
  'section.files': '檔案與資料夾',
  'section.sessions': 'Session 對話',
  'candidate.file': '檔案',
  'candidate.folder': '資料夾',
  'candidate.session': 'Session',
  'candidate.noCwd': '（無工作目錄）',
} satisfies Record<ReferenceKey, string>

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.files': 'Files & folders',
  'section.sessions': 'Session conversations',
  'candidate.file': 'File',
  'candidate.folder': 'Folder',
  'candidate.session': 'Session',
  'candidate.noCwd': '(no cwd)',
} satisfies Record<ReferenceKey, string>
