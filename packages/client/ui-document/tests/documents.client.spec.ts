import { describe, expect, it } from 'vitest'
import type {
  SessionBinding,
  SessionEventLikeEntry,
  SessionEventWindow,
} from '@deepseek-ai/dsh-api-session-controller/client'
import {
  availableDocuments,
  documentsIndex,
  latestDocument,
  scanSubmittedDocuments,
  watchAppendedPresents,
} from '../src/client/documents.ts'
import {
  clientJoinLogicalPath,
  clientLogicalDirectory,
  parseClientSubmittedDocumentMeta,
} from '../src/client/meta.ts'

function presentEntry(callId: string, seq: number, title = 'Report'): SessionEventLikeEntry {
  return {
    type: 'event',
    event: {
      type: 'tool/result',
      seq,
      time: seq,
      data: {
        turn: 1,
        step: 1,
        message: {
          role: 'user',
          content: [{
            type: 'tool-result',
            toolCallId: callId,
            content: [{ type: 'text', text: 'ok' }],
          }],
        },
        meta: {
          kind: 'submitted-document',
          title,
          logicalPath: 'out/report.md',
          byteLength: 8,
          images: [],
          truncated: false,
          content: '# Hi\n',
        },
      },
    },
  } as SessionEventLikeEntry
}

