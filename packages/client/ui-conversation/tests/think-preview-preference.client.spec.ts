import { describe, expect, it } from 'vitest'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import {
  ThinkPreviewPreference, DEFAULT_COLLAPSED_THINK_PREVIEW,
} from '../src/client/settings/think-preview-preference.ts'
import type { ConversationSettings } from '../src/submission-settings.ts'

describe('ThinkPreviewPreference', () => {
  it('defaults to prefix', () => {
    const preference = new ThinkPreviewPreference()
    expect(preference.mode.getSnapshot()).toBe(DEFAULT_COLLAPSED_THINK_PREVIEW)
  })

  it('writes an explicit change through the scope after publishing it locally', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const observed: string[] = []
    let liveMode = (): string => 'unconstructed'
    const scope: typeof host.scope = {
      ...host.scope,
      set: (field, value) => {
        observed.push(`${field}=${String(value)}:${liveMode()}`)
        return host.scope.set(field, value)
      },
    }
    const preference = new ThinkPreviewPreference(scope)
    liveMode = () => preference.mode.getSnapshot()
    preference.setMode('follow-end')
    expect(observed).toEqual(['collapsedThinkPreview=follow-end:follow-end'])
    expect(host.set).toHaveBeenCalledWith('collapsedThinkPreview', 'follow-end')
    expect(host.set).toHaveBeenCalledOnce()
  })

  it('adopts a Host preference without writing it back and leaves an identical write untouched', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const preference = new ThinkPreviewPreference(host.scope)
    host.publish({
      status: 'ready',
      value: { busyEnter: 'queue', collapsedThinkPreview: 'follow-end' },
      revision: 1,
      writable: true,
    })
    expect(preference.mode.getSnapshot()).toBe('follow-end')
    preference.setMode('follow-end')
    expect(host.set).not.toHaveBeenCalled()
    host.publish({
      value: { busyEnter: 'queue', collapsedThinkPreview: 'follow-end' },
      revision: 2,
    })
    expect(preference.mode.getSnapshot()).toBe('follow-end')
  })

  it('adopts a section already standing at construction', () => {
    const host = stubSettingsScope<ConversationSettings>()
    host.publish({
      status: 'ready',
      value: { busyEnter: 'queue', collapsedThinkPreview: 'follow-end' },
      revision: 1,
      writable: true,
    })
    const preference = new ThinkPreviewPreference(host.scope)
    expect(preference.mode.getSnapshot()).toBe('follow-end')
  })
})
