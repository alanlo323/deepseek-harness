// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, type SessionListState, type WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { ChatNodeViewProps } from '../src/client/contract/slots.ts'
import type { ChatNode } from '../src/client/contract/chat-nodes.ts'
import { AssistantNodeView } from '../src/client/chat/AssistantNodeView.tsx'
import { zh } from '../src/client/locales.ts'
import type { CollapsedThinkPreview } from '../src/submission-settings.ts'

let nextAnimationFrameId = 1
let animationFrames = new Map<number, FrameRequestCallback>()

function flushAnimationFrames(count: number): void {
  for (let index = 0; index < count; index += 1) {
    const callbacks = [...animationFrames.values()]
    animationFrames.clear()
    for (const callback of callbacks) callback(index)
  }
}

beforeEach(() => {
  nextAnimationFrameId = 1
  animationFrames = new Map()
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

const node = {
  key: 'assistant:1:1',
  id: '1:1',
  target: 'chat',
  kind: 'assistant-step',
  anchorSeq: 1,
  location: { kind: 'session' },
  visibility: 'visible',
  data: {
    status: 'running',
    turn: 1,
    step: 1,
    blocks: [{ kind: 'reasoning', text: 'Inspect the session\nNewest reasoning tokens keep arriving' }],
    time: 0,
  },
} as ChatNode<'assistant-step'>

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }))
}

function emptyWorkspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  }))
}

describe('AssistantNodeView Think preview inject', () => {
  it('applies a live store flip in both directions on the same overflowing row', () => {
    const preview = createSnapshotStore<CollapsedThinkPreview>('prefix')
    const props = {
      node,
      useTurnData: () => undefined,
      useCollapsedThinkPreview: bindSnapshotSelector(preview),
      useSessions: emptySessions(),
      useWorkspaces: emptyWorkspaces(),
      openFile: () => {},
      inspectCall: () => {},
      forkAt: () => {},
      loadImage: () => Promise.reject(new Error('unused')),
      fileMentions: () => undefined,
      t,
    } as unknown as ChatNodeViewProps<'assistant-step'>

    const view = render(<AssistantNodeView {...props} />)
    const summary = view.getByText(/Inspect the session/)
    Object.defineProperties(summary, {
      scrollWidth: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 100 },
    })
    flushAnimationFrames(3)
    expect(summary.scrollLeft).toBe(0)
    expect(summary.hasAttribute('data-follow-end')).toBe(false)

    act(() => { preview.set('follow-end') })
    const followEndSummary = view.getByText('Newest reasoning tokens keep arriving')
    Object.defineProperties(followEndSummary, {
      scrollWidth: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 100 },
    })
    flushAnimationFrames(3)
    expect(followEndSummary.scrollLeft).toBe(200)
    expect(followEndSummary.getAttribute('data-follow-end')).toBe('true')

    act(() => { preview.set('prefix') })
    const prefixSummary = view.getByText(/Inspect the session/)
    Object.defineProperties(prefixSummary, {
      scrollWidth: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 100 },
    })
    flushAnimationFrames(3)
    expect(prefixSummary.scrollLeft).toBe(0)
    expect(prefixSummary.hasAttribute('data-follow-end')).toBe(false)
  })
})
