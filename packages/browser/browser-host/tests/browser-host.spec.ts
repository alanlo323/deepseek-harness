import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionId, SessionStore } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { BrowserRuntime, type BrowserProvider, type ScreencastFrameInput } from '@deepseek-ai/dsh-browser'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import BrowserHost, { applyBrowserSession } from '../src/index.ts'

function fakeProvider(): BrowserProvider {
  return {
    id: 'fake',
    open: vi.fn(async () => {}),
    run: vi.fn(async () => ({ ok: true })),
    close: vi.fn(async () => {}),
    subscribeFrames: vi.fn((_onFrame: (frame: ScreencastFrameInput) => void) => () => {}),
    subscribeDropped: vi.fn(() => () => {}),
  }
}

describe('applyBrowserSession', () => {
  it('folds browser-session meta and ignores other events', () => {
    const open = applyBrowserSession(null, {
      type: 'tool/result',
      seq: 1,
      time: 0,
      data: {
        message: { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'c1', content: [] }] },
        meta: {
          kind: 'browser-session',
          browserSessionId: 'b1',
          dshSessionId: 's1',
          status: 'open',
        },
      },
    } as never)
    expect(open).toEqual({ browserSessionId: 'b1', dshSessionId: 's1', status: 'open' })
    expect(applyBrowserSession(open, { type: 'turn/start', seq: 2, time: 1, data: {} } as never)).toBe(open)
    expect(applyBrowserSession(open, {
      type: 'tool/result',
      seq: 3,
      time: 2,
      data: {
        message: { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'c2', content: [] }] },
        meta: { kind: 'web-fetch' },
      },
    } as never)).toBe(open)
  })
})

describe('BrowserHost.screencast', () => {
  it('rejects a missing session and a closed browser', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(BrowserRuntime)
    ctx.browser.registerProvider(fakeProvider())
    await ctx.plugin(BrowserHost)
    const host = ctx.browserHost
    expect(() => host.screencast({
      sessionId: SessionId('missing'),
      browserSessionId: 'b1',
    }, new AbortController().signal)).toThrow(RemoteError)
    const session = ctx.sessions.create(SessionId('s1'))
    expect(() => host.screencast({
      sessionId: session.id,
      browserSessionId: 'b1',
    }, new AbortController().signal)).toThrow(/not open/)
  })

  it('rejects a screencast id that does not match the open session', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(BrowserRuntime)
    ctx.browser.registerProvider(fakeProvider())
    await ctx.plugin(BrowserHost)
    const session = ctx.sessions.create(SessionId('s1'))
    await ctx.browser.open(new AbortController().signal)
    expect(() => ctx.browserHost.screencast({
      sessionId: session.id,
      browserSessionId: 'other',
    }, new AbortController().signal)).toThrow(/not open/)
  })

  it('subscribes when the Browser Session is open', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(BrowserRuntime)
    ctx.browser.registerProvider(fakeProvider())
    await ctx.plugin(BrowserHost)
    const session = ctx.sessions.create(SessionId('s1'))
    const id = await ctx.browser.open(new AbortController().signal)
    const ac = new AbortController()
    const iter = ctx.browserHost.screencast({
      sessionId: session.id,
      browserSessionId: id,
    }, ac.signal)[Symbol.asyncIterator]()
    ac.abort()
    await iter.next()
  })
})
