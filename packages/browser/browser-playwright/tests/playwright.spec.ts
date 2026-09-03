import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { BrowserError, BrowserRuntime } from '@deepseek-ai/dsh-browser'
import { apply } from '../src/index.ts'
import { bootWorker } from '../src/boot.ts'
import { handleHostMessage, runChildMain, type ChildStdio } from '../src/child-main.ts'
import { resolvePlaywrightConfig } from '../src/config.ts'
import { PlaywrightBrowserProvider, type EngineChild } from '../src/provider.ts'
import { encodeProtocolLine, parseProtocolLine } from '../src/protocol.ts'
import {
  serializeResult,
  SessionEngine,
  type BrowserLike,
  type CdpSessionLike,
  type PageLike,
  type PlaywrightLike,
} from '../src/session-engine.ts'
import { sourceWorkerExecArgv, resolveEngineWorker } from '../src/spawn.ts'

const config = resolvePlaywrightConfig({
  screencastFps: 10,
  screencastQuality: 50,
  maxWallMs: 5_000,
  maxResultBytes: 64,
})

function fakePlaywright(options: {
  failLaunch?: boolean
  sends?: string[]
  page?: PageLike
} = {}): PlaywrightLike {
  const sends = options.sends ?? []
  const cdp: CdpSessionLike = {
    send: vi.fn(async (method: string) => {
      sends.push(method)
      return undefined
    }),
    on: vi.fn(),
  }
  const page: PageLike = options.page ?? {
    context: () => ({ newCDPSession: async () => cdp }),
  }
  const browser: BrowserLike = {
    newContext: async () => ({
      newPage: async () => page,
      close: async () => {},
    }),
    close: vi.fn(async () => {}),
  }
  return {
    chromium: {
      launch: async () => {
        if (options.failLaunch) throw new Error('no chromium binary')
        return browser
      },
    },
  }
}

