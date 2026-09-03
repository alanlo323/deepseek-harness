/**
 * Host-side child RPC adapter implementing {@link BrowserProvider}.
 * Isolation of the child is not a security boundary.
 * @module @deepseek-ai/dsh-browser-playwright/provider
 */

import { fileURLToPath } from 'node:url'
import { BrowserError, type BrowserProvider, type ScreencastFrameInput } from '@deepseek-ai/dsh-browser'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { ResolvedPlaywrightConfig } from './config.ts'
import { encodeProtocolLine, parseProtocolLine, type ChildToHost, type HostToChild } from './protocol.ts'
import { forkEngineChild, resolveEngineWorker } from './spawn.ts'

/** Minimal child process face for tests. */
export interface EngineChild {
  readonly stdin: { write(chunk: string): boolean }
  readonly stdout: NodeJS.ReadableStream
  kill(): boolean
  on(event: 'exit', listener: (code: number | null) => void): void
}

/** Spawn the engine child. */
export type SpawnEngine = (workerFile: string, execArgv: string[], env: NodeJS.ProcessEnv) => EngineChild

type Pending = {
  resolve: (value: JsonValue | undefined) => void
  reject: (error: BrowserError) => void
}

/**
 * Playwright-backed Browser Session provider. Chromium lives in the child.
 */
export class PlaywrightBrowserProvider implements BrowserProvider {
  readonly id = 'playwright'
  readonly #config: ResolvedPlaywrightConfig
  readonly #spawn: SpawnEngine
  readonly #listeners = new Set<(frame: ScreencastFrameInput) => void>()
  readonly #dropped = new Set<() => void>()
  #child: EngineChild | undefined
  #buffer = ''
  #seq = 0
  #dropNotified = false
  readonly #pending = new Map<string, Pending>()

  /**
   * @param config - resolved provider config.
   * @param spawn - child spawn (injectable for tests).
   */
  constructor(config: ResolvedPlaywrightConfig, spawn: SpawnEngine = defaultSpawn) {
    this.#config = config
    this.#spawn = spawn
  }

  /**
   * Launch the engine child and open Chromium.
   * Failure kills the child so a later `open` may retry.
   * @param signal - cooperative cancellation for launch.
   */
  async open(signal: AbortSignal): Promise<void> {
    if (this.#child !== undefined) {
      throw new BrowserError('a Browser Session is already open', 'BROWSER_SESSION_OPEN')
    }
    this.#dropNotified = false
    this.#buffer = ''
    const worker = resolveEngineWorker(fileURLToPath(import.meta.url))
    const child = this.#spawn(worker.file, worker.execArgv, {
      ...process.env,
      DSH_BROWSER_PLAYWRIGHT_CONFIG: JSON.stringify(this.#config),
    })
    this.#child = child
    child.stdout.on('data', (chunk: string | Buffer) => {
      this.#onChunk(child, typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
    })
    child.on('exit', () => {
      this.#dropChild(child)
    })
    const onAbort = (): void => { this.#send({ type: 'abort', id: 'open' }) }
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      await this.#request({ type: 'open', id: this.#nextId() })
    } catch (error: unknown) {
      this.#dropChild(child)
      throw error
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  }

