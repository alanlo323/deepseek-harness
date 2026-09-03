/**
 * Host-side child RPC adapter implementing {@link BrowserProvider}.
 * Isolation of the child is not a security boundary.
 * @module @deepseek-ai/dsh-browser-playwright/provider
 */

import { fork, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { BrowserError, type BrowserProvider, type ScreencastFrameInput } from '@deepseek-ai/dsh-browser'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { ResolvedPlaywrightConfig } from './config.ts'
import { encodeProtocolLine, parseProtocolLine, type ChildToHost, type HostToChild } from './protocol.ts'
import { resolveEngineWorker } from './spawn.ts'

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
  #child: EngineChild | undefined
  #buffer = ''
  #seq = 0
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
   * @param signal - cooperative cancellation for launch.
   */
  async open(signal: AbortSignal): Promise<void> {
    if (this.#child !== undefined) {
      throw new BrowserError('a Browser Session is already open', 'BROWSER_SESSION_OPEN')
    }
    const worker = resolveEngineWorker(fileURLToPath(import.meta.url))
    const child = this.#spawn(worker.file, worker.execArgv, {
      ...process.env,
      DSH_BROWSER_PLAYWRIGHT_CONFIG: JSON.stringify(this.#config),
    })
    this.#child = child
    child.stdout.on('data', (chunk: string | Buffer) => {
      this.#onChunk(typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
    })
    child.on('exit', () => {
      this.#failAll(new BrowserError('browser engine child exited', 'BROWSER_ENGINE_EXIT'))
      this.#child = undefined
    })
    const onAbort = (): void => { this.#send({ type: 'abort', id: 'open' }) }
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      await this.#request({ type: 'open', id: this.#nextId() })
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

  /** Close Chromium and kill the child. */
  async close(): Promise<void> {
    if (this.#child === undefined) return
    try {
      await this.#request({ type: 'close', id: this.#nextId() })
    } catch {
      // Child may already be gone; kill still runs.
    }
    this.#failAll(new BrowserError('browser engine child exited', 'BROWSER_ENGINE_EXIT'))
    this.#child.kill()
    this.#child = undefined
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

  #nextId(): string {
    this.#seq += 1
    return `rpc-${String(this.#seq)}`
  }

  #send(message: HostToChild): void {
    const child = this.#child
    if (child === undefined) {
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

  #onChunk(chunk: string): void {
    this.#buffer += chunk
    while (true) {
      const nl = this.#buffer.indexOf('\n')
      if (nl === -1) break
      const line = this.#buffer.slice(0, nl)
      this.#buffer = this.#buffer.slice(nl + 1)
      const parsed = parseProtocolLine(line.trim())
      if (parsed === undefined) continue
      this.#onMessage(parsed as ChildToHost)
    }
  }

  #onMessage(message: ChildToHost): void {
    if (message.type === 'frame') {
      const frame: ScreencastFrameInput = {
        mime: message.mime,
        dataBase64: message.dataBase64,
        timestamp: message.timestamp,
      }
      for (const listener of this.#listeners) listener(frame)
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
}

/* v8 ignore start -- production fork; tests inject SpawnEngine */
function defaultSpawn(workerFile: string, execArgv: string[], env: NodeJS.ProcessEnv): EngineChild {
  return fork(workerFile, [], {
    execArgv,
    env,
    stdio: ['pipe', 'pipe', 'inherit'],
  }) as ChildProcess as EngineChild
}
/* v8 ignore stop */
