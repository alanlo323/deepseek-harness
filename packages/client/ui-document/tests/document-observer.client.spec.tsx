// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocumentObserver } from '../src/client/DocumentObserver.tsx'

afterEach(cleanup)

describe('DocumentObserver', () => {
  it('opens the Report view on a live successful present', () => {
    const openView = vi.fn()
    let captured: ((callId: string) => void) | undefined
    render(
      <DocumentObserver
        openView={openView}
        completeViewRequest={() => {}}
        watchAppendedPresents={(onPresent) => {
          captured = onPresent
          return () => {}
        }}
      />,
    )
    captured?.('c1')
    expect(openView).toHaveBeenCalledWith('document', 'c1')
  })
})
