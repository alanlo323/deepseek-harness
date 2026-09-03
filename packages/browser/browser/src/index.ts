/**
 * Service Definition for the Browser Session capability seam (`ctx.browser`).
 * v1 owns at most one live session: a second `open` fails until `close`.
 * Screencast frames stay in-memory; they never enter the session log.
 * @module @deepseek-ai/dsh-browser
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import {
  BrowserError,
  BrowserSessionId as brandBrowserSessionId,
  type BrowserProvider,
  type BrowserSessionId,
  type ScreencastFrame,
} from './types.ts'

export {
  BrowserError,
  BrowserSessionId,
  parseBrowserSessionMeta,
} from './types.ts'
export type {
  BrowserProvider,
  BrowserSessionId as BrowserSessionIdType,
  BrowserSessionMeta,
  BrowserSessionStatus,
  ScreencastFrame,
  ScreencastFrameInput,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    browser: BrowserRuntime
  }
}

type LiveSession = {
  readonly id: BrowserSessionId
  readonly provider: BrowserProvider
}

/**
 * The Browser Session service. Registered as `ctx.browser` (one instance per context).
 */
export class BrowserRuntime extends Service {
  static readonly inject = []

  private readonly providers = new Map<string, BrowserProvider>()
  private session: LiveSession | undefined
  private closing: Promise<BrowserSessionId> | undefined
  private droppedDispose: (() => void) | undefined

  /**
   * @param ctx - owning context.
   */
  constructor(ctx: Context) {
    super(ctx, 'browser')
  }

  /**
   * Register a Browser Session provider. Duplicate ids throw.
   * @param provider - backend that owns Chromium lifecycle.
   * @returns disposer that unregisters the provider.
   */
  registerProvider(provider: BrowserProvider): () => void {
    if (this.providers.has(provider.id)) {
      throw new BrowserError(`browser provider already registered: ${provider.id}`, 'BROWSER_PROVIDER_DUPLICATE')
    }
    this.providers.set(provider.id, provider)
    return this.ctx.effect(() => () => {
      this.providers.delete(provider.id)
    })
  }

  /**
   * Open the single v1 Browser Session.
   * @param signal - cooperative cancellation for launch.
   * @returns the new Browser Session id.
   */
  async open(signal: AbortSignal): Promise<BrowserSessionId> {
    if (this.closing !== undefined) await this.closing
    if (this.session !== undefined) {
      throw new BrowserError('a Browser Session is already open', 'BROWSER_SESSION_OPEN')
    }
    const provider = this.resolveProvider()
    await provider.open(signal)
    if (signal.aborted) {
      await provider.close().catch(() => {
        // Launch was cancelled; occupancy must not publish.
      })
      throw new BrowserError('browser_run was cancelled', 'BROWSER_RUN_ABORTED')
    }
    const id = brandBrowserSessionId(randomUUID())
    this.session = { id, provider }
    let mine = true
    let dispose: () => void = () => {}
    dispose = provider.subscribeDropped(() => {
      if (!mine) return
      if (this.closing !== undefined) return
      if (this.session?.id === id) this.session = undefined
      mine = false
      dispose()
    })
    this.droppedDispose = dispose
    if (this.session?.id !== id) {
      mine = false
      dispose()
      this.droppedDispose = undefined
      throw new BrowserError('browser engine child exited', 'BROWSER_ENGINE_EXIT')
    }
    return id
  }

  /**
   * Run a script against the open session's shared page.
   * @param script - Playwright script body.
   * @param signal - cooperative cancellation for this run.
   * @returns JSON-serializable script result.
   */
  async run(script: string, signal: AbortSignal): Promise<JsonValue> {
    const session = this.requireOpen()
    return session.provider.run(script, signal)
  }

  /**
   * Close the open Browser Session. Occupancy stays until provider teardown
   * finishes; a failed teardown still clears occupancy so `open` may retry.
   * @returns the closed Browser Session id.
   */
  async close(): Promise<BrowserSessionId> {
    if (this.closing !== undefined) return this.closing
    const session = this.requireOpen()
    const pending = (async (): Promise<BrowserSessionId> => {
      try {
        await session.provider.close()
        return session.id
      } finally {
        this.droppedDispose?.()
        this.droppedDispose = undefined
        this.session = undefined
      }
    })()
    this.closing = pending
    try {
      return await pending
    } finally {
      this.closing = undefined
    }
  }

  /**
   * Identity of the open Browser Session, or `undefined` when closed.
   * @returns the live id, or `undefined`.
   */
  currentSessionId(): BrowserSessionId | undefined {
    return this.session?.id
  }

  /**
   * Subscribe to screencast JPEG frames for one Browser Session. The queue
   * holds at most one pending frame; a slow consumer drops older frames.
   * @param browserSessionId - must match the open session.
   * @param dshSessionId - stamped onto every yielded frame.
   * @param signal - ends the iterator when aborted.
   * @returns async iterable of JSON screencast items.
   */
  subscribeScreencast(
    browserSessionId: string,
    dshSessionId: string,
    signal: AbortSignal,
  ): AsyncIterable<ScreencastFrame> {
    const session = this.requireOpen()
    if (session.id !== browserSessionId) {
      throw new BrowserError('screencast id does not match the open Browser Session', 'BROWSER_SESSION_MISMATCH')
    }
    let pending: ScreencastFrame | undefined
    let wake: (() => void) | undefined
    const dispose = session.provider.subscribeFrames((input) => {
      pending = {
        browserSessionId,
        dshSessionId,
        mime: input.mime,
        dataBase64: input.dataBase64,
        timestamp: input.timestamp,
      }
      wake?.()
    })
    const onAbort = (): void => { wake?.() }
    signal.addEventListener('abort', onAbort, { once: true })
    return {
      async *[Symbol.asyncIterator]() {
        try {
          while (!signal.aborted) {
            if (pending === undefined) {
              await new Promise<void>((resolve) => { wake = resolve })
              wake = undefined
              continue
            }
            const frame = pending
            pending = undefined
            yield frame
          }
        } finally {
          signal.removeEventListener('abort', onAbort)
          dispose()
        }
      },
    }
  }

  private requireOpen(): LiveSession {
    if (this.session === undefined) {
      throw new BrowserError('no Browser Session is open', 'BROWSER_SESSION_CLOSED')
    }
    return this.session
  }

  private resolveProvider(): BrowserProvider {
    if (this.providers.size === 0) {
      throw new BrowserError('no browser provider is registered', 'BROWSER_PROVIDER_UNAVAILABLE')
    }
    if (this.providers.size > 1) {
      throw new BrowserError('multiple browser providers are registered', 'BROWSER_PROVIDER_AMBIGUOUS')
    }
    for (const provider of this.providers.values()) return provider
    /* v8 ignore next -- size===1 already proved the map is non-empty */
    throw new BrowserError('no browser provider is registered', 'BROWSER_PROVIDER_UNAVAILABLE')
  }
}

export default BrowserRuntime
