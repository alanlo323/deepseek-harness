/**
 * Per-session conversation view tabs, honoring optional `available` snapshots.
 * @module
 */

import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { resolveSlotLabel, type StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import type { ViewTab } from './contract/views.ts'

/** Slot roster face used to project conversation.view tabs. */
export interface ViewSlotRoster {
  entries(key: string): readonly StoredEntry[]
  subscribe(key: string, listener: () => void): () => void
}

function sameTabs(left: readonly ViewTab[], right: readonly ViewTab[]): boolean {
  return left.length === right.length
    && left.every((tab, index) => {
      const candidate = right.at(index)
      return candidate !== undefined && tab.id === candidate.id && tab.label === candidate.label
    })
}

function listedTabs(roster: ViewSlotRoster, binding: SessionBinding | undefined): ViewTab[] {
  const tabs: ViewTab[] = []
  for (const entry of roster.entries('conversation.view')) {
    const id = entry.options.id
    if (id === undefined) continue
    const available = entry.available as
      ((session: SessionBinding) => ObservableSnapshot<boolean>) | undefined
    if (available !== undefined) {
      if (binding === undefined || !available(binding).getSnapshot()) continue
    }
    tabs.push({
      id,
      label: resolveSlotLabel(entry.options.label) ?? id,
    })
  }
  return tabs
}

/**
 * Build a per-session view-tab source that tracks roster, locale, and availability.
 * @param roster - conversation.view registrations.
 * @param binding - current Session binding.
 * @param localeSubscribe - locale revision subscription.
 * @returns an observable of the tabs that should currently render.
 */
export function createSessionViewTabs(
  roster: ViewSlotRoster,
  binding: SessionBinding | undefined,
  localeSubscribe: (listener: () => void) => () => void,
): ObservableSnapshot<readonly ViewTab[]> {
  const listeners = new Set<() => void>()
  let snapshot: readonly ViewTab[] = listedTabs(roster, binding)
  let availabilityUnsubs: (() => void)[] = []

  const publish = (): void => {
    const next = listedTabs(roster, binding)
    if (sameTabs(snapshot, next)) return
    snapshot = next
    for (const listener of listeners) listener()
  }

  const bindAvailability = (): void => {
    for (const unsubscribe of availabilityUnsubs) unsubscribe()
    availabilityUnsubs = []
    if (binding === undefined) return
    for (const entry of roster.entries('conversation.view')) {
      const available = entry.available as
        ((session: SessionBinding) => ObservableSnapshot<boolean>) | undefined
      if (available === undefined) continue
      availabilityUnsubs.push(available(binding).subscribe(publish))
    }
  }

  let disposeRoster: (() => void) | undefined
  let disposeLocale: (() => void) | undefined

  const attach = (): void => {
    if (disposeRoster !== undefined) return
    bindAvailability()
    disposeRoster = roster.subscribe('conversation.view', () => {
      bindAvailability()
      publish()
    })
    disposeLocale = localeSubscribe(publish)
  }

  const detach = (): void => {
    disposeLocale?.()
    disposeRoster?.()
    disposeLocale = undefined
    disposeRoster = undefined
    for (const unsubscribe of availabilityUnsubs) unsubscribe()
    availabilityUnsubs = []
  }

  return {
    getSnapshot: () => {
      if (listeners.size === 0) {
        const next = listedTabs(roster, binding)
        if (!sameTabs(snapshot, next)) snapshot = next
      }
      return snapshot
    },
    subscribe: (listener) => {
      attach()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) detach()
      }
    },
  }
}
