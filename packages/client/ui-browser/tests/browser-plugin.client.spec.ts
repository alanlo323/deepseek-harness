/**
 * ui-browser browser half on a real SlotRegistry.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { BrowserPanel } from '../src/client/BrowserPanel.tsx'
import { BrowserOverlay } from '../src/client/BrowserOverlay.tsx'
import type { BrowserOverlayInjected, BrowserPanelInjected } from '../src/client/index.ts'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import { createBrowserView } from '../src/client/view.ts'

const SID = 's-browser' as SessionId

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'browser': { kind: 'single', scope: 'session' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
  const screencast = vi.fn((_request: unknown, _signal: AbortSignal) => (async function* () {})())
  const browserRemote = { screencast }
  ctx.provide('remote', { browser: browserRemote })
  ctx.provide('remote.browser', browserRemote)
  ctx.provide('layout', { openBrowser: vi.fn(), closeBrowser: vi.fn() })
  ctx.provide('locale', new LocaleRuntime(ctx))
  return { ctx, slots, screencast }
}

describe('ui-browser browser apply', () => {
  it('declares every service it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'layout', 'remote', 'remote.browser'])
  })

  it('node-half apply is an intentional no-op', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })

  it('registers the column and overlay, and wires layout plus screencast', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const column = b.slots.entries('browser')[0]!
    expect(column.component).toBe(BrowserPanel)
    const injected = (column.inject as unknown as (id: SessionId) => BrowserPanelInjected)(SID)
    injected.openBrowser()
    expect(b.ctx.layout.openBrowser).toHaveBeenCalledTimes(1)
    injected.closeBrowser()
    expect(b.ctx.layout.closeBrowser).toHaveBeenCalledTimes(1)
    const ac = new AbortController()
    injected.subscribeScreencast('b1', ac.signal)
    expect(b.screencast).toHaveBeenCalledWith({ sessionId: SID, browserSessionId: 'b1' }, ac.signal)
    const overlay = b.slots.entries('shell.overlay').find(entry => entry.options.id === 'browser-enlarged')
    expect(overlay?.component).toBe(BrowserOverlay)
    expect(resolveSlotLabel(overlay?.options.label)).toBeTruthy()
    const overlayInjected = (overlay!.inject as unknown as () => BrowserOverlayInjected)()
    expect(overlayInjected.view).toBe(injected.view)
    await fiber.dispose()
    expect(b.slots.entries('browser')).toHaveLength(0)
  })
})

describe('createBrowserView', () => {
  it('notifies subscribers on enlarge and frame writes', () => {
    const view = createBrowserView()
    const seen: boolean[] = []
    const dispose = view.subscribe(() => { seen.push(view.enlarged) })
    view.setEnlarged(true)
    view.setEnlarged(true)
    view.setFrame({
      browserSessionId: 'b1',
      dshSessionId: SID,
      mime: 'image/jpeg',
      dataBase64: 'YQ==',
      timestamp: 1,
    })
    dispose()
    expect(seen).toEqual([true, true])
    expect(view.frame?.dataBase64).toBe('YQ==')
  })
})
