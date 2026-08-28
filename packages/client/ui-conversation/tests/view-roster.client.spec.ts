import { describe, expect, it } from 'vitest'
import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import {
  createSessionViewTabs,
  type ViewSlotRoster,
} from '../src/client/view-roster.ts'

function booleanSource(initial: boolean): ObservableSnapshot<boolean> & { set(value: boolean): void } {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      if (next === value) return
      value = next
      for (const listener of listeners) listener()
    },
  }
}

describe('createSessionViewTabs', () => {
  it('omits a gated tab until available is true and lists ungated tabs immediately', () => {
    const available = booleanSource(false)
    const rosterListeners = new Set<() => void>()
    const entries: StoredEntry[] = [
      {
        component: null,
        options: { id: 'chat', label: 'Chat' },
      },
      {
        component: null,
        options: { id: 'document', label: 'Report' },
        available: () => available,
      },
    ]
    const roster: ViewSlotRoster = {
      entries: () => entries,
      subscribe: (_key, listener) => {
        rosterListeners.add(listener)
        return () => { rosterListeners.delete(listener) }
      },
    }
    const tabs = createSessionViewTabs(
      roster,
      {} as SessionBinding,
      () => () => {},
    )
    expect(tabs.getSnapshot().map(tab => tab.id)).toEqual(['chat'])

    let published = 0
    const stop = tabs.subscribe(() => { published += 1 })
    available.set(true)
    expect(tabs.getSnapshot().map(tab => tab.id)).toEqual(['chat', 'document'])
    expect(published).toBeGreaterThan(0)
    available.set(false)
    expect(tabs.getSnapshot().map(tab => tab.id)).toEqual(['chat'])
    stop()
  })

  it('skips id-less entries, gated tabs without a binding, and detaches when the last listener leaves', () => {
    const available = booleanSource(true)
    const rosterListeners = new Set<() => void>()
    const localeListeners = new Set<() => void>()
    const entries: StoredEntry[] = [
      { component: null, options: {} },
      { component: null, options: { id: 'chat', label: () => 'Chat' } },
      {
        component: null,
        options: { id: 'document', label: 'Report' },
        available: () => available,
      },
    ]
    const roster: ViewSlotRoster = {
      entries: () => entries,
      subscribe: (_key, listener) => {
        rosterListeners.add(listener)
        return () => { rosterListeners.delete(listener) }
      },
    }
    const unbound = createSessionViewTabs(roster, undefined, (listener) => {
      localeListeners.add(listener)
      return () => { localeListeners.delete(listener) }
    })
    expect(unbound.getSnapshot().map(tab => tab.id)).toEqual(['chat'])
    expect(unbound.getSnapshot()).toBe(unbound.getSnapshot())

    const bound = createSessionViewTabs(roster, {} as SessionBinding, (listener) => {
      localeListeners.add(listener)
      return () => { localeListeners.delete(listener) }
    })
    const first = bound.subscribe(() => {})
    const second = bound.subscribe(() => {})
    expect(rosterListeners.size).toBe(1)
    for (const listener of [...rosterListeners]) listener()
    for (const listener of [...localeListeners]) listener()
    expect(bound.getSnapshot().map(tab => tab.id)).toEqual(['chat', 'document'])
    first()
    expect(rosterListeners.size).toBe(1)
    second()
    expect(rosterListeners.size).toBe(0)
  })
})
