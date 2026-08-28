// @vitest-environment jsdom
import { createElement, type ComponentType } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PresentDocumentCard } from '../src/client/PresentDocumentCard.tsx'
import { zhHant } from '../src/client/locales.ts'

afterEach(cleanup)

const t = ((key: keyof typeof zhHant) => zhHant[key]) as never
const Card = PresentDocumentCard as ComponentType<Record<string, unknown>>

describe('PresentDocumentCard', () => {
  it('opens the Report view only after a successful present', () => {
    const openView = vi.fn()
    const running = render(createElement(Card, {
      callId: 'c1',
      toolName: 'present_document',
      block: { name: 'present_document', argsRaw: '{"path":"out/report.md"}' },
      openFile: () => {},
      openView,
      t,
    }))
    expect(running.queryByText(zhHant['card.open'])).toBeNull()
    expect(running.getByText('out/report.md')).toBeTruthy()
    running.unmount()

    const invalidArgs = render(createElement(Card, {
      callId: 'c1',
      toolName: 'present_document',
      block: { name: 'present_document', argsRaw: 'not-json' },
      openFile: () => {},
      openView,
      t,
    }))
    expect(invalidArgs.getByText('c1')).toBeTruthy()
    invalidArgs.unmount()

    const numberArgs = render(createElement(Card, {
      callId: 'c1',
      toolName: 'present_document',
      block: { name: 'present_document', argsRaw: '1' },
      openFile: () => {},
      t,
    }))
    expect(numberArgs.getByText('c1')).toBeTruthy()
    numberArgs.unmount()

    const nullArgs = render(createElement(Card, {
      callId: 'c1',
      toolName: 'present_document',
      block: { name: 'present_document', argsRaw: 'null' },
      openFile: () => {},
      t,
    }))
    expect(nullArgs.getByText('c1')).toBeTruthy()
    nullArgs.unmount()

    const badPath = render(createElement(Card, {
      callId: 'c1',
      toolName: 'present_document',
      block: { name: 'present_document', argsRaw: '{"path":1}' },
      openFile: () => {},
      t,
    }))
    expect(badPath.getByText('c1')).toBeTruthy()
    badPath.unmount()

    const failed = render(createElement(Card, {
      callId: 'c1',
      toolName: 'present_document',
      block: {
        kind: 'tool-result',
        seq: 1,
        time: 1,
        callId: 'c1',
        call: { name: 'present_document' },
        callTime: 1,
        content: [],
        isError: true,
        subCalls: [],
      },
      openFile: () => {},
      openView,
      t,
    }))
    expect(failed.queryByText(zhHant['card.open'])).toBeNull()
    failed.unmount()

    const settled = render(createElement(Card, {
      callId: 'c1',
      toolName: 'present_document',
      block: {
        kind: 'tool-result',
        seq: 1,
        time: 1,
        callId: 'c1',
        call: { name: 'present_document', argsRaw: '{"path":"out/report.md"}' },
        callTime: 1,
        content: [],
        isError: false,
        meta: {
          kind: 'submitted-document',
          title: 'Findings',
          logicalPath: 'out/report.md',
          images: [],
          truncated: false,
        },
        subCalls: [],
      },
      openFile: () => {},
      openView,
      t,
    }))
    fireEvent.click(settled.getByText(zhHant['card.open']))
    expect(openView).toHaveBeenCalledWith('document', 'c1')
  })
})
