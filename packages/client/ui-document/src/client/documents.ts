/**
 * Per-session submitted-document index folded from SessionBinding.eventSource.
 * @module
 */

import type {
  SessionBinding, SessionEventLikeEntry,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import {
  parseClientSubmittedDocumentMeta,
  type ClientSubmittedDocumentMeta,
} from './meta.ts'

/** One successful present remembered from the event window. */
export interface ClientSubmittedDocument extends ClientSubmittedDocumentMeta {
  readonly callId: string
  readonly seq: number
}

function toolResultCallId(block: unknown, requireSuccess = false): string | undefined {
  if (typeof block !== 'object' || block === null) return undefined
  const record = block as Record<string, unknown>
  if (record['type'] !== 'tool-result') return undefined
  if (requireSuccess && record['isError'] === true) return undefined
  const callId = record['toolCallId']
  return typeof callId === 'string' ? callId : undefined
}

function documentFromEntry(entry: SessionEventLikeEntry): ClientSubmittedDocument | undefined {
  if (entry.type !== 'event') return undefined
  const event = entry.event
  if (event.type !== 'tool/result') return undefined
  const callId = toolResultCallId(event.data.message.content[0], true)
  if (callId === undefined) return undefined
  const meta = parseClientSubmittedDocumentMeta(event.data.meta)
  if (meta === undefined) return undefined
  return { callId, seq: event.seq, ...meta }
}

/**
 * Scan a window for successful present_document results in log order.
 * @param entries - current event-window entries.
 * @returns submitted documents, last write per callId wins.
 */
export function scanSubmittedDocuments(
  entries: readonly SessionEventLikeEntry[],
): readonly ClientSubmittedDocument[] {
  const byCall = new Map<string, ClientSubmittedDocument>()
  const order: string[] = []
  for (const entry of entries) {
    const document = documentFromEntry(entry)
    if (document === undefined) continue
    if (!byCall.has(document.callId)) order.push(document.callId)
    byCall.set(document.callId, document)
  }
  const result: ClientSubmittedDocument[] = []
  for (const callId of order) {
    const item = byCall.get(callId)
    /* v8 ignore next -- order only contains keys inserted in this scan */
    if (item === undefined) continue
    result.push(item)
  }
  return result
}

function sameDocuments(
  left: readonly ClientSubmittedDocument[],
  right: readonly ClientSubmittedDocument[],
): boolean {
  return left.length === right.length
    && left.every((item, index) => {
      const candidate = right.at(index)
      return candidate !== undefined
        && item.callId === candidate.callId
        && item.seq === candidate.seq
    })
}

/** Dual sources for the Report tab availability and the reader list. */
export interface DocumentIndex {
  readonly documents: ObservableSnapshot<readonly ClientSubmittedDocument[]>
  readonly available: ObservableSnapshot<boolean>
}

const indexes = new WeakMap<SessionBinding, DocumentIndex>()

/**
 * Per-binding document index that subscribes to eventSource only while live.
 * @param binding - current Session binding.
 * @returns stable sources for this binding.
 */
export function documentsIndex(binding: SessionBinding): DocumentIndex {
  const existing = indexes.get(binding)
  if (existing !== undefined) return existing

  const docListeners = new Set<() => void>()
  const availListeners = new Set<() => void>()
  let docs = scanSubmittedDocuments(binding.eventSource.getSnapshot().entries)
  let available = docs.length > 0
  let eventUnsub: (() => void) | undefined

  const refresh = (): void => {
    const next = scanSubmittedDocuments(binding.eventSource.getSnapshot().entries)
    const nextAvail = next.length > 0
    const docsChanged = !sameDocuments(docs, next)
    docs = next
    if (docsChanged) {
      for (const listener of docListeners) listener()
    }
    if (nextAvail !== available) {
      available = nextAvail
      for (const listener of availListeners) listener()
    }
  }

  const ensure = (): void => {
    if (eventUnsub !== undefined) return
    eventUnsub = binding.eventSource.subscribe(refresh)
    refresh()
  }

  const release = (): void => {
    if (docListeners.size > 0 || availListeners.size > 0) return
    eventUnsub?.()
    eventUnsub = undefined
  }

  const index: DocumentIndex = {
    documents: {
      getSnapshot: () => {
        if (eventUnsub === undefined) {
          docs = scanSubmittedDocuments(binding.eventSource.getSnapshot().entries)
        }
        return docs
      },
      subscribe: (listener) => {
        ensure()
        docListeners.add(listener)
        return () => {
          docListeners.delete(listener)
          release()
        }
      },
    },
    available: {
      getSnapshot: () => {
        if (eventUnsub === undefined) {
          available = scanSubmittedDocuments(binding.eventSource.getSnapshot().entries).length > 0
        }
        return available
      },
      subscribe: (listener) => {
        ensure()
        availListeners.add(listener)
        return () => {
          availListeners.delete(listener)
          release()
        }
      },
    },
  }
  indexes.set(binding, index)
  return index
}

/**
 * Per-session Report tab visibility: true after at least one successful present.
 * @param binding - current Session binding.
 * @returns a boolean snapshot that subscribes to the session event window.
 */
export function availableDocuments(binding: SessionBinding): ObservableSnapshot<boolean> {
  return documentsIndex(binding).available
}

/**
 * Subscribe for live appends of successful presents; replace/prepend never fire.
 * @param binding - current Session binding.
 * @param onPresent - called once per qualifying append window, with the first new callId.
 * @returns unsubscribe.
 */
export function watchAppendedPresents(
  binding: SessionBinding,
  onPresent: (callId: string) => void,
): () => void {
  return binding.eventSource.subscribe(() => {
    const window = binding.eventSource.getSnapshot()
    if (window.change.kind !== 'append') return
    for (const entry of window.change.entries) {
      const document = documentFromEntry(entry)
      if (document !== undefined) {
        onPresent(document.callId)
        return
      }
    }
  })
}

/**
 * Pick the latest successful present by seq.
 * @param documents - submitted documents in log order.
 * @returns the highest-seq document, or `undefined` when the list is empty.
 */
export function latestDocument(
  documents: readonly ClientSubmittedDocument[],
): ClientSubmittedDocument | undefined {
  let latest: ClientSubmittedDocument | undefined
  for (const document of documents) {
    if (latest === undefined || document.seq > latest.seq) latest = document
  }
  return latest
}
