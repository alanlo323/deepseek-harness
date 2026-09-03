import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { BrowserRuntime, type BrowserProvider, type ScreencastFrameInput } from '@deepseek-ai/dsh-browser'
import * as tool from '../src/index.ts'

const testToolSignal = new AbortController().signal

function fakeProvider(): BrowserProvider {
  return {
    id: 'fake',
    open: vi.fn(async () => {}),
    run: vi.fn(async () => ({ href: 'https://example.test' })),
    close: vi.fn(async () => {}),
    subscribeFrames: vi.fn((_onFrame: (frame: ScreencastFrameInput) => void) => () => {}),
  }
}

function agentWithSession(id = 'parent-1'): Agent & { session: Session } {
  const session = Session.create(SessionId(id))
  return { id: SessionId(id), session } as unknown as Agent & { session: Session }
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(BrowserRuntime)
  ctx.browser.registerProvider(fakeProvider())
  await ctx.plugin(tool)
  return ctx
}

let callCounter = 0
function call(ctx: Context, name: string, args: unknown, over: { agent?: Agent | undefined } = {}) {
  const agent = 'agent' in over ? over.agent : agentWithSession()
  return ctx.tools.execute({
    signal: testToolSignal,
    callId: ToolCallId(`call-${++callCounter}`),
    name,
    arguments: args,
    ...agent ? { agent } : {},
  })
}

describe('dsh-tool-browser', () => {
  it('registers the three tools and prompt section', async () => {
    const ctx = await setup()
    const names = ctx.tools.schemas().map(schema => schema.name)
    expect(names).toEqual(expect.arrayContaining(['browser_open', 'browser_run', 'browser_close']))
    const assembly = await ctx.systemPrompt.assemble()
    expect(assembly.sections.some(section => section.name === 'tool:browser')).toBe(true)
  })

  it('opens, runs twice against the same session, and closes', async () => {
    const ctx = await setup()
    const opened = await call(ctx, 'browser_open', {})
    expect(opened.isError).toBe(false)
    const first = await call(ctx, 'browser_run', { script: 'return 1' })
    const second = await call(ctx, 'browser_run', { script: 'return 2' })
    expect(first.isError).toBe(false)
    expect(second.isError).toBe(false)
    const closed = await call(ctx, 'browser_close', {})
    expect(closed.isError).toBe(false)
    const after = await call(ctx, 'browser_run', { script: 'return 3' })
    expect(after.isError).toBe(true)
  })

  it('rejects a second open and a run without a session', async () => {
    const ctx = await setup()
    await call(ctx, 'browser_open', {})
    const second = await call(ctx, 'browser_open', {})
    expect(second.isError).toBe(true)
    const ctx2 = await setup()
    const run = await call(ctx2, 'browser_run', { script: 'return 1' })
    expect(run.isError).toBe(true)
  })

  it('rejects a non-agent caller', async () => {
    const ctx = await setup()
    const result = await call(ctx, 'browser_open', {}, { agent: undefined })
    expect(result.isError).toBe(true)
  })

  it('exposes generic presentCall cards and refuses concurrent calls', async () => {
    const ctx = await setup()
    expect(ctx.tools.get('browser_open')?.isConcurrencySafe?.({})).toBe(false)
    expect(ctx.tools.get('browser_open')?.presentCall?.({})).toEqual({
      card: 'generic', title: 'Open browser', kind: 'other',
    })
    expect(ctx.tools.get('browser_run')?.isConcurrencySafe?.({ script: 'return 1' })).toBe(false)
    expect(ctx.tools.get('browser_run')?.presentCall?.({ script: 'return 1' })).toEqual({
      card: 'generic', title: 'Run browser script', kind: 'execute', rawInput: 'return 1',
    })
    expect(ctx.tools.get('browser_close')?.isConcurrencySafe?.({})).toBe(false)
    expect(ctx.tools.get('browser_close')?.presentCall?.({})).toEqual({
      card: 'generic', title: 'Close browser', kind: 'other',
    })
  })
})
