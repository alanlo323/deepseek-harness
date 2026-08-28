// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '../src/client/locale.ts'
import { AssistantMarkdown, type AssistantMarkdownProps } from '../src/client/chat/AssistantMarkdown.tsx'
import { PARAGRAPH_ADVANCE_MS } from '../src/client/chat/ReasoningRow.tsx'

let nextAnimationFrameId = 1
let animationFrames = new Map<number, FrameRequestCallback>()
let matchMediaMatches = false

function flushAnimationFrames(count: number): void {
  for (let index = 0; index < count; index += 1) {
    const callbacks = [...animationFrames.values()]
    animationFrames.clear()
    for (const callback of callbacks) callback(index)
  }
}

function stubMatchMedia(matches: boolean): void {
  matchMediaMatches = matches
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matchMediaMatches,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }))
}

beforeEach(() => {
  nextAnimationFrameId = 1
  animationFrames = new Map()
  stubMatchMedia(false)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextAnimationFrameId
    nextAnimationFrameId += 1
    animationFrames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    animationFrames.delete(id)
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const t = makeTranslate(zh, commonZh)
const renderMessageImages: AssistantMarkdownProps['renderMessageImages'] = () => null

function overflowMetrics(element: HTMLElement): void {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: 300 },
    clientWidth: { configurable: true, value: 100 },
  })
}

function reasoning(text: string, streaming = true) {
  return (
    <AssistantMarkdown
      t={t}
      blocks={[{ kind: 'reasoning', text }]}
      streaming={streaming}
      renderMessageImages={renderMessageImages}
    />
  )
}

