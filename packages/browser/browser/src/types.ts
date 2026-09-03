/**
 * Vocabulary for the Browser Session capability seam (`ctx.browser`).
 * @module @deepseek-ai/dsh-browser/types
 */

import { brandString, type Branded } from '@deepseek-ai/dsh-brand'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

/**
 * Typed browser error with a machine-routable `code` and chained `cause`.
 * Consumers must tolerate provider-specific codes. Shared codes cover duplicate
 * or missing providers, occupancy, launch, cancellation, and result caps.
 */
export class BrowserError extends HarnessError {}

/** Opaque identity of one live Browser Session; never a DSH Session id. */
export type BrowserSessionId = Branded<'BrowserSessionId'>

/**
 * Brand a string as a {@link BrowserSessionId}.
 * @param id - the raw browser-session id string.
 * @returns the same string with the browser-session brand.
 */
export function BrowserSessionId(id: string): BrowserSessionId {
  return brandString<BrowserSessionId>(id)
}

/** Lifecycle of the single v1 Browser Session. */
export type BrowserSessionStatus = 'open' | 'closed'

/**
 * Durable presentation snapshot on `tool/result` `meta` for browser tools.
 * Frames never appear here.
 */
export interface BrowserSessionMeta {
  /** Discriminator stored in `tool/result` `meta`. */
  readonly kind: 'browser-session'
  /** Live Browser Session identity. */
  readonly browserSessionId: string
  /** Owning DSH Session identity. */
  readonly dshSessionId: string
  /** Open after `browser_open`; closed after `browser_close`. */
  readonly status: BrowserSessionStatus
}

/** One JPEG screencast frame. JSON-only: never a raw byte array. */
export interface ScreencastFrame {
  /** Browser Session that produced the frame. */
  readonly browserSessionId: string
  /** DSH Session the preview is bound to. */
  readonly dshSessionId: string
  /** Image MIME type. v1 is always JPEG. */
  readonly mime: 'image/jpeg'
  /** JPEG bytes as unpadded-or-padded base64. */
  readonly dataBase64: string
  /** Host milliseconds since epoch when the frame was accepted. */
  readonly timestamp: number
}

/** Provider-emitted frame before the runtime stamps session identities. */
export interface ScreencastFrameInput {
  readonly mime: 'image/jpeg'
  readonly dataBase64: string
  readonly timestamp: number
}

/**
 * One Browser Session backend. Registered with `ctx.browser.registerProvider`.
 * Isolation of the engine process is not a security boundary.
 */
export interface BrowserProvider {
  /** Stable registry id, unique among browser providers. */
  readonly id: string
  /**
   * Launch the engine. Honor `signal`. Failure must throw; the seam then
   * stays closed so a later `open` may retry.
   * @param signal - cooperative cancellation for launch.
   */
  open(signal: AbortSignal): Promise<void>
  /**
   * Run one script against the open session's shared context and page.
   * @param script - Playwright script body (`page`, `browser`, `context`, `playwright` in scope).
   * @param signal - cooperative cancellation for this run only.
   * @returns JSON-serializable script result.
   */
  run(script: string, signal: AbortSignal): Promise<JsonValue>
  /** Tear down the engine. */
  close(): Promise<void>
  /**
   * Subscribe to screencast JPEG frames. The runtime keeps a ring of one
   * pending frame per subscriber.
   * @param onFrame - latest-frame callback.
   * @returns disposer.
   */
  subscribeFrames(onFrame: (frame: ScreencastFrameInput) => void): () => void
}

/**
 * Parse a `tool/result` `meta` value as {@link BrowserSessionMeta}.
 * @param value - persisted meta, or unknown.
 * @returns the meta when it matches, otherwise `undefined`.
 */
export function parseBrowserSessionMeta(value: unknown): BrowserSessionMeta | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (record['kind'] !== 'browser-session') return undefined
  const browserSessionId = record['browserSessionId']
  const dshSessionId = record['dshSessionId']
  const status = record['status']
  if (typeof browserSessionId !== 'string' || browserSessionId.length === 0) return undefined
  if (typeof dshSessionId !== 'string' || dshSessionId.length === 0) return undefined
  if (status !== 'open' && status !== 'closed') return undefined
  return { kind: 'browser-session', browserSessionId, dshSessionId, status }
}
