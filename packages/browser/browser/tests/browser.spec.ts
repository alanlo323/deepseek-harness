import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { BrowserError, BrowserRuntime, parseBrowserSessionMeta, type BrowserProvider } from '@deepseek-ai/dsh-browser'
import type { ScreencastFrameInput } from '@deepseek-ai/dsh-browser'

function fakeProvider(): BrowserProvider & { emit(frame: ScreencastFrameInput): void } {
  const frames: Array<(frame: ScreencastFrameInput) => void> = []
  return {
    id: 'fake',
    open: vi.fn(async () => {}),
    run: vi.fn(async () => ({ ok: true })),
    close: vi.fn(async () => {}),
    subscribeFrames: vi.fn((onFrame) => {
      frames.push(onFrame)
      return () => {
        const i = frames.indexOf(onFrame)
        if (i >= 0) frames.splice(i, 1)
      }
    }),
    emit(frame: ScreencastFrameInput) {
      for (const listener of frames) listener(frame)
    },
  }
}

describe('BrowserRuntime', () => {
  it('opens one session, runs against it, and closes', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    const provider = fakeProvider()
    ctx.browser.registerProvider(provider)
    const id = await ctx.browser.open(new AbortController().signal)
    expect(ctx.browser.currentSessionId()).toBe(id)
    await expect(ctx.browser.run('return 1', new AbortController().signal)).resolves.toEqual({ ok: true })
    await expect(ctx.browser.close()).resolves.toBe(id)
    expect(ctx.browser.currentSessionId()).toBeUndefined()
    expect(provider.close).toHaveBeenCalledTimes(1)
  })

  it('rejects a second open while a session is live', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    ctx.browser.registerProvider(fakeProvider())
    await ctx.browser.open(new AbortController().signal)
    await expect(ctx.browser.open(new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_SESSION_OPEN',
    } satisfies Partial<BrowserError>)
  })

  it('rejects run and close when no session is open', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    ctx.browser.registerProvider(fakeProvider())
    await expect(ctx.browser.run('return 1', new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_SESSION_CLOSED',
    })
    await expect(ctx.browser.close()).rejects.toMatchObject({ code: 'BROWSER_SESSION_CLOSED' })
  })

  it('keeps a ring of one pending screencast frame', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    const provider = fakeProvider()
    ctx.browser.registerProvider(provider)
    const id = await ctx.browser.open(new AbortController().signal)
    const ac = new AbortController()
    const iter = ctx.browser.subscribeScreencast(id, 'dsh-1', ac.signal)[Symbol.asyncIterator]()
    provider.emit({ mime: 'image/jpeg', dataBase64: 'YQ==', timestamp: 1 })
    provider.emit({ mime: 'image/jpeg', dataBase64: 'Yg==', timestamp: 2 })
    const first = await iter.next()
    expect(first.value).toEqual({
      browserSessionId: id,
      dshSessionId: 'dsh-1',
      mime: 'image/jpeg',
      dataBase64: 'Yg==',
      timestamp: 2,
    })
    ac.abort()
    await iter.next()
  })

  it('waits for the next screencast frame, then ends on abort', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    const provider = fakeProvider()
    ctx.browser.registerProvider(provider)
    const id = await ctx.browser.open(new AbortController().signal)
    const ac = new AbortController()
    const iter = ctx.browser.subscribeScreencast(id, 'dsh-1', ac.signal)[Symbol.asyncIterator]()
    const waiting = iter.next()
    provider.emit({ mime: 'image/jpeg', dataBase64: 'YQ==', timestamp: 3 })
    await expect(waiting).resolves.toMatchObject({ value: { dataBase64: 'YQ==', timestamp: 3 } })
    const ended = iter.next()
    ac.abort()
    await expect(ended).resolves.toMatchObject({ done: true })
  })

  it('ends a screencast iterator that is already aborted', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    ctx.browser.registerProvider(fakeProvider())
    const id = await ctx.browser.open(new AbortController().signal)
    const ac = new AbortController()
    ac.abort()
    const iter = ctx.browser.subscribeScreencast(id, 'dsh-1', ac.signal)[Symbol.asyncIterator]()
    await expect(iter.next()).resolves.toMatchObject({ done: true })
  })

  it('the default export installs ctx.browser', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    expect(ctx.browser).toBeInstanceOf(BrowserRuntime)
  })

  it('rejects duplicate provider ids', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    ctx.browser.registerProvider(fakeProvider())
    expect(() => ctx.browser.registerProvider(fakeProvider())).toThrow(BrowserError)
  })

  it('parseBrowserSessionMeta accepts only browser-session snapshots', () => {
    expect(parseBrowserSessionMeta({
      kind: 'browser-session',
      browserSessionId: 'b1',
      dshSessionId: 's1',
      status: 'open',
    })).toEqual({
      kind: 'browser-session',
      browserSessionId: 'b1',
      dshSessionId: 's1',
      status: 'open',
    })
    expect(parseBrowserSessionMeta({ kind: 'other' })).toBeUndefined()
    expect(parseBrowserSessionMeta(null)).toBeUndefined()
    expect(parseBrowserSessionMeta('open')).toBeUndefined()
    expect(parseBrowserSessionMeta({
      kind: 'browser-session', browserSessionId: '', dshSessionId: 's1', status: 'open',
    })).toBeUndefined()
    expect(parseBrowserSessionMeta({
      kind: 'browser-session', browserSessionId: 'b1', dshSessionId: '', status: 'open',
    })).toBeUndefined()
    expect(parseBrowserSessionMeta({
      kind: 'browser-session', browserSessionId: 'b1', dshSessionId: 's1', status: 'pending',
    })).toBeUndefined()
  })

  it('rejects open with no provider, two providers, and a screencast id mismatch', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    await expect(ctx.browser.open(new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_PROVIDER_UNAVAILABLE',
    })
    ctx.browser.registerProvider(fakeProvider())
    ctx.browser.registerProvider({ ...fakeProvider(), id: 'other' })
    await expect(ctx.browser.open(new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_PROVIDER_AMBIGUOUS',
    })
    const ctx2 = new Context()
    await ctx2.plugin(BrowserRuntime)
    ctx2.browser.registerProvider(fakeProvider())
    const id = await ctx2.browser.open(new AbortController().signal)
    expect(() => ctx2.browser.subscribeScreencast('other-id', 'dsh-1', new AbortController().signal))
      .toThrow(/does not match/)
    expect(id).toBeTruthy()
  })

  it('unregistering a provider leaves the seam without a backend', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    const dispose = ctx.browser.registerProvider(fakeProvider())
    dispose()
    await expect(ctx.browser.open(new AbortController().signal)).rejects.toMatchObject({
      code: 'BROWSER_PROVIDER_UNAVAILABLE',
    })
  })
})
