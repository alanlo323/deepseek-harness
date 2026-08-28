/**
 * Workspace-relative logical paths for submitted documents.
 * @module @deepseek-ai/dsh-document-core/path
 */

/** Why a model-supplied path was rejected before any filesystem call. */
export type LogicalPathFailure = 'empty' | 'absolute' | 'escape' | 'invalid'

/** A model-supplied path that is not a workspace-relative logical path. */
export class LogicalPathError extends Error {
  /** Stable failure identity for this rejected path. */
  readonly code: LogicalPathFailure

  /**
   * @param code - stable failure identity.
   * @param message - caller-facing reason.
   */
  constructor(code: LogicalPathFailure, message: string) {
    super(message)
    this.name = 'LogicalPathError'
    this.code = code
  }
}

const WINDOWS_PREFIX = /^[A-Za-z]:[\\/]/
const NUL = '\0'

/**
 * Normalize a model-supplied path into a workspace-relative POSIX logical path.
 * Rejects absolute, drive, UNC, parent-escape, empty, and NUL-bearing values.
 * @param input - path the model supplied.
 * @returns POSIX segments joined by `/`, with `.` removed and `..` rejected.
 */
export function normalizeLogicalPath(input: string): string {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    throw new LogicalPathError('empty', 'path must be a non-empty workspace-relative path')
  }
  if (trimmed.includes(NUL)) {
    throw new LogicalPathError('invalid', 'path must not contain a NUL byte')
  }
  if (
    trimmed.startsWith('/')
    || trimmed.startsWith('\\')
    || WINDOWS_PREFIX.test(trimmed)
    || trimmed.startsWith('\\\\')
  ) {
    throw new LogicalPathError('absolute', 'path must be workspace-relative, not absolute')
  }
  const parts: string[] = []
  for (const segment of trimmed.replaceAll('\\', '/').split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      throw new LogicalPathError('escape', 'path must not contain parent-directory segments')
    }
    parts.push(segment)
  }
  if (parts.length === 0) {
    throw new LogicalPathError('empty', 'path must be a non-empty workspace-relative path')
  }
  return parts.join('/')
}

/**
 * Join a directory logical path with a relative image source.
 * Parent segments are allowed only while the result stays inside the workspace.
 * @param directory - workspace-relative directory of the Markdown file, or `''` at the workspace root.
 * @param relativeSrc - image destination from the Markdown.
 * @returns the workspace-relative logical path, or `undefined` when the source is not a relative workspace path.
 */
export function joinLogicalPath(directory: string, relativeSrc: string): string | undefined {
  const source = relativeSrc.trim()
  if (source.length === 0) return undefined
  if (source.includes(NUL)) return undefined
  if (
    source.startsWith('/')
    || source.startsWith('\\')
    || WINDOWS_PREFIX.test(source)
    || source.startsWith('\\\\')
    || /^(https?:|data:|blob:)/i.test(source)
  ) {
    return undefined
  }
  const combined = directory === '' ? source : `${directory}/${source}`
  const parts: string[] = []
  for (const segment of combined.replaceAll('\\', '/').split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (parts.length === 0) return undefined
      parts.pop()
      continue
    }
    /* v8 ignore next 2 -- source already rejected a NUL byte before split */
    if (segment.includes(NUL)) return undefined
    parts.push(segment)
  }
  if (parts.length === 0) return undefined
  return parts.join('/')
}

/**
 * Directory of a workspace-relative logical file path.
 * @param logicalPath - file path returned by {@link normalizeLogicalPath}.
 * @returns parent directory, or `''` when the file sits at the workspace root.
 */
export function logicalDirectory(logicalPath: string): string {
  const index = logicalPath.lastIndexOf('/')
  return index === -1 ? '' : logicalPath.slice(0, index)
}
