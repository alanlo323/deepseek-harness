import { describe, expect, it } from 'vitest'
import { createDocumentViewStore } from '../src/client/stores.ts'

describe('createDocumentViewStore', () => {
  it('selects a call in snapshot mode and keeps live source on fallback', () => {
    const store = createDocumentViewStore().create('session-1')
    expect(store.store.getSnapshot()).toEqual({ selectedCallId: null, source: 'snapshot' })
    store.actions.selectCall('c1')
    expect(store.store.getSnapshot()).toEqual({ selectedCallId: 'c1', source: 'snapshot' })
    store.actions.setSource('live')
    store.actions.fallbackSelected('c2')
    expect(store.store.getSnapshot()).toEqual({ selectedCallId: 'c2', source: 'live' })
  })
})