function bindingOf(window: {
  entries: SessionEventLikeEntry[]
  hasMore: boolean
  revision: number
  change: SessionEventWindow['change']
}): SessionBinding & { publish(): void } {
  const listeners = new Set<() => void>()
  return {
    eventSource: {
      getSnapshot: () => window as SessionEventWindow,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    publish: () => {
      for (const listener of listeners) listener()
    },
  } as unknown as SessionBinding & { publish(): void }
}

describe('scanSubmittedDocuments', () => {
  it('keeps successful presents in log order and ignores failures', () => {
    const failed = presentEntry('c0', 1)
    const failedEvent = failed as { event: { data: { message: { content: [{ isError?: boolean }] } } } }
    failedEvent.event.data.message.content[0].isError = true
    const docs = scanSubmittedDocuments([
      failed,
      presentEntry('c1', 2, 'One'),
      { type: 'chunks', event: { type: 'assistant/chunk' } } as unknown as SessionEventLikeEntry,
      presentEntry('c1', 4, 'One-updated'),
      presentEntry('c2', 3, 'Two'),
    ])
    expect(docs.map(item => item.callId)).toEqual(['c1', 'c2'])
    expect(docs[0]?.title).toBe('One-updated')
    expect(latestDocument(docs)?.callId).toBe('c1')
    expect(latestDocument([])).toBeUndefined()
    const badMeta = presentEntry('bad-meta', 4)
    ;(badMeta as { event: { data: { meta: unknown } } }).event.data.meta = { kind: 'other' }
    expect(scanSubmittedDocuments([
      {
        type: 'event',
        event: { type: 'turn/start', seq: 1, time: 1, data: {} },
      } as unknown as SessionEventLikeEntry,
      {
        type: 'event',
        event: {
          type: 'tool/result',
          seq: 2,
          time: 2,
          data: { message: { content: [] }, meta: { kind: 'submitted-document' } },
        },
      } as unknown as SessionEventLikeEntry,
      {
        type: 'event',
        event: {
          type: 'tool/result',
          seq: 2,
          time: 2,
          data: { message: { content: [null] }, meta: { kind: 'submitted-document' } },
        },
      } as unknown as SessionEventLikeEntry,
      {
        type: 'event',
        event: {
          type: 'tool/result',
          seq: 2,
          time: 2,
          data: {
            message: { content: [{ type: 'tool-result' }] },
            meta: { kind: 'submitted-document', title: 'T', logicalPath: 'a.md', truncated: false, images: [] },
          },
        },
      } as unknown as SessionEventLikeEntry,
      {
        type: 'event',
        event: {
          type: 'tool/result',
          seq: 3,
          time: 3,
          data: {
            message: { content: [{ type: 'text', text: 'nope' }] },
            meta: { kind: 'submitted-document', title: 'T', logicalPath: 'a.md', truncated: false, images: [] },
          },
        },
      } as unknown as SessionEventLikeEntry,
      badMeta,
    ])).toEqual([])
    expect(latestDocument([
      { callId: 'late', seq: 5, title: 'Late', logicalPath: 'a.md', images: [], truncated: false },
      { callId: 'early', seq: 1, title: 'Early', logicalPath: 'b.md', images: [], truncated: false },
    ])?.callId).toBe('late')
  })
})

describe('documentsIndex', () => {
  it('reports availability only after a successful present', () => {
    const window = {
      entries: [] as SessionEventLikeEntry[],
      hasMore: false,
      revision: 0,
      change: { kind: 'replace', entries: [] } as SessionEventWindow['change'],
    }
    const binding = bindingOf(window)
    const index = documentsIndex(binding)
    expect(documentsIndex(binding)).toBe(index)
    expect(index.available.getSnapshot()).toBe(false)
    window.entries = [presentEntry('c1', 1)]
    expect(index.available.getSnapshot()).toBe(true)
    expect(index.documents.getSnapshot()[0]?.callId).toBe('c1')
    expect(availableDocuments(binding).getSnapshot()).toBe(true)

    let docTicks = 0
    let availTicks = 0
    const stopDocs = index.documents.subscribe(() => { docTicks += 1 })
    const stopAvail = index.available.subscribe(() => { availTicks += 1 })
    expect(index.documents.getSnapshot()[0]?.callId).toBe('c1')
    expect(index.available.getSnapshot()).toBe(true)
    binding.publish()
    expect(docTicks).toBe(0)
    expect(availTicks).toBe(0)
    window.entries = [presentEntry('c1', 2)]
    binding.publish()
    expect(docTicks).toBe(1)
    window.entries = []
    binding.publish()
    expect(availTicks).toBe(1)
    stopDocs()
    stopAvail()
  })
})

describe('watchAppendedPresents', () => {
  it('fires only for append windows, not replace', () => {
    const window = {
      entries: [] as SessionEventLikeEntry[],
      hasMore: false,
      revision: 0,
      change: { kind: 'replace', entries: [] } as SessionEventWindow['change'],
    }
    const binding = bindingOf(window)
    const seen: string[] = []
    const stop = watchAppendedPresents(binding, (callId) => { seen.push(callId) })
    window.change = { kind: 'replace', entries: [presentEntry('c0', 1)] as never }
    binding.publish()
    expect(seen).toEqual([])
    const appended = presentEntry('c1', 2)
    window.change = { kind: 'append', entries: [appended] as never }
    window.entries = [appended]
    binding.publish()
    expect(seen).toEqual(['c1'])
    window.change = { kind: 'append', entries: [
      { type: 'chunks', event: { type: 'assistant/chunk' } } as unknown as SessionEventLikeEntry,
    ] as never }
    binding.publish()
    expect(seen).toEqual(['c1'])
    stop()
  })
})

describe('client submitted-document meta', () => {
  it('parses a snapshot and joins contained image paths', () => {
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: ' Findings ',
      logicalPath: 'out/report.md',
      truncated: false,
      images: [{ ref: 'out/a.png', mediaType: 'image/png' }],
      content: '# Hi\n',
    })).toEqual({
      title: 'Findings',
      logicalPath: 'out/report.md',
      truncated: false,
      images: [{ ref: 'out/a.png', mediaType: 'image/png' }],
      content: '# Hi\n',
    })
    expect(parseClientSubmittedDocumentMeta({ kind: 'other' })).toBeUndefined()
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: '  ',
      logicalPath: 'out/report.md',
      truncated: false,
      images: [],
    })).toBeUndefined()
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: 'T',
      logicalPath: '',
      truncated: false,
      images: [],
    })).toBeUndefined()
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: 'T',
      logicalPath: 'out/report.md',
      truncated: 'no',
      images: [],
    })).toBeUndefined()
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: 'T',
      logicalPath: 'out/report.md',
      truncated: false,
      content: 1,
      images: [],
    })).toBeUndefined()
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: 'T',
      logicalPath: 'out/report.md',
      truncated: false,
      images: 'no',
    })).toBeUndefined()
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: 'T',
      logicalPath: 'out/report.md',
      truncated: false,
      images: [null],
    })).toBeUndefined()
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: 'T',
      logicalPath: 'out/report.md',
      truncated: false,
      images: [{ ref: '', mediaType: 'image/png' }],
    })).toBeUndefined()
    expect(parseClientSubmittedDocumentMeta({
      kind: 'submitted-document',
      title: 'T',
      logicalPath: 'out/report.md',
      truncated: true,
      images: [],
    })).toEqual({
      title: 'T',
      logicalPath: 'out/report.md',
      truncated: true,
      images: [],
    })
    expect(clientLogicalDirectory('out/report.md')).toBe('out')
    expect(clientLogicalDirectory('report.md')).toBe('')
    expect(clientJoinLogicalPath('out', 'a.png')).toBe('out/a.png')
    expect(clientJoinLogicalPath('out', '../secret.png')).toBe('secret.png')
    expect(clientJoinLogicalPath('out', '../../secret.png')).toBeUndefined()
    expect(clientJoinLogicalPath('', 'a.png')).toBe('a.png')
    expect(clientJoinLogicalPath('out', 'https://x/a.png')).toBeUndefined()
    expect(clientJoinLogicalPath('out', '')).toBeUndefined()
    expect(clientJoinLogicalPath('out', '/abs.png')).toBeUndefined()
    expect(clientJoinLogicalPath('out', '\\win.png')).toBeUndefined()
    expect(clientJoinLogicalPath('out', 'C:\\a.png')).toBeUndefined()
    expect(clientJoinLogicalPath('out', 'data:image/png;base64,x')).toBeUndefined()
    expect(clientJoinLogicalPath('out', 'blob:abc')).toBeUndefined()
    expect(clientJoinLogicalPath('a', '..')).toBeUndefined()
    expect(clientJoinLogicalPath('out', 'foo/./bar.png')).toBe('out/foo/bar.png')
  })
})
