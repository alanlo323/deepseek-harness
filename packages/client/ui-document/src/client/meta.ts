/**
 * Client-side parse of a `present_document` presentation snapshot.
 * Duplicated from document-core so the dynamic browser bundle stays type-only
 * on that Host library.
 * @module
 */

const KIND = 'submitted-document'

/** One workspace-relative image named by a submitted Markdown file. */
export interface ClientSubmittedImage {
  readonly ref: string
  readonly mediaType: string
}

/** Parsed submit-time snapshot carried on a successful `tool/result` meta. */
export interface ClientSubmittedDocumentMeta {
  readonly title: string
  readonly logicalPath: string
  readonly content?: string
  readonly images: readonly ClientSubmittedImage[]
  readonly truncated: boolean
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function parseImages(value: unknown): ClientSubmittedImage[] | undefined {
  if (!Array.isArray(value)) return undefined
  const images: ClientSubmittedImage[] = []
  for (const item of value) {
    const record = asRecord(item)
    if (record === undefined) return undefined
    const { ref, mediaType } = record
    if (typeof ref !== 'string' || ref.length === 0 || typeof mediaType !== 'string') return undefined
    images.push({ ref, mediaType })
  }
  return images
}

/**
 * Narrow opaque `tool/result` meta to a submitted-document snapshot.
 * @param value - presentation metadata from the session event.
 * @returns the snapshot, or `undefined` when the value is not this kind.
 */
export function parseClientSubmittedDocumentMeta(value: unknown): ClientSubmittedDocumentMeta | undefined {
  const record = asRecord(value)
  if (record === undefined || record.kind !== KIND) return undefined
  const { title, logicalPath, truncated, content, images } = record
  if (typeof title !== 'string' || title.trim() === '') return undefined
  if (typeof logicalPath !== 'string' || logicalPath.length === 0) return undefined
  if (truncated !== true && truncated !== false) return undefined
  if (content !== undefined && typeof content !== 'string') return undefined
  const parsedImages = parseImages(images)
  if (parsedImages === undefined) return undefined
  return {
    title: title.trim(),
    logicalPath,
    truncated,
    images: parsedImages,
    ...content !== undefined ? { content } : {},
  }
}

/**
 * Directory of a workspace-relative logical file path.
 * @param logicalPath - POSIX workspace-relative file path.
 * @returns parent directory, or `''` when the file sits at the workspace root.
 */
export function clientLogicalDirectory(logicalPath: string): string {
  const index = logicalPath.lastIndexOf('/')
  return index === -1 ? '' : logicalPath.slice(0, index)
}

/**
 * Join a Markdown file directory with a relative image destination.
 * Parent segments are allowed only while the result stays inside the workspace.
 * @param directory - workspace-relative directory of the Markdown file.
 * @param relativeSrc - image destination from the Markdown.
 * @returns the workspace-relative logical path, or `undefined`.
 */
export function clientJoinLogicalPath(directory: string, relativeSrc: string): string | undefined {
  const source = relativeSrc.trim()
  if (source.length === 0) return undefined
  if (
    source.startsWith('/')
    || source.startsWith('\\')
    || /^[A-Za-z]:[\\/]/.test(source)
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
    parts.push(segment)
  }
  if (parts.length === 0) return undefined
  return parts.join('/')
}
