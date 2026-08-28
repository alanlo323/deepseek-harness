// @vitest-environment jsdom
import { createElement, type ComponentType } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { DocumentView } from '../src/client/DocumentView.tsx'
import { zhHant } from '../src/client/locales.ts'
import type { ClientSubmittedDocument } from '../src/client/documents.ts'

afterEach(cleanup)

const t = ((key: keyof typeof zhHant) => zhHant[key]) as never
const View = DocumentView as ComponentType<Record<string, unknown>>

function documentOf(over: Partial<ClientSubmittedDocument> = {}): ClientSubmittedDocument {
  return {
    callId: 'c1',
    seq: 1,
    title: 'Findings',
    logicalPath: 'out/report.md',
    images: [],
    truncated: false,
    content: '# Findings\n',
    ...over,
  }
}

const FINDINGS = documentOf()
const LATER = documentOf({ callId: 'c2', seq: 2, title: 'Later' })
const WITH_IMAGES = documentOf({
  images: [{ ref: 'out/a.png', mediaType: 'image/png' }],
  content: '# Findings\n\n![ok](a.png) ![skip](https://x/a.png) ![gone](missing.png)\n',
})
const TRUNCATED: ClientSubmittedDocument = {
  callId: 'c1',
  seq: 1,
  title: 'Findings',
  logicalPath: 'out/report.md',
  images: [],
  truncated: true,
}
const MISSING_BODY: ClientSubmittedDocument = {
  callId: 'c1',
  seq: 1,
  title: 'Findings',
  logicalPath: 'out/report.md',
  images: [],
  truncated: false,
}
const EMPTY_DOCS: readonly ClientSubmittedDocument[] = []
const FINDINGS_DOCS: readonly ClientSubmittedDocument[] = [FINDINGS]
const TWO_DOCS: readonly ClientSubmittedDocument[] = [WITH_IMAGES, LATER]
const TRUNCATED_DOCS: readonly ClientSubmittedDocument[] = [TRUNCATED]
const MISSING_DOCS: readonly ClientSubmittedDocument[] = [MISSING_BODY]

