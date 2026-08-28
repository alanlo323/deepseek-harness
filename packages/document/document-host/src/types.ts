/**
 * Public request and value types for the submitted-document Host Remote.
 * @module @deepseek-ai/dsh-document-host/types
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubmittedDocumentImage } from '@deepseek-ai/dsh-document-core/types'

export type {
  PresentDocumentValue,
  SubmittedDocumentImage,
  SubmittedDocumentMeta,
  SubmittedDocumentRecord,
} from '@deepseek-ai/dsh-document-core/types'

/** Live Markdown read for one successful present_document call. */
export interface ReadSubmittedDocumentRequest {
  /** Session that owns the successful present. */
  readonly sessionId: SessionId
  /** Tool-call identity of that present. */
  readonly documentCallId: string
}

/** Markdown currently on disk, or the submit-time snapshot when the file is gone. */
export interface ReadSubmittedDocumentValue {
  /** Human title shown in the Report view. */
  readonly title: string
  /** Workspace-relative POSIX path of the Markdown file. */
  readonly logicalPath: string
  /** Markdown to render. */
  readonly markdown: string
  /** Live is a fresh workspace read; snapshot is the submit-time body. */
  readonly source: 'live' | 'snapshot'
  /** Workspace-relative images named by this document. */
  readonly images: readonly SubmittedDocumentImage[]
}

/** Why a live Markdown read did not yield a document. */
export type ReadSubmittedDocumentFailureCode =
  | 'session-not-found'
  | 'document-not-found'
  | 'missing-cwd'
  | 'unreadable'

/** Business failure for one live Markdown read. */
export interface ReadSubmittedDocumentFailure {
  /** Stable failure identity. */
  readonly code: ReadSubmittedDocumentFailureCode
}

/** Success or business failure of `submittedDocument.read`. */
export type ReadSubmittedDocumentResult =
  | { readonly ok: true; readonly value: ReadSubmittedDocumentValue }
  | { readonly ok: false; readonly error: ReadSubmittedDocumentFailure }
