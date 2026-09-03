/**
 * In-process Playwright/CDP session engine. The child process owns this object;
 * Host tests inject a {@link PlaywrightLike} fake so Chromium never launches.
 * Isolation is not a security boundary.
 * @module @deepseek-ai/dsh-browser-playwright/session-engine
 */

import { BrowserError } from '@deepseek-ai/dsh-browser'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { ScreencastFrameInput } from '@deepseek-ai/dsh-browser'
import type { ResolvedPlaywrightConfig } from './config.ts'

/** CDP session used only for screencast (never Input.*). */
export interface CdpSessionLike {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
  on(event: string, listener: (payload: { data: string; sessionId: number }) => void): void
}

/** Context that opens a CDP session for screencast. */
interface CdpOwner {
  newCDPSession(page: PageLike): Promise<CdpSessionLike>
}

/** One Playwright page plus its context CDP factory. */
export interface PageLike {
  context(): CdpOwner
}

/** Playwright browser context. */
export interface BrowserContextLike {
  newPage(): Promise<PageLike>
  close(): Promise<void>
}

/** Playwright browser. */
export interface BrowserLike {
  newContext(): Promise<BrowserContextLike>
  close(): Promise<void>
}

/** Playwright module face used by the engine. */
export interface PlaywrightLike {
  readonly chromium: {
    launch(options: { headless: boolean; executablePath?: string }): Promise<BrowserLike>
  }
}

type Live = {
  readonly playwright: PlaywrightLike
  readonly browser: BrowserLike
  readonly context: BrowserContextLike
  readonly page: PageLike
  readonly cdp: CdpSessionLike
}

/**
 * One Chromium session: launch, script, screencast, teardown.
 */
export class SessionEngine {
  #live: Live | undefined
  #opAbort: AbortController | undefined

  /**
   * @param playwright - Playwright module or test fake.
   * @param config - resolved provider config.
   * @param onFrame - latest-frame callback (JPEG base64).
   */
  constructor(
    private readonly playwright: PlaywrightLike,
    private readonly config: ResolvedPlaywrightConfig,
    private readonly onFrame: (frame: ScreencastFrameInput) => void,
  ) {}

  /**
   * Launch headless Chromium, one context, one page, and start screencast.
   * @param signal - cooperative cancellation for launch.
   */
  async open(signal: AbortSignal): Promise<void> {
    if (this.#live !== undefined) {
      throw new BrowserError('a Browser Session is already open', 'BROWSER_SESSION_OPEN')
    }
    const opAbort = new AbortController()
    this.#opAbort = opAbort
    const onAbort = (): void => { opAbort.abort() }
    signal.addEventListener('abort', onAbort, { once: true })
    let browser: BrowserLike | undefined
    try {
      signal.throwIfAborted()
      try {
        browser = await Promise.race([
          this.playwright.chromium.launch({
            headless: true,
            ...this.config.executablePath === undefined ? {} : { executablePath: this.config.executablePath },
          }),
          abortPromise(opAbort.signal),
        ])
      } catch (error: unknown) {
        if (error instanceof BrowserError) throw error
        const message = error instanceof Error ? error.message : String(error)
        throw new BrowserError(`failed to launch Chromium: ${message}`, 'BROWSER_LAUNCH_FAILED', { cause: error })
      }
      signal.throwIfAborted()
      const context = await browser.newContext()
      const page = await context.newPage()
      const cdp = await page.context().newCDPSession(page)
      const everyNthFrame = Math.max(1, Math.round(60 / this.config.screencastFps))
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: this.config.screencastQuality,
        everyNthFrame,
      })
      cdp.on('Page.screencastFrame', (payload) => {
        this.onFrame({
          mime: 'image/jpeg',
          dataBase64: payload.data,
          timestamp: Date.now(),
        })
        void cdp.send('Page.screencastFrameAck', { sessionId: payload.sessionId })
      })
      this.#live = { playwright: this.playwright, browser, context, page, cdp }
    } catch (error: unknown) {
      if (browser !== undefined) await browser.close()
      throw error
    } finally {
      signal.removeEventListener('abort', onAbort)
      this.#opAbort = undefined
    }
  }

  /**
   * Run one script against the shared page. Result must be JSON and within the byte cap.
   * @param script - function body with `page`, `browser`, `context`, `playwright` in scope.
   * @param signal - cooperative cancellation for this run.
   * @returns JSON-serializable result.
   */
  async run(script: string, signal: AbortSignal): Promise<JsonValue> {
    const live = this.#requireLive()
    const opAbort = new AbortController()
    this.#opAbort = opAbort
    const onAbort = (): void => { opAbort.abort() }
    signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => { opAbort.abort() }, this.config.maxWallMs)
    try {
      signal.throwIfAborted()
      /* v8 ignore next -- AsyncFunction constructor probe; the generated function is the one that runs */
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
        ...args: string[]
      ) => (...values: unknown[]) => Promise<unknown>
      const fn = new AsyncFunction('page', 'browser', 'context', 'playwright', `"use strict";\n${script}`)
      const result = await Promise.race([
        fn(live.page, live.browser, live.context, live.playwright),
        abortPromise(opAbort.signal),
      ])
      return serializeResult(result, this.config.maxResultBytes)
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      this.#opAbort = undefined
    }
  }

  /** Abort the in-flight open or run, if any. */
  abort(): void {
    this.#opAbort?.abort()
  }

  /** Stop screencast and close Chromium. */
  async close(): Promise<void> {
    const live = this.#live
    this.#live = undefined
    this.abort()
    if (live === undefined) return
    try {
      await live.cdp.send('Page.stopScreencast')
    } catch {
      // Chromium may already be gone; teardown still closes the browser.
    }
    await live.browser.close()
  }

  #requireLive(): Live {
    if (this.#live === undefined) {
      throw new BrowserError('no Browser Session is open', 'BROWSER_SESSION_CLOSED')
    }
    return this.#live
  }
}

/**
 * Serialize a script result and fail when it exceeds the byte cap.
 * @param result - script return value.
 * @param maxResultBytes - inclusive UTF-8 cap of the JSON document.
 * @returns the JSON value.
 */
export function serializeResult(result: unknown, maxResultBytes: number): JsonValue {
  const normalized = result === undefined ? null : result
  let json: string
  try {
    json = JSON.stringify(normalized)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new BrowserError(`script result is not JSON-serializable: ${message}`, 'BROWSER_RESULT_NOT_JSON', { cause: error })
  }
  if (json === undefined) {
    throw new BrowserError('script result is not JSON-serializable', 'BROWSER_RESULT_NOT_JSON')
  }
  const bytes = Buffer.byteLength(json, 'utf8')
  if (bytes > maxResultBytes) {
    throw new BrowserError(
      `script result is ${String(bytes)} bytes; maxResultBytes is ${String(maxResultBytes)}`,
      'BROWSER_RESULT_TOO_LARGE',
    )
  }
  return JSON.parse(json) as JsonValue
}

function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = (): void => {
      reject(new BrowserError('browser_run was cancelled', 'BROWSER_RUN_ABORTED'))
    }
    /* v8 ignore next 4 -- throwIfAborted covers caller abort before race */
    if (signal.aborted) {
      fail()
      return
    }
    signal.addEventListener('abort', fail, { once: true })
  })
}
