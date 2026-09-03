/**
 * Child-process main loop: stdin JSON lines in, stdout JSON lines out.
 * Executable logic stays here for in-process coverage; `worker.ts` is glue.
 * @module @deepseek-ai/dsh-browser-playwright/child-main
 */

import { BrowserError } from '@deepseek-ai/dsh-browser'
import { assertNever } from '@deepseek-ai/dsh-util-values'
import type { ResolvedPlaywrightConfig } from './config.ts'
import { encodeProtocolLine, parseProtocolLine, type ChildToHost, type HostToChild } from './protocol.ts'
import { SessionEngine, type PlaywrightLike } from './session-engine.ts'

/** Writable stdout/stderr used by the child loop. */
export interface ChildStdio {
  readonly stdin: NodeJS.ReadableStream
  readonly stdout: { write(chunk: string): boolean }
}

/**
 * Drive one engine child until stdin closes.
 * @param stdio - process stdio.
 * @param playwright - Playwright module or test fake.
 * @param config - resolved provider config.
 */
export async function runChildMain(
  stdio: ChildStdio,
  playwright: PlaywrightLike,
  config: ResolvedPlaywrightConfig,
): Promise<void> {
  const engine = new SessionEngine(playwright, config, (frame) => {
    write(stdio, {
      type: 'frame',
      mime: frame.mime,
      dataBase64: frame.dataBase64,
      timestamp: frame.timestamp,
    })
  })
  let buffer = ''
  for await (const chunk of stdio.stdin) {
    buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    while (true) {
      const nl = buffer.indexOf('\n')
      if (nl === -1) break
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      const parsed = parseProtocolLine(line.trim())
      if (parsed === undefined) continue
      await handleHostMessage(engine, stdio, parsed)
    }
  }
  await engine.close()
}

/**
 * Handle one host command.
 * @param engine - session engine.
 * @param stdio - stdout writer.
 * @param parsed - decoded JSON value.
 */
export async function handleHostMessage(
  engine: SessionEngine,
  stdio: ChildStdio,
  parsed: unknown,
): Promise<void> {
  const message = parsed as HostToChild
  if (message.type === 'abort') {
    engine.abort()
    return
  }
  if (message.type !== 'open' && message.type !== 'run' && message.type !== 'close') {
    assertNever(message)
  }
  try {
    if (message.type === 'open') {
      await engine.open(new AbortController().signal)
      write(stdio, { type: 'ok', id: message.id })
      return
    }
    if (message.type === 'run') {
      const result = await engine.run(message.script, new AbortController().signal)
      write(stdio, { type: 'ok', id: message.id, result })
      return
    }
    await engine.close()
    write(stdio, { type: 'ok', id: message.id })
  } catch (error: unknown) {
    const id = 'id' in message ? message.id : 'unknown'
    if (error instanceof BrowserError) {
      write(stdio, { type: 'error', id, code: error.code, message: error.message })
      return
    }
    const text = error instanceof Error ? error.message : String(error)
    write(stdio, { type: 'error', id, code: 'BROWSER_ENGINE', message: text })
  }
}

function write(stdio: ChildStdio, message: ChildToHost): void {
  stdio.stdout.write(encodeProtocolLine(message))
}
