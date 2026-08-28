/**
 * Parse and cap `present_document` presentation snapshots.
 * @module @deepseek-ai/dsh-document-core/meta
 */

import { extractWorkspaceImages } from './images.ts'
import { normalizeLogicalPath } from './path.ts'
import {
  PRESENTATION_META_MAX_BYTES,
  SUBMITTED_DOCUMENT_KIND,
} from './constants.ts'
import type {
  PresentDocumentValue,
  SubmittedDocumentImage,
  SubmittedDocumentMeta,
} from './types.ts'

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function parseImages(value: unknown): SubmittedDocumentImage[] | undefined {
  if (!Array.isArray(value)) return undefined
  const images: SubmittedDocumentImage[] = []
  for (const item of value) {
    const record = asRecord(item)
    if (record === undefined) return undefined
    const { ref, mediaType } = record
    if (typeof ref !== 'string' || typeof mediaType !== 'string') return undefined
    try {
      images.push({ ref: normalizeLogicalPath(ref), mediaType })
    } catch {
      return undefined
    }
  }
  return images
}

/**
 * Narrow a durable `tool/result` `meta` value to a submitted-document snapshot.
 * @param value - opaque presentation metadata.
 * @returns the snapshot, or `undefined` when the value is not this kind.
 */
export function parseSubmittedDocumentMeta(value: unknown): SubmittedDocumentMeta | undefined {
  const record = asRecord(value)
  if (record === undefined || record.kind !== SUBMITTED_DOCUMENT_KIND) return undefined
  const { title, logicalPath, byteLength, truncated, content, images } = record
  if (typeof title !== 'string' || title.trim() === '') return undefined
  if (typeof logicalPath !== 'string') return undefined
  let normalizedPath: string
  try {
    normalizedPath = normalizeLogicalPath(logicalPath)
  } catch {
    return undefined
  }
  if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength < 0) {
    return undefined
  }
  if (truncated !== true && truncated !== false) return undefined
  if (content !== undefined && typeof content !== 'string') return undefined
  const parsedImages = parseImages(images)
  if (parsedImages === undefined) return undefined
  return {
    kind: SUBMITTED_DOCUMENT_KIND,
    title: title.trim(),
    logicalPath: normalizedPath,
    byteLength,
    truncated,
    images: parsedImages,
    ...content !== undefined ? { content } : {},
  }
}

function serialize(meta: SubmittedDocumentMeta): string {
  return JSON.stringify(meta)
}

/**
 * Build a byte-capped presentation snapshot for one successful present.
 * Drops `content` first, then trailing images, until the serialized JSON fits.
 * @param title - display title.
 * @param logicalPath - workspace-relative Markdown path.
 * @param markdown - file contents at submit time.
 * @param byteLength - UTF-8 byte length of `markdown`.
 * @param maxBytes - serialized JSON cap.
 * @returns a snapshot whose serialized JSON is at most `maxBytes`.
 */
export function buildSubmittedDocumentMeta(
  title: string,
  logicalPath: string,
  markdown: string,
  byteLength: number,
  maxBytes = PRESENTATION_META_MAX_BYTES,
): SubmittedDocumentMeta {
  const images = extractWorkspaceImages(logicalPath, markdown)
  const full: SubmittedDocumentMeta = {
    kind: SUBMITTED_DOCUMENT_KIND,
    title,
    logicalPath,
    byteLength,
    content: markdown,
    images,
    truncated: false,
  }
  if (utf8Bytes(serialize(full)) <= maxBytes) return full

  let keptImages = images
  while (true) {
    const withoutContent: SubmittedDocumentMeta = {
      kind: SUBMITTED_DOCUMENT_KIND,
      title,
      logicalPath,
      byteLength,
      images: keptImages,
      truncated: true,
    }
    if (utf8Bytes(serialize(withoutContent)) <= maxBytes) return withoutContent
    if (keptImages.length === 0) {
      throw new Error('present_document snapshot exceeds maxBytes even without content')
    }
    keptImages = keptImages.slice(0, -1)
  }
}

/**
 * Model-facing success value derived from a snapshot.
 * @param meta - presentation snapshot.
 * @returns the confirmation fields the model sees; never the Markdown body.
 */
export function presentDocumentValue(meta: SubmittedDocumentMeta): PresentDocumentValue {
  return {
    status: 'presented',
    title: meta.title,
    logicalPath: meta.logicalPath,
    byteLength: meta.byteLength,
  }
}
