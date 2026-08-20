// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { ThinkPreviewRow } from '../src/client/settings/ThinkPreviewRow.tsx'
import type { ThinkPreviewRowProps } from '../src/client/settings/ThinkPreviewRow.tsx'
import { ThinkPreviewPreference } from '../src/client/settings/think-preview-preference.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

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

function mount() {
  const preference = new ThinkPreviewPreference()
  const setCollapsedThinkPreview = vi.fn((mode: 'prefix' | 'follow-end') => { preference.setMode(mode) })
  const props: ThinkPreviewRowProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useCollapsedThinkPreview: bindSnapshotSelector(preference.mode),
    setCollapsedThinkPreview,
    t: makeTranslate(en),
  }
  render(<ThinkPreviewRow {...props} />)
  return { preference, setCollapsedThinkPreview }
}

describe('ThinkPreviewRow', () => {
  it('explains the collapsed-only scope and shows paragraph start by default', () => {
    mount()
    expect(screen.getByText('Collapsed Think summary')).toBeDefined()
    expect(screen.getByText(/While thinking and collapsed/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Paragraph start/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('selects follow-end, follows later preference changes, and closes outside', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('button', { name: /Paragraph start/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Follow latest characters' }))
    expect(b.setCollapsedThinkPreview).toHaveBeenCalledWith('follow-end')
    expect(screen.getByRole('button', { name: /Follow latest characters/ })).toBeDefined()

    act(() => { b.preference.setMode('prefix') })
    fireEvent.click(screen.getByRole('button', { name: /Paragraph start/ }))
    expect(screen.getByRole('menuitem', { name: 'Follow latest characters' })).toBeDefined()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menuitem', { name: 'Follow latest characters' })).toBeNull()
  })
})
