/**
 * Host owner for Browser Session projection and JPEG screencast Remote.
 * Frames are JSON items on the existing Remote stream mux; they never enter the session log.
 * @module @deepseek-ai/dsh-browser-host
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-browser'
import type { ScreencastFrame } from '@deepseek-ai/dsh-browser/types'
import { browserSessionProjectionDefinition } from './projection.ts'
import type { ScreencastRequest } from './types.ts'

export type * from './types.ts'
export { browserSessionProjectionDefinition, applyBrowserSession } from './projection.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host Browser Session projection and screencast Remote. */
    browserHost: BrowserHost
  }
}

/** Host service backing `ctx.remote.browser`. */
export class BrowserHost extends TypertRemoteService {
  static inject = ['sessionProjections', 'sessions', 'browser']

  /**
   * @param ctx - Host context carrying sessions, projections, and `ctx.browser`.
   */
  constructor(ctx: Context) {
    super(ctx, 'browserHost', { namespace: 'browser' })
    ctx.sessionProjections.register(browserSessionProjectionDefinition)
  }

  /**
   * Stream JPEG screencast frames for one Browser Session.
   * Watch-only: this Remote never sends CDP Input commands.
   * @param request - DSH Session and Browser Session identities.
   * @param signal - cancellation owned by the Remote stream carrier.
   * @returns JSON screencast items.
   */
  @Remote({ mode: 'stream' })
  screencast(request: ScreencastRequest, signal: AbortSignal): AsyncIterable<ScreencastFrame> {
    const session = this.ctx.sessions.get(SessionId(request.sessionId))
    if (session === undefined) {
      throw new RemoteError('session/not-found', `session "${request.sessionId}" not found`, {
        sessionId: request.sessionId,
      })
    }
    const current = this.ctx.browser.currentSessionId()
    if (current === undefined || current !== request.browserSessionId) {
      throw new RemoteError('browser/not-open', `browser session "${request.browserSessionId}" is not open`, {
        browserSessionId: request.browserSessionId,
      })
    }
    return this.ctx.browser.subscribeScreencast(request.browserSessionId, request.sessionId, signal)
  }
}

export default BrowserHost
