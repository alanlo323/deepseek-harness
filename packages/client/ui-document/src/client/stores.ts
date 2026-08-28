/** Per-session Report view selection persisted independently of Conversation chrome. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** Whether the reader shows the submit-time snapshot or a fresh workspace read. */
export type DocumentViewSource = 'snapshot' | 'live'

/** Per-session document reader selection. */
export interface DocumentViewState {
  /** Successful `present_document` call currently shown; null until one exists. */
  selectedCallId: string | null
  /** Snapshot is the submit-time meta; live re-reads the workspace file. */
  source: DocumentViewSource
}

/** Declared write set for the Report view. */
type DocumentViewActions = {
  selectCall: (draft: DocumentViewState, callId: string) => void
  setSource: (draft: DocumentViewState, source: DocumentViewSource) => void
  fallbackSelected: (draft: DocumentViewState, callId: string) => void
}

/**
 * Declare per-session selected document and snapshot/live source.
 * @returns the store handle.
 */
export function createDocumentViewStore(): EngineStoreHandle<DocumentViewState, DocumentViewActions> {
  return defineStore({
    init: (): DocumentViewState => ({ selectedCallId: null, source: 'snapshot' }),
    persist: 'dsh.document',
    actions: {
      selectCall: (d, callId: string) => {
        d.selectedCallId = callId
        d.source = 'snapshot'
      },
      setSource: (d, source: DocumentViewSource) => { d.source = source },
      fallbackSelected: (d, callId: string) => { d.selectedCallId = callId },
    },
  })
}
