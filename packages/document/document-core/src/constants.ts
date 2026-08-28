/**
 * Shared submitted-document constants.
 * @module @deepseek-ai/dsh-document-core/constants
 */

/** Wire name of the model-facing present tool. */
export const PRESENT_DOCUMENT_TOOL_NAME = 'present_document'

/** Discriminator stored in `tool/result` `meta` for a successful present. */
export const SUBMITTED_DOCUMENT_KIND = 'submitted-document'

/** Cap on one serialized `presentationMeta` JSON document, in UTF-8 bytes. */
export const PRESENTATION_META_MAX_BYTES = 262_144

/** Cap on one Markdown source file the present tool will read, in bytes. */
export const SUBMITTED_DOCUMENT_MAX_FILE_BYTES = 8 * 1024 * 1024

/** Cap on one workspace image the host will serve, in bytes. */
export const SUBMITTED_DOCUMENT_MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** Cap on either pixel edge of a served raster image. */
export const SUBMITTED_DOCUMENT_MAX_IMAGE_EDGE = 8192
