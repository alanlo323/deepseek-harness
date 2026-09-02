/**
 * Host owner for submitted Markdown documents: projection, live Remote read, and image Fetch.
 * @module @deepseek-ai/dsh-document-host
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Session } from '@deepseek-ai/dsh-session'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-document-core/types'
import {
  parseSubmittedDocumentMeta,
  readContainedUtf8,
  ContainedReadError,
  type SubmittedDocumentMeta,
} from '@deepseek-ai/dsh-document-core'
import { submittedDocumentsProjectionDefinition, toolResultCallId } from './projection.ts'
import {
  SUBMITTED_DOCUMENT_IMAGE_PATH,
  submittedDocumentImageResponse,
} from './image-route.ts'
import type {
  ReadSubmittedDocumentRequest,
  ReadSubmittedDocumentResult,
} from './types.ts'

export type * from './types.ts'
export { SUBMITTED_DOCUMENT_IMAGE_PATH } from './image-route.ts'
export { submittedDocumentsProjectionDefinition, applySubmittedDocuments } from './projection.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host submitted-document projection, live read, and image route. */
    documentHost: DocumentHost
  }
}

interface HostConnection {
  readonly fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly ('GET' | 'HEAD')[]
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void>
  }
}

function metaForCall(session: Session, callId: string): SubmittedDocumentMeta | undefined {
  const events = session.snapshotEvents()
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events.at(index)
    /* v8 ignore next -- snapshotEvents is a dense append-only array */
    if (event === undefined) continue
    if (event.type !== 'tool/result') continue
    if (toolResultCallId(event.data.message.content[0]) !== callId) continue
    return parseSubmittedDocumentMeta(event.data.meta)
  }
  return undefined
}

/** Host service backing `ctx.remote.submittedDocument`. */
export class DocumentHost extends TypertRemoteService {
  static inject = ['sessionProjections', 'sessions', 'connection']

  /**
   * @param ctx - Host context carrying sessions, projections, and Connection.
   */
  constructor(ctx: Context) {
    super(ctx, 'documentHost', { namespace: 'submittedDocument' })
    ctx.sessionProjections.register(submittedDocumentsProjectionDefinition)
    const connection = ctx.connection as HostConnection
    connection.fetch.register({
      path: SUBMITTED_DOCUMENT_IMAGE_PATH,
      methods: ['GET', 'HEAD'],
      fetch: request => submittedDocumentImageResponse({
        sessions: ctx.sessions,
        sessionProjections: ctx.sessionProjections,
      }, request),
    })
  }

  /**
   * Read the Markdown for one successful present_document call.
   * Prefers a fresh contained workspace read; falls back to the submit-time snapshot.
   * @param request - session and tool-call identity.
   * @returns live or snapshot Markdown, or a business failure.
   */
  @Remote('read')
  async read(request: ReadSubmittedDocumentRequest): Promise<ReadSubmittedDocumentResult> {
    const session = this.ctx.sessions.get(SessionId(request.sessionId))
    if (session === undefined) {
      return { ok: false, error: { code: 'session-not-found' } }
    }
    /* v8 ignore next -- projection init is [] while document-host is loaded */
    const records = this.ctx.sessionProjections.snapshot(session).values.submittedDocuments ?? []
    const record = records.find(item => item.callId === request.documentCallId)
    const meta = metaForCall(session, request.documentCallId)
    if (record === undefined && meta === undefined) {
      return { ok: false, error: { code: 'document-not-found' } }
    }
    /* v8 ignore start -- append always folds the projection and the result meta together */
    const title = record?.title ?? meta?.title
    const logicalPath = record?.logicalPath ?? meta?.logicalPath
    const images = record?.images ?? meta?.images ?? []
    if (title === undefined || logicalPath === undefined) {
      return { ok: false, error: { code: 'document-not-found' } }
    }
    /* v8 ignore stop */
    const cwd = session.header.cwd
    if (cwd === undefined) {
      if (meta?.content !== undefined) {
        return {
          ok: true,
          value: { title, logicalPath, markdown: meta.content, source: 'snapshot', images },
        }
      }
      return { ok: false, error: { code: 'missing-cwd' } }
    }
    try {
      const live = await readContainedUtf8(cwd, logicalPath)
      return {
        ok: true,
        value: { title, logicalPath, markdown: live.text, source: 'live', images },
      }
    } catch (error: unknown) {
      /* v8 ignore start -- contained reads wrap filesystem failures as ContainedReadError */
      if (!(error instanceof ContainedReadError)) throw error
      /* v8 ignore stop */
      if (meta?.content !== undefined) {
        return {
          ok: true,
          value: { title, logicalPath, markdown: meta.content, source: 'snapshot', images },
        }
      }
      return { ok: false, error: { code: 'unreadable' } }
    }
  }
}

export default DocumentHost