describe('serializeResult', () => {
  it('fails when the JSON document exceeds the byte cap', () => {
    expect(() => serializeResult({ x: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, 8)).toThrow(BrowserError)
    try {
      serializeResult({ x: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, 8)
    } catch (error) {
      expect(error).toMatchObject({ code: 'BROWSER_RESULT_TOO_LARGE' })
    }
  })

  it('fails on a circular value', () => {
    const cycle: { self?: unknown } = {}
    cycle.self = cycle
    expect(() => serializeResult(cycle, 1000)).toThrow(/JSON-serializable/)
  })

  it('wraps a non-Error JSON.stringify throw', () => {
    expect(() => serializeResult({ toJSON: () => { throw 'nope' } }, 1000)).toThrow(/nope/)
  })

  it('treats undefined as null', () => {
    expect(serializeResult(undefined, 16)).toBeNull()
  })
})

describe('SessionEngine', () => {
  it('opens, runs a JSON script against the shared page, and closes', async () => {
    const sends: string[] = []
    const engine = new SessionEngine(fakePlaywright({ sends }), config, () => {})
    await engine.open(new AbortController().signal)
    await expect(engine.run('return { ok: true }', new AbortController().signal)).resolves.toEqual({ ok: true })
    await expect(engine.run('return { again: true }', new AbortController().signal)).resolves.toEqual({ again: true })
    expect(sends.some(method => method.startsWith('Input.'))).toBe(false)
    expect(sends).toContain('Page.startScreencast')
    await engine.close()
    expect(sends).toContain('Page.stopScreencast')
  })

  it('fails loud when Chromium cannot launch', async () => {
    const engine = new SessionEngine(fakePlaywright({ failLaunch: true }), config, () => {})
    await expect(engine.open(new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_LAUNCH_FAILED',
    })
  })

  it('wraps a non-Error Chromium launch throw', async () => {
    const playwright: PlaywrightLike = {
      chromium: {
        launch: async () => {
          throw 'no binary'
        },
      },
    }
    const engine = new SessionEngine(playwright, config, () => {})
    await expect(engine.open(new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_LAUNCH_FAILED',
      message: expect.stringContaining('no binary'),
    })
  })

  it('closes a launched browser when context setup fails', async () => {
    const close = vi.fn(async () => {})
    const playwright: PlaywrightLike = {
      chromium: {
        launch: async () => ({
          newContext: async () => {
            throw new Error('no context')
          },
          close,
        }),
      },
    }
    const engine = new SessionEngine(playwright, config, () => {})
    await expect(engine.open(new AbortController().signal)).rejects.toThrow(/no context/)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('rejects a second open', async () => {
    const engine = new SessionEngine(fakePlaywright(), config, () => {})
    await engine.open(new AbortController().signal)
    await expect(engine.open(new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_SESSION_OPEN',
    })
    await engine.close()
  })

  it('forwards screencast frames without sending Input commands', async () => {
    const sends: string[] = []
    let onFrame: ((payload: { data: string; sessionId: number }) => void) | undefined
    const cdp: CdpSessionLike = {
      send: vi.fn(async (method: string) => {
        sends.push(method)
        return undefined
      }),
      on: vi.fn((event: string, listener: (payload: { data: string; sessionId: number }) => void) => {
        if (event === 'Page.screencastFrame') onFrame = listener
      }),
    }
    const page: PageLike = { context: () => ({ newCDPSession: async () => cdp }) }
    const frames: unknown[] = []
    const engine = new SessionEngine(fakePlaywright({ sends, page }), config, (frame) => { frames.push(frame) })
    await engine.open(new AbortController().signal)
    onFrame?.({ data: 'YQ==', sessionId: 1 })
    expect(frames).toHaveLength(1)
    expect(sends.some(method => method.startsWith('Input.'))).toBe(false)
    await engine.close()
  })
})

describe('PlaywrightBrowserProvider', () => {
  it('RPCs open, run, frame, and close through an injected child', async () => {
    const stdout = new Readable({ read() {} })
    stdout.setEncoding('utf8')
    const writes: string[] = []
    const child: EngineChild = {
      stdin: {
        write(chunk: string) {
          writes.push(chunk)
          const parsed = JSON.parse(chunk.trim()) as { type: string; id: string }
          if (parsed.type === 'open') {
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
            stdout.push(encodeProtocolLine({
              type: 'frame', mime: 'image/jpeg', dataBase64: 'YQ==', timestamp: 1,
            }))
          }
          if (parsed.type === 'run') {
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id, result: { href: 'ok' } }))
          }
          if (parsed.type === 'close') {
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
          }
          return true
        },
      },
      stdout,
      kill: () => true,
      on() {},
    }
    const provider = new PlaywrightBrowserProvider(config, () => child)
    const frames: unknown[] = []
    const dispose = provider.subscribeFrames((frame) => { frames.push(frame) })
    await provider.open(new AbortController().signal)
    await expect(provider.run('return 1', new AbortController().signal)).resolves.toEqual({ href: 'ok' })
    expect(frames).toEqual([{ mime: 'image/jpeg', dataBase64: 'YQ==', timestamp: 1 }])
    await provider.close()
    dispose()
    expect(writes.some(line => line.includes('"type":"open"'))).toBe(true)
  })
})

describe('bootWorker', () => {
  it('requires DSH_BROWSER_PLAYWRIGHT_CONFIG', () => {
    expect(() => bootWorker({}, { stdin: Readable.from([]), stdout: { write: () => true } }, fakePlaywright()))
      .toThrow(/DSH_BROWSER_PLAYWRIGHT_CONFIG/)
  })

  it('runs the child loop from env config', async () => {
    const stdin = Readable.from([encodeProtocolLine({ type: 'open', id: '1' })])
    const out: string[] = []
    await bootWorker(
      { DSH_BROWSER_PLAYWRIGHT_CONFIG: JSON.stringify(config) },
      { stdin, stdout: { write(chunk: string) { out.push(chunk); return true } } },
      fakePlaywright(),
    )
    expect(out.some(line => line.includes('"type":"ok"'))).toBe(true)
  })
})

describe('handleHostMessage', () => {
  it('maps BrowserError onto an error line', async () => {
    const engine = new SessionEngine(fakePlaywright(), config, () => {})
    const out: string[] = []
    const stdio: ChildStdio = { stdin: Readable.from([]), stdout: { write(chunk: string) { out.push(chunk); return true } } }
    await handleHostMessage(engine, stdio, { type: 'run', id: '1', script: 'return 1' })
    expect(out.join('')).toContain('BROWSER_SESSION_CLOSED')
  })
})

describe('resolvePlaywrightConfig', () => {
  it('rejects a non-integer fps', () => {
    expect(() => resolvePlaywrightConfig({ screencastFps: 1.5, screencastQuality: 50, maxWallMs: 1, maxResultBytes: 1 }))
      .toThrow(/screencastFps/)
  })
})

describe('sourceWorkerExecArgv', () => {
  it('is empty when Node already strips TypeScript', () => {
    expect(sourceWorkerExecArgv('strip')).toEqual([])
    expect(sourceWorkerExecArgv(false).length).toBeGreaterThan(0)
  })
})

describe('resolveEngineWorker', () => {
  it('selects the TypeScript worker and strip flags for an unbuilt module', () => {
    const spawn = resolveEngineWorker('/tmp/provider.ts')
    expect(spawn.file.replaceAll('\\', '/')).toMatch(/\/worker\.ts$/)
    expect(spawn.execArgv).toEqual(sourceWorkerExecArgv())
  })

  it('selects the bundled worker with a clean execArgv for a built module', () => {
    const spawn = resolveEngineWorker('/tmp/provider.js')
    expect(spawn.file.replaceAll('\\', '/')).toMatch(/\/worker\.js$/)
    expect(spawn.execArgv).toEqual([])
  })
})

describe('apply', () => {
  it('registers the playwright provider on ctx.browser', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    const pluginConfig = {
      screencastFps: 10,
      screencastQuality: 50,
      maxWallMs: 1000,
      maxResultBytes: 64,
    }
    apply(ctx, pluginConfig)
    expect(() => apply(ctx, pluginConfig)).toThrow(/already registered/)
  })
})