describe('ReasoningRow', () => {
  it('keeps the streaming prefix at the left edge after settle', () => {
    const view = render(
      reasoning('Inspect the session and keep reading this paragraph'),
    )
    expect(view.getByText('运行中')).toBeTruthy()
    const summary = view.getByText('Inspect the session and keep reading this paragraph')
    overflowMetrics(summary)

    view.rerender(
      reasoning('Inspect the session and keep reading this paragraph as tokens arrive'),
    )
    flushAnimationFrames(3)
    expect(summary.scrollLeft).toBe(0)
    expect(summary.hasAttribute('data-follow-end')).toBe(false)

    view.rerender(
      reasoning('Inspect the session and keep reading this paragraph as tokens arrive', false),
    )
    flushAnimationFrames(3)
    expect(view.getByText('Inspect the session and keep reading this paragraph as tokens arrive')).toBeTruthy()
    expect(view.queryByText('运行中')).toBeNull()
    expect(summary.scrollLeft).toBe(0)
    expect(summary.hasAttribute('data-follow-end')).toBe(false)
  })

  it('keeps the prefix on the first paragraph when later tokens share that paragraph', () => {
    const view = render(
      reasoning('First paragraph stays readable.\nLater tokens stay in the same paragraph'),
    )
    const summary = view.getByText(/First paragraph stays readable/)
    expect(summary.textContent).toBe('First paragraph stays readable.\nLater tokens stay in the same paragraph')
    overflowMetrics(summary)
    flushAnimationFrames(3)
    expect(summary.scrollLeft).toBe(0)
    expect(summary.hasAttribute('data-follow-end')).toBe(false)
  })

  it('switches the prefix to the new paragraph after a blank line on first paint', () => {
    const view = render(
      reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'),
    )
    const summary = view.getByText('Second paragraph is in progress')
    overflowMetrics(summary)
    flushAnimationFrames(3)
    expect(summary.scrollLeft).toBe(0)
    expect(view.queryByText('First paragraph stays readable.')).toBeNull()
  })

  it('keeps the last paragraph when a multi-paragraph Think settles', () => {
    const view = render(
      reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress', false),
    )
    expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
    expect(view.queryByText('First paragraph stays readable.')).toBeNull()
  })

  it('replaces the current paragraph instantly when CRLF rewrites the same generation', () => {
    const view = render(
      reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'),
    )
    view.rerender(
      reasoning('First paragraph stays readable.\r\n\r\nCRLF paragraph is in progress'),
    )
    expect(view.getByText('CRLF paragraph is in progress')).toBeTruthy()
    expect(view.queryByText('Second paragraph is in progress')).toBeNull()
  })

  it('keeps the previous paragraph when a trailing blank line has no following text', () => {
    const view = render(
      reasoning('Keep this paragraph\n\n'),
    )
    expect(view.getByText('Keep this paragraph')).toBeTruthy()
  })

  it('follows the latest streaming line when previewMode is follow-end', () => {
    const view = render(
      <AssistantMarkdown
        t={t}
        previewMode="follow-end"
        blocks={[{ kind: 'reasoning', text: 'Inspect the session\nNewest reasoning tokens' }]}
        streaming
        renderMessageImages={renderMessageImages}
      />,
    )
    const summary = view.getByText('Newest reasoning tokens')
    overflowMetrics(summary)

    view.rerender(
      <AssistantMarkdown
        t={t}
        previewMode="follow-end"
        blocks={[{ kind: 'reasoning', text: 'Inspect the session\nNewest reasoning tokens keep arriving' }]}
        streaming
        renderMessageImages={renderMessageImages}
      />,
    )
    expect(summary.scrollLeft).toBe(0)
    flushAnimationFrames(2)
    expect(summary.scrollLeft).toBe(0)
    flushAnimationFrames(1)
    expect(summary.scrollLeft).toBe(200)
    expect(summary.getAttribute('data-follow-end')).toBe('true')

    view.rerender(
      <AssistantMarkdown
        t={t}
        previewMode="follow-end"
        blocks={[{ kind: 'reasoning', text: 'Inspect the session\nNewest reasoning tokens keep arriving\n' }]}
        streaming={false}
        renderMessageImages={renderMessageImages}
      />,
    )
    const settled = view.getByText(/Newest reasoning tokens keep arriving/)
    overflowMetrics(settled)
    flushAnimationFrames(3)
    expect(settled.scrollLeft).toBe(0)
    expect(settled.hasAttribute('data-follow-end')).toBe(false)
    expect(settled.textContent).toBe('Inspect the session\nNewest reasoning tokens keep arriving\n')
  })

  it('expands from either Think or the reasoning summary', () => {
    const view = render(
      reasoning('Inspect the session\n\nCheck persistence', false),
    )
    const row = view.getByRole('button')

    fireEvent.click(view.getByText('Check persistence'))
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(view.getByText(/Inspect the session/)).toBeTruthy()

    fireEvent.click(view.getByText('思考'))
    expect(row.getAttribute('aria-expanded')).toBe('false')
  })

  it('expanded Think drops the inline summary and renders plain prose, no IN card', () => {
    const view = render(
      reasoning('Inspect the session\n\nCheck persistence', false),
    )
    fireEvent.click(view.getByText('思考'))
    expect(view.getAllByText(/Inspect the session/)).toHaveLength(1)
    expect(view.queryByText('IN')).toBeNull()
    expect(view.container.querySelector('[class*="ioCard"]')).toBeNull()
    expect(view.container.querySelector('[class*="thinkBody"]')).not.toBeNull()
  })

  describe('prefix paragraph advance', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('rolls the one-line slot when a new blank-line paragraph arrives after commit', () => {
      const view = render(reasoning('First paragraph stays readable.'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'))
      expect(view.getByText('First paragraph stays readable.')).toBeTruthy()
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      overflowMetrics(view.getByText('First paragraph stays readable.'))
      overflowMetrics(view.getByText('Second paragraph is in progress'))
      expect(view.getByText('First paragraph stays readable.').scrollLeft).toBe(0)
      expect(view.getByText('Second paragraph is in progress').scrollLeft).toBe(0)

      act(() => {
        vi.advanceTimersByTime(PARAGRAPH_ADVANCE_MS)
      })
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      expect(view.queryByText('First paragraph stays readable.')).toBeNull()
    })

    it('does not roll when the same generation grows', () => {
      const view = render(reasoning('Hello'))
      view.rerender(reasoning('Hello more'))
      expect(view.getByText('Hello more')).toBeTruthy()
      expect(view.queryByText('Hello', { exact: true })).toBeNull()
    })

    it('rolls when adjacent paragraphs have the same text', () => {
      const view = render(reasoning('Hello'))
      view.rerender(reasoning('Hello\n\nHello'))
      expect(view.getAllByText('Hello')).toHaveLength(2)
      act(() => {
        vi.advanceTimersByTime(PARAGRAPH_ADVANCE_MS)
      })
      expect(view.getAllByText('Hello')).toHaveLength(1)
    })

    it('grows the incoming line during the roll', () => {
      const view = render(reasoning('First paragraph stays readable.'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'))
      expect(view.getByText('First paragraph stays readable.')).toBeTruthy()
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(PARAGRAPH_ADVANCE_MS)
      })
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      expect(view.queryByText('First paragraph stays readable.')).toBeNull()
    })

    it('finishes the in-flight roll then jumps to the latest paragraph', () => {
      const view = render(reasoning('First paragraph stays readable.'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'))
      view.rerender(
        reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress\n\nThird paragraph arrived'),
      )
      expect(view.getByText('First paragraph stays readable.')).toBeTruthy()
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      expect(view.queryByText('Third paragraph arrived')).toBeNull()

      act(() => {
        vi.advanceTimersByTime(PARAGRAPH_ADVANCE_MS)
      })
      expect(view.getByText('Third paragraph arrived')).toBeTruthy()
      expect(view.queryByText('First paragraph stays readable.')).toBeNull()
      expect(view.queryByText('Second paragraph is in progress')).toBeNull()
    })

    it('skips the roll when reduced motion is requested from the start', () => {
      stubMatchMedia(true)
      const view = render(reasoning('First paragraph stays readable.'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'))
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      expect(view.queryByText('First paragraph stays readable.')).toBeNull()
    })

    it('cancels an in-flight roll when reduced motion becomes requested', () => {
      const view = render(reasoning('First paragraph stays readable.'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond'))
      expect(view.getByText('First paragraph stays readable.')).toBeTruthy()
      stubMatchMedia(true)
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'))
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      expect(view.queryByText('First paragraph stays readable.')).toBeNull()
    })

    it('rolls when matchMedia is absent', () => {
      vi.stubGlobal('matchMedia', undefined)
      const view = render(reasoning('First paragraph stays readable.'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'))
      expect(view.getByText('First paragraph stays readable.')).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(PARAGRAPH_ADVANCE_MS)
      })
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
    })

    it('shows empty streaming text without rolling', () => {
      const view = render(reasoning(''))
      expect(view.getByText('运行中')).toBeTruthy()
      view.rerender(reasoning('\n\n'))
      expect(view.container.querySelector('[class*="line"]')?.textContent).toBe('\n\n')
    })

    it('cancels the roll on settle and keeps the last paragraph', () => {
      const view = render(reasoning('First paragraph stays readable.'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress', false))
      const settled = view.getByText('Second paragraph is in progress')
      overflowMetrics(settled)
      expect(settled.scrollLeft).toBe(0)
      expect(view.queryByText('First paragraph stays readable.')).toBeNull()
      act(() => {
        vi.advanceTimersByTime(PARAGRAPH_ADVANCE_MS)
      })
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      expect(view.queryByText('First paragraph stays readable.')).toBeNull()
    })

    it('treats collapse after expand as a first paint of the current generation', () => {
      const view = render(reasoning('First paragraph stays readable.'))
      view.rerender(reasoning('First paragraph stays readable.\n\nSecond paragraph is in progress'))
      fireEvent.click(view.getByText('思考'))
      fireEvent.click(view.getByText('思考'))
      expect(view.getByText('Second paragraph is in progress')).toBeTruthy()
      expect(view.queryByText('First paragraph stays readable.')).toBeNull()
    })
  })
})
