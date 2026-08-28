/**
 * Browser submitted-document plugin: Report conversation view, live observer, and present_document card.
 * @module @deepseek-ai/dsh-client-ui-document/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ReadSubmittedDocumentResult } from '@deepseek-ai/dsh-document-host/client'
// Type-only: pulls the generated Remote API and ctx.remote merge through the Client assembly boundary.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: conversation.view, conversation.session.live, and locale/slot merges.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-store'
import { DocumentObserver, type DocumentObserverInjected } from './DocumentObserver.tsx'
import { DocumentView, type DocumentViewInjected } from './DocumentView.tsx'
import { PresentDocumentCard } from './PresentDocumentCard.tsx'
import { availableDocuments, documentsIndex, watchAppendedPresents } from './documents.ts'
import { createDocumentViewStore } from './stores.ts'
import { en, NS, zh, zhHant, type DocumentKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Report view, present_document card, and Markdown chrome. */
    document: DocumentKey
  }
}

export type { DocumentKey } from './locales.ts'
export type { DocumentViewState, DocumentViewSource } from './stores.ts'
export type { ClientSubmittedDocument } from './documents.ts'

/** Required services: slots, sessions, locale, and the submitted-document Remote. */
export const inject = ['slots', 'sessions', 'locale', 'remote', 'remote.submittedDocument']

/**
 * Client plugin body: Report tab, live observer, and present_document tool card.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, 'zh-Hant': zhHant }), 'ui-document: dictionaries')
  const t = ctx.locale.bind(NS)
  const documentStore = createDocumentViewStore()

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'document',
    order: 20,
    locale: NS,
    label: () => t('view.document'),
    available: (binding: SessionBinding) => availableDocuments(binding),
    store: documentStore,
    inject: (
      sessionId: SessionId,
      _actions: BoundActions<typeof documentStore>,
    ): DocumentViewInjected => {
      const binding = ctx.sessions.binding(sessionId)
      if (binding === undefined) {
        throw new Error(`ui-document: session "${sessionId}" is unavailable`)
      }
      return {
        hooks: { documents: documentsIndex(binding).documents },
        readLive: async (documentCallId): Promise<ReadSubmittedDocumentResult> => {
          const envelope = await ctx.remote.submittedDocument.read({ sessionId, documentCallId })
          if (!envelope.ok) return { ok: false, error: { code: 'unreadable' } }
          return envelope.value
        },
      }
    },
  }, DocumentView))

  ctx.slots.inject('conversation.session.live', () => ctx.slots.register({
    name: 'conversation.session.live',
    id: 'document-observer',
    inject: (sessionId: SessionId): DocumentObserverInjected => {
      const binding = ctx.sessions.binding(sessionId)
      return {
        watchAppendedPresents: (onPresent) => {
          if (binding === undefined) return () => {}
          return watchAppendedPresents(binding, onPresent)
        },
      }
    },
  }, DocumentObserver))

  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'present_document',
    locale: NS,
  }, PresentDocumentCard))
}