describe('serializeResult extras', () => {
  it('fails when JSON.stringify yields undefined', () => {
    expect(() => serializeResult(() => {}, 100)).toThrow(/JSON-serializable/)
  })
})

describe('SessionEngine extras', () => {
  it('passes executablePath and rejects run when closed', async () => {
    const sends: string[] = []
    const withPath = resolvePlaywrightConfig({
      screencastFps: 10,
      screencastQuality: 50,
      maxWallMs: 5_000,
      maxResultBytes: 64,
      executablePath: '/bin/chrome',
    })
    const playwright = fakePlaywright({ sends })
    const launch = vi.spyOn(playwright.chromium, 'launch')
    const engine = new SessionEngine(playwright, withPath, () => {})
    await engine.open(new AbortController().signal)
    expect(launch).toHaveBeenCalledWith({ headless: true, executablePath: '/bin/chrome' })
    await engine.close()
    await expect(engine.run('return 1', new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_SESSION_CLOSED',
    })
    await engine.close()
  })

  it('aborts an in-flight run via maxWallMs and honors stopScreencast failure', async () => {
    const cdp: CdpSessionLike = {
      send: vi.fn(async (method: string) => {
        if (method === 'Page.stopScreencast') throw new Error('gone')
        return undefined
      }),
      on: vi.fn(),
    }
    const page: PageLike = { context: () => ({ newCDPSession: async () => cdp }) }
    const tight = resolvePlaywrightConfig({
      screencastFps: 10,
      screencastQuality: 50,
      maxWallMs: 1,
      maxResultBytes: 64,
    })
    const engine = new SessionEngine(fakePlaywright({ page }), tight, () => {})
    await engine.open(new AbortController().signal)
    await expect(engine.run('await new Promise(() => {})', new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_RUN_ABORTED',
    })
    await engine.close()
  })

  it('aborts launch when the caller signal fires', async () => {
    const playwright: PlaywrightLike = {
      chromium: {
        launch: () => new Promise(() => {}),
      },
    }
    const engine = new SessionEngine(playwright, config, () => {})
    const ac = new AbortController()
    const pending = engine.open(ac.signal)
    ac.abort()
    await expect(pending).rejects.toMatchObject({ code: 'BROWSER_RUN_ABORTED' })
  })

  it('aborts an in-flight run when the caller signal fires', async () => {
    const engine = new SessionEngine(fakePlaywright(), config, () => {})
    await engine.open(new AbortController().signal)
    const ac = new AbortController()
    const pending = engine.run('await new Promise(() => {})', ac.signal)
    await Promise.resolve()
    ac.abort()
    await expect(pending).rejects.toMatchObject({ code: 'BROWSER_RUN_ABORTED' })
    await engine.close()
  })
})

