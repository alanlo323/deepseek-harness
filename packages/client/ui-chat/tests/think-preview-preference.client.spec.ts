import { describe, expect, it } from 'vitest'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import {
  DEFAULT_COLLAPSED_THINK_PREVIEW, ThinkPreviewPreference,
  type CollapsedThinkPreview,
} from '../src/client/think-preview.ts'

describe('ThinkPreviewPreference', () => {
  it('defaults to prefix and publishes explicit choices before persistence settles', () => {
    const host = stubSettingsScope<{ collapsedThinkPreview: CollapsedThinkPreview }>()
    const observed: string[] = []
    let current = (): string => 'unconstructed'
    const scope: typeof host.scope = {
      ...host.scope,
      set: (field, value) => {
        observed.push(`${field}=${String(value)}:${current()}`)
        return host.scope.set(field, value)
      },
    }
    const preference = new ThinkPreviewPreference(scope)
    current = () => preference.mode.getSnapshot()

    expect(preference.mode.getSnapshot()).toBe(DEFAULT_COLLAPSED_THINK_PREVIEW)
    preference.setMode('follow-end')
    expect(preference.mode.getSnapshot()).toBe('follow-end')
    expect(observed).toEqual(['collapsedThinkPreview=follow-end:follow-end'])
    expect(host.set).toHaveBeenCalledWith('collapsedThinkPreview', 'follow-end')
  })

  it('adopts Host state and ignores identical writes', () => {
    const host = stubSettingsScope<{ collapsedThinkPreview: CollapsedThinkPreview }>()
    const preference = new ThinkPreviewPreference(host.scope)

    host.publish({
      status: 'ready',
      value: { collapsedThinkPreview: 'follow-end' },
      revision: 1,
      writable: true,
    })
    expect(preference.mode.getSnapshot()).toBe('follow-end')
    preference.setMode('follow-end')
    expect(host.set).not.toHaveBeenCalled()

    host.publish({
      value: { collapsedThinkPreview: 'prefix' },
      revision: 2,
    })
    expect(preference.mode.getSnapshot()).toBe('prefix')
  })

  it('adopts an accepted section standing at construction', () => {
    const host = stubSettingsScope<{ collapsedThinkPreview: CollapsedThinkPreview }>()
    host.publish({
      status: 'ready',
      value: { collapsedThinkPreview: 'follow-end' },
      revision: 1,
      writable: true,
    })
    expect(new ThinkPreviewPreference(host.scope).mode.getSnapshot()).toBe('follow-end')
  })
})