function renderView(props: Record<string, unknown>) {
  return render(createElement(View, {
    sessionId: SessionId('s1'),
    viewRequest: null,
    completeViewRequest: () => {},
    t,
    ...props,
  }))
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('DocumentView', () => {
  it('shows the empty notice when no document has been presented', () => {
    const view = renderView({
      useStore: (select: (s: { selectedCallId: null; source: 'snapshot' }) => unknown) => select({
        selectedCallId: null,
        source: 'snapshot',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(EMPTY_DOCS),
      readLive: vi.fn(async () => ({ ok: true, value: { markdown: '' } })),
    })
    expect(view.getByText(zhHant.empty)).toBeTruthy()
  })

  it('selects the latest document when the store has no call id and resolves workspace images', () => {
    const fallbackSelected = vi.fn()
    const view = renderView({
      useStore: (select: (s: { selectedCallId: null; source: 'snapshot' }) => unknown) => select({
        selectedCallId: null,
        source: 'snapshot',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select([WITH_IMAGES]),
      readLive: vi.fn(async () => ({ ok: true, value: { markdown: '' } })),
    })
    expect(fallbackSelected).toHaveBeenCalledWith('c1')
    expect(view.container.querySelector('img')?.getAttribute('src')).toContain('submitted-document-image')
  })

  it('renders snapshot Markdown, honors focus, and falls back to the latest present', () => {
    const selectCall = vi.fn()
    const completeViewRequest = vi.fn()
    const fallbackSelected = vi.fn()
    const setSource = vi.fn()
    const view = renderView({
      viewRequest: { view: 'document', focus: 'c1' },
      completeViewRequest,
      useStore: (select: (s: { selectedCallId: string; source: 'snapshot' }) => unknown) => select({
        selectedCallId: 'missing',
        source: 'snapshot',
      }),
      actions: { selectCall, setSource, fallbackSelected },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(TWO_DOCS),
      readLive: vi.fn(async () => ({ ok: true, value: { markdown: '' } })),
    })
    expect(selectCall).toHaveBeenCalledWith('c1')
    expect(completeViewRequest).toHaveBeenCalled()
    expect(fallbackSelected).toHaveBeenCalledWith('c2')
    fireEvent.change(view.getByRole('combobox'), { target: { value: 'c1' } })
    expect(selectCall).toHaveBeenCalledWith('c1')
    fireEvent.click(view.getByText(zhHant['source.live']))
    expect(setSource).toHaveBeenCalledWith('live')
    fireEvent.click(view.getByText(zhHant['source.snapshot']))
    expect(setSource).toHaveBeenCalledWith('snapshot')
  })

  it('shows truncated and missing snapshot notices', () => {
    const truncated = renderView({
      useStore: (select: (s: { selectedCallId: string; source: 'snapshot' }) => unknown) => select({
        selectedCallId: 'c1',
        source: 'snapshot',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(TRUNCATED_DOCS),
      readLive: vi.fn(async () => ({ ok: true, value: { markdown: '' } })),
    })
    expect(truncated.getByText(zhHant.truncated)).toBeTruthy()
    truncated.unmount()

    const missing = renderView({
      useStore: (select: (s: { selectedCallId: string; source: 'snapshot' }) => unknown) => select({
        selectedCallId: 'c1',
        source: 'snapshot',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(MISSING_DOCS),
      readLive: vi.fn(async () => ({ ok: true, value: { markdown: '' } })),
    })
    expect(missing.getByText(zhHant.missing)).toBeTruthy()
  })

  it('renders live Markdown and reports live failures', async () => {
    const live = renderView({
      useStore: (select: (s: { selectedCallId: string; source: 'live' }) => unknown) => select({
        selectedCallId: 'c1',
        source: 'live',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(FINDINGS_DOCS),
      readLive: vi.fn(async () => ({
        ok: true,
        value: {
          title: 'Findings',
          logicalPath: 'out/report.md',
          markdown: '# Live body\n',
          source: 'live',
          images: [],
        },
      })),
    })
    await flush()
    expect(live.getByText('Live body')).toBeTruthy()
    live.unmount()

    const failed = renderView({
      useStore: (select: (s: { selectedCallId: string; source: 'live' }) => unknown) => select({
        selectedCallId: 'c1',
        source: 'live',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(FINDINGS_DOCS),
      readLive: vi.fn(async () => ({ ok: false, error: { code: 'unreadable' } })),
    })
    await flush()
    expect(failed.getByText(zhHant.missing)).toBeTruthy()
    failed.unmount()

    const rejected = renderView({
      useStore: (select: (s: { selectedCallId: string; source: 'live' }) => unknown) => select({
        selectedCallId: 'c1',
        source: 'live',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(FINDINGS_DOCS),
      readLive: vi.fn(async () => { throw new Error('network') }),
    })
    await flush()
    expect(rejected.getByText(zhHant.missing)).toBeTruthy()
    rejected.unmount()
  })

  it('cancels an in-flight live read on unmount', async () => {
    let finish!: (value: unknown) => void
    const pending = new Promise((resolve) => { finish = resolve })
    const view = renderView({
      useStore: (select: (s: { selectedCallId: string; source: 'live' }) => unknown) => select({
        selectedCallId: 'c1',
        source: 'live',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(FINDINGS_DOCS),
      readLive: vi.fn(async () => pending),
    })
    view.unmount()
    await act(async () => {
      finish({
        ok: true,
        value: {
          title: 'Findings',
          logicalPath: 'out/report.md',
          markdown: '# Cancelled\n',
          source: 'live',
          images: [],
        },
      })
    })

    let reject!: (error: Error) => void
    const pendingReject = new Promise((_resolve, rejectFn) => { reject = rejectFn })
    const rejected = renderView({
      useStore: (select: (s: { selectedCallId: string; source: 'live' }) => unknown) => select({
        selectedCallId: 'c1',
        source: 'live',
      }),
      actions: { selectCall: () => {}, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(FINDINGS_DOCS),
      readLive: vi.fn(async () => pendingReject),
    })
    rejected.unmount()
    await act(async () => { reject(new Error('network')) })
  })

  it('ignores a focus request addressed to another view', () => {
    const selectCall = vi.fn()
    const completeViewRequest = vi.fn()
    renderView({
      viewRequest: { view: 'chat', focus: 'c1' },
      completeViewRequest,
      useStore: (select: (s: { selectedCallId: string; source: 'snapshot' }) => unknown) => select({
        selectedCallId: 'c1',
        source: 'snapshot',
      }),
      actions: { selectCall, setSource: () => {}, fallbackSelected: () => {} },
      useDocuments: (select: (docs: readonly ClientSubmittedDocument[]) => unknown) => select(FINDINGS_DOCS),
      readLive: vi.fn(async () => ({ ok: true, value: { markdown: '' } })),
    })
    expect(selectCall).not.toHaveBeenCalled()
    expect(completeViewRequest).not.toHaveBeenCalled()
  })
})
