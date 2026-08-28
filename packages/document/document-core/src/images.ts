/**
 * Extract workspace-relative image references from submitted Markdown.
 * @module @deepseek-ai/dsh-document-core/images
 */

import { joinLogicalPath, logicalDirectory } from './path.ts'
import type { SubmittedDocumentImage } from './types.ts'

const INLINE_IMAGE = /!\[[^\]]*]\(\s*<?([^>\s)]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g

/** Image extensions the host will serve from the workspace. SVG is excluded. */
const MEDIA_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

/**
 * Whether a Markdown image destination is an absolute remote URL.
 * @param src - destination as written in the Markdown.
 * @returns true when the destination is http(s), data, or blob.
 */
export function isRemoteImageSrc(src: string): boolean {
  return /^(https?:|data:|blob:)/i.test(src.trim())
}

/**
 * MIME type for a workspace image path, or `undefined` when the extension is not served.
 * @param logicalPath - workspace-relative logical path.
 * @returns an allowlisted raster MIME type, or `undefined`.
 */
export function mediaTypeForLogicalPath(logicalPath: string): string | undefined {
  const dot = logicalPath.lastIndexOf('.')
  if (dot === -1) return undefined
  return MEDIA_TYPES[logicalPath.slice(dot + 1).toLowerCase()]
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * MIME type from raster magic bytes. SVG and unknown payloads return undefined.
 * @param bytes - file contents after a contained read.
 * @returns the sniffed MIME type, or `undefined`.
 */
export function sniffRasterImageMediaType(bytes: Buffer): string | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 6
    && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
    && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return 'image/gif'
  }
  if (
    bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return undefined
}

/**
 * Pixel size for PNG, JPEG, and GIF. WebP size stays undefined (byte cap still applies).
 * @param bytes - file contents after a contained read.
 * @returns width and height when the format encodes them.
 */
export function rasterImagePixelSize(bytes: Buffer): { readonly width: number; readonly height: number } | undefined {
  const mediaType = sniffRasterImageMediaType(bytes)
  if (mediaType === 'image/png' && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  if (mediaType === 'image/gif' && bytes.length >= 10) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }
  }
  if (mediaType === 'image/jpeg') return jpegPixelSize(bytes)
  return undefined
}

function jpegPixelSize(bytes: Buffer): { readonly width: number; readonly height: number } | undefined {
  let index = 2
  while (index + 9 < bytes.length) {
    if (bytes[index] !== 0xff) return undefined
    const marker = bytes[index + 1]
    /* v8 ignore next 2 -- index+9 < length already proves index+1 exists */
    if (marker === undefined) return undefined
    const length = bytes.readUInt16BE(index + 2)
    if (
      marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    ) {
      return { height: bytes.readUInt16BE(index + 5), width: bytes.readUInt16BE(index + 7) }
    }
    index += 2 + length
  }
  return undefined
}

/**
 * Collect unique workspace-relative images from inline Markdown image syntax.
 * Remote `http(s)` destinations are left to the renderer and are not listed.
 * @param markdownLogicalPath - workspace-relative path of the Markdown file.
 * @param markdown - file contents.
 * @returns images in first-seen order.
 */
export function extractWorkspaceImages(
  markdownLogicalPath: string,
  markdown: string,
): SubmittedDocumentImage[] {
  const directory = logicalDirectory(markdownLogicalPath)
  const seen = new Set<string>()
  const images: SubmittedDocumentImage[] = []
  INLINE_IMAGE.lastIndex = 0
  for (const match of markdown.matchAll(INLINE_IMAGE)) {
    const src = match[1]
    /* v8 ignore next -- the image regex always captures a destination */
    if (src === undefined) continue
    if (isRemoteImageSrc(src)) continue
    const ref = joinLogicalPath(directory, src)
    if (ref === undefined || seen.has(ref)) continue
    const mediaType = mediaTypeForLogicalPath(ref)
    if (mediaType === undefined) continue
    seen.add(ref)
    images.push({ ref, mediaType })
  }
  return images
}
