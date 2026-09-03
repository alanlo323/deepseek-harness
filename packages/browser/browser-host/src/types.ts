/**
 * Public request and value types for the Browser Session Host Remote.
 * @module @deepseek-ai/dsh-browser-host/types
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { BrowserSessionMeta, BrowserSessionStatus, ScreencastFrame } from '@deepseek-ai/dsh-browser'

export type { BrowserSessionMeta, BrowserSessionStatus, ScreencastFrame }

/** Client-visible Browser Session snapshot. Frames never appear here. */
export interface BrowserSessionView {
  readonly browserSessionId: string
  readonly dshSessionId: string
  readonly status: BrowserSessionStatus
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    browserSession: BrowserSessionView | null
  }
  interface SessionProjectionMap {
    /**
     * The Browser Session bound to this DSH Session, or `null` before the first
     * `browser_open` result. Frames are never part of this snapshot.
     */
    browserSession: BrowserSessionView | null
  }
}

/** Live JPEG screencast subscription. */
export interface ScreencastRequest {
  /** DSH Session that owns the preview. */
  readonly sessionId: SessionId
  /** Live Browser Session identity. */
  readonly browserSessionId: string
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** No Browser Session is open, or the id does not match. */
    'browser/not-open': { readonly browserSessionId: string }
  }
}
