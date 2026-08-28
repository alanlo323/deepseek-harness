/**
 * Shared types for submitted Markdown documents: the `present_document` tool
 * snapshot, the host projection, and the live-read Remote payload.
 * @module @deepseek-ai/dsh-document-core/types
 */

import type {} from '@deepseek-ai/dsh-session-projection/types'

/** Discriminator stored in `tool/result` `meta` for a successful present. */
export type SubmittedDocumentKind = 'submitted-document'

/** One workspace-relative image referenced from a submitted Markdown file. */
export interface SubmittedDocumentImage {
  /** Workspace-relative POSIX logical path; never an absolute host path. */
  readonly ref: string
  /** MIME type derived from the file extension. */
  readonly mediaType: string
}

/**
 * Durable presentation snapshot for one successful `present_document` call.
 * Absolute host paths and display spellings are forbidden here.
 */
export interface SubmittedDocumentMeta {
  /** Discriminator stored in `tool/result` `meta`. */
  readonly kind: SubmittedDocumentKind
  /** Human title shown in the document view and tool card. */
  readonly title: string
  /** Workspace-relative POSIX path of the Markdown file. */
  readonly logicalPath: string
  /** UTF-8 byte length of the file at submit time. */
  readonly byteLength: number
  /**
   * Markdown source captured at submit time. Omitted when the serialized
   * snapshot would exceed the configured byte cap.
   */
  readonly content?: string
  /** Workspace-relative images extracted from the Markdown at submit time. */
  readonly images: readonly SubmittedDocumentImage[]
  /** True when `content` (and possibly trailing images) were dropped to honor the byte cap. */
  readonly truncated: boolean
}

/** Model-facing success value; never includes the Markdown body. */
export interface PresentDocumentValue {
  /** Fixed success tag. */
  readonly status: 'presented'
  /** Human title shown in the Report view and tool card. */
  readonly title: string
  /** Workspace-relative POSIX path of the Markdown file. */
  readonly logicalPath: string
  /** UTF-8 byte length of the file at submit time. */
  readonly byteLength: number
}

/** One submitted document remembered by the host projection (no Markdown body). */
export interface SubmittedDocumentRecord {
  /** Tool-call identity of the successful present. */
  readonly callId: string
  /** Session-log seq of the successful `tool/result`. */
  readonly seq: number
  /** Human title shown in the Report view. */
  readonly title: string
  /** Workspace-relative POSIX path of the Markdown file. */
  readonly logicalPath: string
  /** Workspace-relative images extracted at submit time. */
  readonly images: readonly SubmittedDocumentImage[]
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    submittedDocuments: SubmittedDocumentRecord[]
  }
  interface SessionProjectionMap {
    /**
     * Successful `present_document` calls in log order. Failed calls never
     * appear. The Markdown body stays on the tool result `meta`, not here.
     */
    submittedDocuments: SubmittedDocumentRecord[]
  }
}