describe('protocol', () => {
  it('skips empty lines and round-trips a message', () => {
    expect(parseProtocolLine('')).toBeUndefined()
    const line = encodeProtocolLine({ type: 'open', id: '1' })
    expect(parseProtocolLine(line.trim())).toEqual({ type: 'open', id: '1' })
  })
})

describe('PlaywrightBrowserProvider extras', () => {
  it('maps child errors, empty lines, and close-when-gone', async () => {
    const stdout = new Readable({ read() {} })
    let exitListener: ((code: number | null) => void) | undefined
    const child: EngineChild = {
      stdin: {
        write(chunk: string) {
          const parsed = JSON.parse(chunk.trim()) as { type: string; id: string }
          if (parsed.type === 'open') {
            stdout.push('\n')
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
          }
          if (parsed.type === 'run') {
            stdout.push(encodeProtocolLine({
              type: 'error', id: parsed.id, code: 'BROWSER_ENGINE', message: 'boom',
            }))
          }
          if (parsed.type === 'close') {
            stdout.push(encodeProtocolLine({ type: 'error', id: parsed.id, code: 'BROWSER_ENGINE', message: 'gone' }))
          }
          return true
        },
      },
      stdout,
      kill: () => true,
      on(event, listener) {
        if (event === 'exit') exitListener = listener
      },
    }
    const provider = new PlaywrightBrowserProvider(config, () => child)
    await provider.open(new AbortController().signal)
    await expect(provider.run('return 1', new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_ENGINE',
    })
    await provider.close()
    await provider.close()
    const closed = new PlaywrightBrowserProvider(config, () => child)
    await expect(closed.run('return 1', new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_SESSION_CLOSED',
    })
    expect(exitListener).toBeTypeOf('function')
  })

  it('rejects in-flight work when the child exits', async () => {
    const stdout = new Readable({ read() {} })
    let exitListener: ((code: number | null) => void) | undefined
    const child: EngineChild = {
      stdin: {
        write(chunk: string) {
          const parsed = JSON.parse(chunk.trim()) as { type: string; id: string }
          if (parsed.type === 'open') stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
          return true
        },
      },
      stdout,
      kill: () => true,
      on(event, listener) {
        if (event === 'exit') exitListener = listener
      },
    }
    const provider = new PlaywrightBrowserProvider(config, () => child)
    await provider.open(new AbortController().signal)
    const pending = provider.run('return 1', new AbortController().signal)
    exitListener?.(1)
    await expect(pending).rejects.toMatchObject({ code: 'BROWSER_ENGINE_EXIT' })
  })

  it('rejects a second open and forwards abort', async () => {
    const stdout = new Readable({ read() {} })
    const writes: string[] = []
    const child: EngineChild = {
      stdin: {
        write(chunk: string) {
          writes.push(chunk)
          const parsed = JSON.parse(chunk.trim()) as { type: string; id: string }
          if (parsed.type === 'open' || parsed.type === 'close') {
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
          }
          return true
        },
      },
      stdout,
      kill: () => true,
      on() {},
    }
    const provider = new PlaywrightBrowserProvider(config, () => child)
    await provider.open(new AbortController().signal)
    await expect(provider.open(new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_SESSION_OPEN',
    })
    const ac = new AbortController()
    const pending = provider.run('return 1', ac.signal)
    ac.abort()
    expect(writes.some(line => line.includes('"type":"abort"'))).toBe(true)
    await provider.close()
    await expect(pending).rejects.toMatchObject({ code: 'BROWSER_ENGINE_EXIT' })
  })

  it('forwards abort during open, Buffer chunks, null results, and stray replies', async () => {
    const stdout = new Readable({ read() {} })
    const writes: string[] = []
    const ac = new AbortController()
    const child: EngineChild = {
      stdin: {
        write(chunk: string) {
          writes.push(chunk)
          const parsed = JSON.parse(chunk.trim()) as { type: string; id: string }
          if (parsed.type === 'open') {
            ac.abort()
            stdout.push(Buffer.from(encodeProtocolLine({ type: 'ok', id: parsed.id })))
            stdout.push(encodeProtocolLine({ type: 'ok', id: 'stray' }))
            stdout.push(encodeProtocolLine({
              type: 'error', id: 'stray', code: 'BROWSER_ENGINE', message: 'ignored',
            }))
          }
          if (parsed.type === 'run') {
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
          }
          if (parsed.type === 'close') {
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
          }
          return true
        },
      },
      stdout,
      kill: () => true,
      on() {},
    }
    const provider = new PlaywrightBrowserProvider(config, () => child)
    await provider.open(ac.signal)
    expect(writes.some(line => line.includes('"type":"abort"'))).toBe(true)
    await expect(provider.run('return 1', new AbortController().signal)).resolves.toBeNull()
    await provider.close()
  })

  it('wraps a non-BrowserError stdin write failure', async () => {
    const stdout = new Readable({ read() {} })
    const child: EngineChild = {
      stdin: {
        write(chunk: string) {
          const parsed = JSON.parse(chunk.trim()) as { type: string; id: string }
          if (parsed.type === 'open') {
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
            return true
          }
          throw 'pipe broken'
        },
      },
      stdout,
      kill: () => true,
      on() {},
    }
    const provider = new PlaywrightBrowserProvider(config, () => child)
    await provider.open(new AbortController().signal)
    await expect(provider.run('return 1', new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_ENGINE',
      message: 'pipe broken',
    })
  })

  it('rethrows a BrowserError from stdin write', async () => {
    const stdout = new Readable({ read() {} })
    const child: EngineChild = {
      stdin: {
        write(chunk: string) {
          const parsed = JSON.parse(chunk.trim()) as { type: string; id: string }
          if (parsed.type === 'open') {
            stdout.push(encodeProtocolLine({ type: 'ok', id: parsed.id }))
            return true
          }
          throw new BrowserError('pipe closed', 'BROWSER_ENGINE')
        },
      },
      stdout,
      kill: () => true,
      on() {},
    }
    const provider = new PlaywrightBrowserProvider(config, () => child)
    await provider.open(new AbortController().signal)
    await expect(provider.run('return 1', new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_ENGINE',
      message: 'pipe closed',
    })
  })
})

