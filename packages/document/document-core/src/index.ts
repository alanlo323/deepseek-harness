/**
 * Shared submitted-document types, logical paths, containment reads, and meta snapshots.
 * @module @deepseek-ai/dsh-document-core
 */

export {
  PRESENT_DOCUMENT_TOOL_NAME,
  PRESENTATION_META_MAX_BYTES,
  SUBMITTED_DOCUMENT_KIND,
  SUBMITTED_DOCUMENT_MAX_FILE_BYTES,
  SUBMITTED_DOCUMENT_MAX_IMAGE_BYTES,
  SUBMITTED_DOCUMENT_MAX_IMAGE_EDGE,
} from './constants.ts'
export type * from './types.ts'

export {
  LogicalPathError,
  joinLogicalPath,
  logicalDirectory,
  normalizeLogicalPath,
} from './path.ts'
export type { LogicalPathFailure } from './path.ts'

export {
  extractWorkspaceImages,
  isRemoteImageSrc,
  mediaTypeForLogicalPath,
  rasterImagePixelSize,
  sniffRasterImageMediaType,
} from './images.ts'

export {
  ContainedReadError,
  readContainedImage,
  readContainedUtf8,
  resolveContainedFile,
} from './resolve.ts'
export type { ContainedReadFailure } from './resolve.ts'

export {
  buildSubmittedDocumentMeta,
  parseSubmittedDocumentMeta,
  presentDocumentValue,
} from './meta.ts'
