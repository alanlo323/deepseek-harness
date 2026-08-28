import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { SUBMITTED_DOCUMENT_KIND } from '@deepseek-ai/dsh-document-core'
import { applySubmittedDocuments, toolResultCallId } from '../src/projection.ts'

function resultEvent(callId: string, meta: unknown, isError = false): SessionEvent {
  return {
    type: 'tool/result',
    seq: 1,
    time: 1,
    data: {
      turn: 1,
      step: 1,
      message: createUserMessage({
        source: { kind: 'tool', callId: ToolCallId(callId) },
        content: [{
          type: 'tool-result',
          toolCallId: ToolCallId(callId),
          content: [{ type: 'text', text: 'ok' }],
          ...isError ? { isError: true } : {},
        }],
      }),
      ...meta !== undefined ? { meta } : {},
    },
  } as SessionEvent
}

describe('submittedDocuments projection', () => {
  it('ignores failures and unrelated results, then records a successful present', () => {
    const failed = applySubmittedDocuments([], resultEvent('c1', {
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'Nope',
      logicalPath: 'x.md',
      byteLength: 1,
      images: [],
      truncated: false,
    }, true))
    expect(failed).toEqual([])

    const unrelated = applySubmittedDocuments([], resultEvent('c2', { card: true }))
    expect(unrelated).toEqual([])

    const ok = applySubmittedDocuments([], resultEvent('c3', {
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'Report',
      logicalPath: 'out/report.md',
      byteLength: 12,
      images: [{ ref: 'out/a.png', mediaType: 'image/png' }],
      truncated: false,
      content: '# Report\n',
    }))
    expect(ok).toEqual([{
      callId: 'c3',
      seq: 1,
      title: 'Report',
      logicalPath: 'out/report.md',
      images: [{ ref: 'out/a.png', mediaType: 'image/png' }],
    }])

    const replaced = applySubmittedDocuments(ok, {
      ...resultEvent('c3', {
        kind: SUBMITTED_DOCUMENT_KIND,
        title: 'Updated',
        logicalPath: 'out/report.md',
        byteLength: 4,
        images: [],
        truncated: false,
      }),
      seq: 2,
    })
    expect(replaced).toEqual([{
      callId: 'c3',
      seq: 2,
      title: 'Updated',
      logicalPath: 'out/report.md',
      images: [],
    }])
  })

  it('reads a tool-result call id only from an object block', () => {
    expect(toolResultCallId(undefined)).toBeUndefined()
    expect(toolResultCallId(null)).toBeUndefined()
    expect(toolResultCallId('text')).toBeUndefined()
    expect(toolResultCallId({ type: 'text' })).toBeUndefined()
    expect(toolResultCallId({ type: 'tool-result' })).toBeUndefined()
    expect(toolResultCallId({ type: 'tool-result', toolCallId: 1 })).toBeUndefined()
    expect(toolResultCallId({ type: 'tool-result', toolCallId: 'c1', isError: true }, true)).toBeUndefined()
    expect(toolResultCallId({ type: 'tool-result', toolCallId: 'c1', isError: true })).toBe('c1')
    expect(toolResultCallId({ type: 'tool-result', toolCallId: 'c1' }, true)).toBe('c1')
  })
})