describe('handleHostMessage extras', () => {
  it('opens, aborts, closes, and maps non-BrowserError', async () => {
    const engine = new SessionEngine(fakePlaywright(), config, () => {})
    const out: string[] = []
    const stdio: ChildStdio = {
      stdin: Readable.from([]),
      stdout: { write(chunk: string) { out.push(chunk); return true } },
    }
    await handleHostMessage(engine, stdio, { type: 'open', id: '1' })
    await handleHostMessage(engine, stdio, { type: 'run', id: 'run-ok', script: 'return { ok: true }' })
    await handleHostMessage(engine, stdio, { type: 'run', id: '3', script: 'throw new Error("x")' })
    await handleHostMessage(engine, stdio, { type: 'run', script: 'throw 1' } as never)
    await handleHostMessage(engine, stdio, { type: 'abort', id: '1' })
    await handleHostMessage(engine, stdio, { type: 'close', id: '2' })
    expect(out.some(line => line.includes('"ok":true'))).toBe(true)
    expect(out.some(line => line.includes('"type":"ok"'))).toBe(true)
    expect(out.some(line => line.includes('BROWSER_ENGINE') || line.includes('"type":"error"'))).toBe(true)
    expect(out.some(line => line.includes('"id":"unknown"'))).toBe(true)
    await expect(handleHostMessage(engine, stdio, { type: 'nope' } as never)).rejects.toThrow(/unreachable variant/)
  })
})

