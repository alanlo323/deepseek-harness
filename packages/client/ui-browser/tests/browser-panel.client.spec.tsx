// @vitest-environment jsdom
import { createElement, type ComponentType } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { BrowserPanel } from '../src/client/BrowserPanel.tsx'
import { BrowserOverlay } from '../src/client/BrowserOverlay.tsx'
import { createBrowserView } from '../src/client/view.ts'
import { zhHant } from '../src/client/locales.ts'
import type { BrowserSessionView } from '@deepseek-ai/dsh-browser-host/client'

afterEach(cleanup)

const t = ((key: keyof typeof zhHant) => zhHant[key]) as never
const Panel = BrowserPanel as ComponentType<Record<string, unknown>>
const Overlay = BrowserOverlay as ComponentType<Record<string, unknown>>

describe('BrowserPanel', () => {
  it('opens the layout panel on the open status edge and dismisses without closing the session', () => {
    const openBrowser = vi.fn()
    const closeBrowser = vi.fn()
    const snapshot: BrowserSessionView = {
      browserSessionId: 'b1',
      dshSessionId: 's1',
      status: 'open',
    }
    const view = createBrowserView()
    render(createElement(Panel, {
      sessionId: SessionId('s1'),
      useProjection: () => snapshot,
      openBrowser,
      closeBrowser,
      subscribeScreencast: () => (async function* () {})(),
      view,
      t,
    }))
    expect(openBrowser).toHaveBeenCalledTimes(1)
    fireEvent.click(document.querySelector('button')!)
    // First button is enlarge.
    fireEvent.click([...document.querySelectorAll('button')].at(-1)!)
    expect(closeBrowser).toHaveBeenCalledTimes(1)
    expect(view.enlarged).toBe(true)
  })

  it('renders a JPEG frame and ignores a frame bound to another session', async () => {
    const view = createBrowserView()
    const snapshot: BrowserSessionView = {
      browserSessionId: 'b1',
      dshSessionId: 's1',
      status: 'open',
    }
    async function* frames() {
      yield {
        browserSessionId: 'b1',
        dshSessionId: 'other',
        mime: 'image/jpeg' as const,
        dataBase64: 'QQ==',
        timestamp: 1,
      }
      yield {
        browserSessionId: 'b1',
        dshSessionId: 's1',
        mime: 'image/jpeg' as const,
        dataBase64: 'YQ==',
        timestamp: 2,
      }
    }
    render(createElement(Panel, {
      sessionId: SessionId('s1'),
      useProjection: () => snapshot,
      openBrowser: vi.fn(),
      closeBrowser: vi.fn(),
      subscribeScreencast: () => frames(),
      view,
      t,
    }))
    await act(async () => { await Promise.resolve() })
    expect(document.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,YQ==')
    fireEvent.click(document.querySelector('.enlargeHit') ?? document.querySelector('img')!.closest('button')!)
    expect(view.enlarged).toBe(true)
  })

  it('opens once on the closed-to-open edge and does not reopen while still open', () => {
    const openBrowser = vi.fn()
    const closed: BrowserSessionView = {
      browserSessionId: 'b1',
      dshSessionId: 's1',
      status: 'closed',
    }
    const opened: BrowserSessionView = { ...closed, status: 'open' }
    let snapshot: BrowserSessionView | null = closed
    const view = createBrowserView()
    const screen = render(createElement(Panel, {
      sessionId: SessionId('s1'),
      useProjection: () => snapshot,
      openBrowser,
      closeBrowser: vi.fn(),
      subscribeScreencast: () => (async function* () {})(),
      view,
      t,
    }))
    expect(openBrowser).not.toHaveBeenCalled()
    snapshot = opened
    screen.rerender(createElement(Panel, {
      sessionId: SessionId('s1'),
      useProjection: () => snapshot,
      openBrowser,
      closeBrowser: vi.fn(),
      subscribeScreencast: () => (async function* () {})(),
      view,
      t,
    }))
    expect(openBrowser).toHaveBeenCalledTimes(1)
    screen.rerender(createElement(Panel, {
      sessionId: SessionId('s1'),
      useProjection: () => snapshot,
      openBrowser,
      closeBrowser: vi.fn(),
      subscribeScreencast: () => (async function* () {})(),
      view,
      t,
    }))
    expect(openBrowser).toHaveBeenCalledTimes(1)
  })

  it('does not subscribe when an open snapshot has no Browser Session id', () => {
    const subscribeScreencast = vi.fn(() => (async function* () {})())
    render(createElement(Panel, {
      sessionId: SessionId('s1'),
      useProjection: () => ({ dshSessionId: 's1', status: 'open' }) as never,
      openBrowser: vi.fn(),
      closeBrowser: vi.fn(),
      subscribeScreencast,
      view: createBrowserView(),
      t,
    }))
    expect(subscribeScreencast).not.toHaveBeenCalled()
  })

  it('drops a leftover frame when the bound Session id changes', () => {
    const view = createBrowserView()
    view.setFrame({
      browserSessionId: 'b1',
      dshSessionId: 's-old',
      mime: 'image/jpeg',
      dataBase64: 'YQ==',
      timestamp: 1,
    })
    view.setEnlarged(true)
    const snapshot: BrowserSessionView = {
      browserSessionId: 'b1',
      dshSessionId: 's1',
      status: 'closed',
    }
    render(createElement(Panel, {
      sessionId: SessionId('s1'),
      useProjection: () => snapshot,
      openBrowser: vi.fn(),
      closeBrowser: vi.fn(),
      subscribeScreencast: () => (async function* () {})(),
      view,
      t,
    }))
    expect(view.frame).toBeUndefined()
    expect(view.enlarged).toBe(false)
  })
})

describe('BrowserOverlay', () => {
  it('renders nothing until enlarged, then shrinks', () => {
    const view = createBrowserView()
    const screen = render(createElement(Overlay, { view, t }))
    expect(screen.container.textContent).toBe('')
    act(() => { view.setEnlarged(true) })
    expect(screen.getByText(zhHant.shrink)).toBeTruthy()
    fireEvent.click(screen.getByText(zhHant.shrink))
    expect(view.enlarged).toBe(false)
  })

  it('renders the enlarged JPEG when a frame is present', () => {
    const view = createBrowserView()
    view.setFrame({
      browserSessionId: 'b1',
      dshSessionId: 's1',
      mime: 'image/jpeg',
      dataBase64: 'YQ==',
      timestamp: 1,
    })
    view.setEnlarged(true)
    const screen = render(createElement(Overlay, { view, t }))
    expect(screen.container.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,YQ==')
  })
})