  /**
   * Run a script in the child.
   * @param script - Playwright script body.
   * @param signal - cooperative cancellation for this run.
   * @returns JSON-serializable script result.
   */
  async run(script: string, signal: AbortSignal): Promise<JsonValue> {
    const id = this.#nextId()
    const onAbort = (): void => { this.#send({ type: 'abort', id }) }
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      const result = await this.#request({ type: 'run', id, script })
      return result ?? null
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  }

  /**
   * Close Chromium and kill the child. A hung close RPC is bounded by
   * `closeTimeoutMs`, then `kill()` still runs.
   */
  async close(): Promise<void> {
    const child = this.#child
    if (child === undefined) return
    const rpc = this.#request({ type: 'close', id: this.#nextId() })
    await settleWithin(rpc, this.#config.closeTimeoutMs)
    this.#dropChild(child)
  }

  /**
   * Subscribe to JPEG frames from the child.
   * @param onFrame - latest-frame callback.
   * @returns disposer.
   */
  subscribeFrames(onFrame: (frame: ScreencastFrameInput) => void): () => void {
    this.#listeners.add(onFrame)
    return () => { this.#listeners.delete(onFrame) }
  }

  /**
   * Subscribe to unexpected or completed child teardown.
   * @param onDropped - occupancy is gone.
   * @returns disposer.
   */
  subscribeDropped(onDropped: () => void): () => void {
    this.#dropped.add(onDropped)
    if (this.#dropNotified) {
      try {
        onDropped()
      } catch {
        // Subscriber errors must not break engine teardown.
      }
    }
    return () => { this.#dropped.delete(onDropped) }
  }

  #nextId(): string {
    this.#seq += 1
    return `rpc-${String(this.#seq)}`
  }

  #send(message: HostToChild): void {
    const child = this.#child
    if (child === undefined) {
      if (message.type === 'abort') return
      throw new BrowserError('no Browser Session is open', 'BROWSER_SESSION_CLOSED')
    }
    child.stdin.write(encodeProtocolLine(message))
  }

  #request(message: Extract<HostToChild, { id: string }>): Promise<JsonValue | undefined> {
    return new Promise((resolve, reject) => {
      this.#pending.set(message.id, { resolve, reject })
      try {
        this.#send(message)
      } catch (error: unknown) {
        this.#pending.delete(message.id)
        reject(error instanceof BrowserError ? error : new BrowserError(String(error), 'BROWSER_ENGINE'))
      }
    })
  }

  #onChunk(child: EngineChild, chunk: string): void {
    if (this.#child !== child) return
    this.#buffer += chunk
    while (this.#child === child) {
      const nl = this.#buffer.indexOf('\n')
      if (nl === -1) break
      const line = this.#buffer.slice(0, nl)
      this.#buffer = this.#buffer.slice(nl + 1)
      const parsed = parseProtocolLine(line.trim())
      if (parsed === undefined) continue
      this.#onMessage(child, parsed as ChildToHost)
    }
    if (this.#child !== child) this.#buffer = ''
  }

  #onMessage(child: EngineChild, message: ChildToHost): void {
    if (message.type === 'frame') {
      const frame: ScreencastFrameInput = {
        mime: message.mime,
        dataBase64: message.dataBase64,
        timestamp: message.timestamp,
      }
      for (const listener of this.#listeners) listener(frame)
      return
    }
    if (message.type === 'dropped') {
      this.#dropChild(child)
      return
    }
    const pending = this.#pending.get(message.id)
    if (pending === undefined) return
    this.#pending.delete(message.id)
    if (message.type === 'ok') {
      pending.resolve(message.result)
      return
    }
    pending.reject(new BrowserError(message.message, message.code))
  }

  #failAll(error: BrowserError): void {
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
  }

  #dropChild(child: EngineChild): void {
    if (this.#child !== child) {
      this.#killQuietly(child)
      if (this.#child === undefined) this.#notifyDropped()
      return
    }
    this.#buffer = ''
    this.#failAll(new BrowserError('browser engine child exited', 'BROWSER_ENGINE_EXIT'))
    this.#child = undefined
    this.#killQuietly(child)
    this.#notifyDropped()
  }

  #killQuietly(child: EngineChild): void {
    try {
      child.kill()
    } catch {
      // `kill()` is not valid after the process has already exited.
    }
  }

  #notifyDropped(): void {
    if (this.#dropNotified) return
    this.#dropNotified = true
    for (const onDropped of [...this.#dropped]) {
      try {
        onDropped()
      } catch {
        // Subscriber errors must not break engine teardown.
      }
    }
  }
}

/**
 * Wait for `rpc` or `timeoutMs`, whichever is first. Always clears the timer.
 * @param rpc - close RPC; rejection still counts as settlement.
 * @param timeoutMs - kill deadline.
 * @returns nothing.
 */
function settleWithin(rpc: Promise<unknown>, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    void rpc.then(
      () => { clearTimeout(timer); resolve() },
      () => { clearTimeout(timer); resolve() },
    )
  })
}

/* v8 ignore start -- production fork; tests inject SpawnEngine */
function defaultSpawn(workerFile: string, execArgv: string[], env: NodeJS.ProcessEnv): EngineChild {
  return forkEngineChild(workerFile, execArgv, env) as EngineChild
}
/* v8 ignore stop */
