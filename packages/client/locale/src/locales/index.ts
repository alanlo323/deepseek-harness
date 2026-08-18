/**
 * The common-namespace dictionaries. zh is the source of truth for the
 * key set (Chinese-first repo convention); en and zh-Hant are checked
 * complete against it — a missing or extra key is a compile error.
 */
export { zh } from './zh.ts'
export { en } from './en.ts'
export { zhHant } from './zh-Hant.ts'
export type { CommonKey } from './zh.ts'
