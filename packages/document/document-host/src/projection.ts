/**
 * Host projection of successful `present_document` calls.
 * @module @deepseek-ai/dsh-document-host/projection
 */

import { z } from 'zod'
import type { ZodType } from 'zod'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-document-core/types'
import {
  parseSubmittedDocumentMeta,
  type SubmittedDocumentRecord,
} from '@deepseek-ai/dsh-document-core'

const submittedDocumentsSchema: ZodType<SubmittedDocumentRecord[]> = z.array(z.object({
  callId: z.string().min(1),
  seq: z.number().int(),
  title: z.string().min(1),
  logicalPath: z.string().min(1),
  images: z.array(z.object({
    ref: z.string().min(1),
    mediaType: z.string().min(1),
  })),
}))

/**
 * Call id of a `tool-result` content block.
 * @param block - first content block of a `tool/result` message.
 * @param requireSuccess - when true, an `isError` result is ignored.
 * @returns the call id, or undefined.
 */
export function toolResultCallId(block: unknown, requireSuccess = false): string | undefined {
  if (typeof block !== 'object' || block === null) return undefined
  const record = block as Record<string, unknown>
  if (record['type'] !== 'tool-result') return undefined
  if (requireSuccess && record['isError'] === true) return undefined
  const callId = record['toolCallId']
  return typeof callId === 'string' ? callId : undefined
}

function callIdOf(event: SessionEvent): string | undefined {
  if (event.type !== 'tool/result') return undefined
  return toolResultCallId(event.data.message.content[0], true)
}

/**
 * Fold one event into the submitted-document list. Failed calls never enter.
 * @param state - records so far.
 * @param event - committed session event.
 * @returns the next list, or the same reference when the event is irrelevant.
 */
export function applySubmittedDocuments(
  state: SubmittedDocumentRecord[],
  event: SessionEvent,
): SubmittedDocumentRecord[] {
  const callId = callIdOf(event)
  if (callId === undefined || event.type !== 'tool/result') return state
  const meta = parseSubmittedDocumentMeta(event.data.meta)
  if (meta === undefined) return state
  const record: SubmittedDocumentRecord = {
    callId,
    seq: event.seq,
    title: meta.title,
    logicalPath: meta.logicalPath,
    images: meta.images,
  }
  const index = state.findIndex(item => item.callId === callId)
  if (index === -1) return [...state, record]
  const next = [...state]
  next[index] = record
  return next
}

/** Projection unit registered by document-host. */
export const submittedDocumentsProjectionDefinition = {
  key: 'submittedDocuments',
  stateSchema: submittedDocumentsSchema,
  init: () => [],
  apply: applySubmittedDocuments,
  wire: { viewSchema: submittedDocumentsSchema, view: state => state },
  stateVersion: 1,
} satisfies ProjectionDefinition<'submittedDocuments', SubmittedDocumentRecord[]>
