/**
 * ui-document browser half: slot registrations against the real SlotRegistry
 * (fiber teardown proves removal — HMR safety), the inert node entry, and the
 * invariant companion's ownership reservation.
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import * as DocumentInvariant from '../src/invariant.ts'
import { en, NS, zh, zhHant } from '../src/client/locales.ts'

function entryIds(ctx: Context, name: 'conversation.view' | 'conversation.session.live'): string[] {
  return ctx.slots.entries(name).map(entry => entry.options.id ?? '')
}

function toolKeys(ctx: Context): string[] {
  return ctx.slots.entries('tool.call.toolview').map(entry =>
    'key' in entry.options ? entry.options.key ?? '' : '',
  )
}

async function bench(over: {
  binding?: unknown
  remoteRead?: () => Promise<unknown>
} = {}): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']> }> {
  const ctx = new Context()
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  ctx.provide('remote.submittedDocument', {
    read: over.remoteRead ?? (() => Promise.resolve({
      ok: true,
      value: {
        ok: true,
        value: {
          title: 'T',
          logicalPath: 'a.md',
          markdown: '# x',
          source: 'live',
          images: [],
        },
      },
    })),
  })
  ctx.provide('sessions', {
    binding: () => over.binding === undefined && !('binding' in over)
      ? {
        eventSource: {
          getSnapshot: () => ({
            entries: [],
            hasMore: false,
            revision: 0,
            change: { kind: 'replace', entries: [] },
          }),
          subscribe: () => () => {},
        },
      }
      : over.binding,
  })
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.view': { kind: 'list', scope: 'session' },
      'conversation.session.live': { kind: 'list', scope: 'session' },
      'tool.call.toolview': { kind: 'keyed', scope: 'session' },
    },
  } as never, () => null)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber }
}

describe('ui-document browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'sessions', 'locale', 'remote', 'remote.submittedDocument'])
  })

  it('registers the Report tab, observer, and tool card, then fiber teardown removes them', async () => {
    const { ctx, fiber } = await bench()
    expect(entryIds(ctx, 'conversation.view')).toContain('document')
    expect(entryIds(ctx, 'conversation.session.live')).toContain('document-observer')
    expect(toolKeys(ctx)).toContain('present_document')
    await fiber.dispose()
    expect(entryIds(ctx, 'conversation.view')).not.toContain('document')
    expect(entryIds(ctx, 'conversation.session.live')).not.toContain('document-observer')
    expect(toolKeys(ctx)).not.toContain('present_document')
  })

  it('injects the live reader, observer, and availability source', async () => {
    const { ctx, fiber } = await bench()
    const view = ctx.slots.entries('conversation.view').find(entry => entry.options.id === 'document')
    const observer = ctx.slots.entries('conversation.session.live').find(entry => entry.options.id === 'document-observer')
    expect(view?.available).toBeTypeOf('function')
    expect(view?.inject).toBeTypeOf('function')
    const binding = ctx.sessions.binding(SessionId('s1'))
    expect(view!.available!(binding as never).getSnapshot()).toBe(false)
    const label = view!.options.label
    expect(typeof label === 'function' ? label() : label).toBeTruthy()
    const injected = view!.inject!(SessionId('s1') as never, {} as never) as {
      readLive: (id: string) => Promise<{ ok: boolean }>
    }
    expect(await injected.readLive('c1')).toEqual({
      ok: true,
      value: {
        title: 'T',
        logicalPath: 'a.md',
        markdown: '# x',
        source: 'live',
        images: [],
      },
    })
    const watched = observer!.inject!(SessionId('s1') as never) as {
      watchAppendedPresents: (onPresent: (callId: string) => void) => () => void
    }
    expect(watched.watchAppendedPresents(() => {})).toBeTypeOf('function')
    await fiber.dispose()
  })

  it('fails closed when the session binding is missing and unwraps a remote envelope failure', async () => {
    const missing = await bench({ binding: undefined })
    const view = missing.ctx.slots.entries('conversation.view').find(entry => entry.options.id === 'document')
    expect(() => view!.inject!(SessionId('gone') as never, {} as never)).toThrow(/unavailable/)
    const observer = missing.ctx.slots.entries('conversation.session.live').find(entry => entry.options.id === 'document-observer')
    const watched = observer!.inject!(SessionId('gone') as never) as {
      watchAppendedPresents: (onPresent: (callId: string) => void) => () => void
    }
    const stopWatch = watched.watchAppendedPresents(() => {})
    stopWatch()
    await missing.fiber.dispose()

    const remoteFail = await bench({
      remoteRead: () => Promise.resolve({ ok: false, error: { message: 'down' } }),
    })
    const failView = remoteFail.ctx.slots.entries('conversation.view').find(entry => entry.options.id === 'document')
    const injected = failView!.inject!(SessionId('s1') as never, {} as never) as {
      readLive: (id: string) => Promise<{ ok: boolean; error?: { code: string } }>
    }
    expect(await injected.readLive('c1')).toEqual({ ok: false, error: { code: 'unreadable' } })
    await remoteFail.fiber.dispose()
  })

  it('registers dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    ctx.locale.setLocale('zh')
    expect(translate('view.document')).toBe(zh['view.document'])
    ctx.locale.setLocale('en')
    expect(translate('view.document')).toBe(en['view.document'])
    await fiber.dispose()
    expect(translate('view.document')).not.toBe(en['view.document'])
  })

  it('keeps English and Traditional Chinese keys identical to the Chinese source', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(Object.keys(zhHant).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('ui-document node half', () => {
  it('contributes no host behavior', () => {
    expect(applyNode).not.toThrow()
  })
})

describe('ui-document invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(DocumentInvariant)
    await fiber.await()
    expect(DocumentInvariant.name).toBe('client-ui-document-invariant')
    expect(DocumentInvariant.inject).toEqual(['invariants'])
    expect(() => {
      ctx.invariants.register('@deepseek-ai/dsh-client-ui-document', () => {})
    }).toThrow(/already registered/)
    await fiber.dispose()
    await expect(ctx.plugin(DocumentInvariant).await()).resolves.toBeDefined()
  })
})