describe('runChildMain', () => {
  it('handles an open then stdin close', async () => {
    const stdin = Readable.from([
      encodeProtocolLine({ type: 'open', id: '1' }),
      encodeProtocolLine({ type: 'close', id: '2' }),
    ])
    const out: string[] = []
    await runChildMain(
      { stdin, stdout: { write(chunk: string) { out.push(chunk); return true } } },
      fakePlaywright(),
      config,
    )
    expect(out.filter(line => line.includes('"type":"ok"')).length).toBeGreaterThanOrEqual(2)
  })

  it('accepts Buffer chunks, skips empty lines, and writes screencast frames', async () => {
    const cdp: CdpSessionLike = {
      send: vi.fn(async () => undefined),
      on: vi.fn((event: string, listener: (payload: { data: string; sessionId: number }) => void) => {
        if (event === 'Page.screencastFrame') listener({ data: 'YQ==', sessionId: 1 })
      }),
    }
    const page: PageLike = { context: () => ({ newCDPSession: async () => cdp }) }
    const stdin = Readable.from([
      Buffer.from('\n'),
      Buffer.from(encodeProtocolLine({ type: 'open', id: '1' })),
      Buffer.from(encodeProtocolLine({ type: 'close', id: '2' })),
    ])
    const out: string[] = []
    await runChildMain(
      { stdin, stdout: { write(chunk: string) { out.push(chunk); return true } } },
      fakePlaywright({ page }),
      config,
    )
    expect(out.some(line => line.includes('"type":"frame"'))).toBe(true)
  })
})

describe('resolvePlaywrightConfig extras', () => {
  it('rejects out-of-range quality, wall, and bytes, and keeps a non-empty executablePath', () => {
    expect(() => resolvePlaywrightConfig({ screencastFps: 10, screencastQuality: 101, maxWallMs: 1, maxResultBytes: 1 }))
      .toThrow(/screencastQuality/)
    expect(() => resolvePlaywrightConfig({ screencastFps: 10, screencastQuality: 50, maxWallMs: 0, maxResultBytes: 1 }))
      .toThrow(/maxWallMs/)
    expect(() => resolvePlaywrightConfig({ screencastFps: 10, screencastQuality: 50, maxWallMs: 1, maxResultBytes: 0 }))
      .toThrow(/maxResultBytes/)
    expect(resolvePlaywrightConfig({
      screencastFps: 10, screencastQuality: 50, maxWallMs: 1, maxResultBytes: 1, executablePath: '',
    }).executablePath).toBeUndefined()
    expect(resolvePlaywrightConfig({
      screencastFps: 10, screencastQuality: 50, maxWallMs: 1, maxResultBytes: 1, executablePath: '/chrome',
    }).executablePath).toBe('/chrome')
  })
})
