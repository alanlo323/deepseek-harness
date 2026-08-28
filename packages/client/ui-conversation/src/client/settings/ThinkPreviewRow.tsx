/** General Settings row for the collapsed Think streaming-summary preference. */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CollapsedThinkPreview } from '../../submission-settings.ts'
import type { ConversationKey } from '../locales.ts'
import { SettingsSelectRow } from './SettingsSelectRow.tsx'

/** Registration-side preference face. */
export interface ThinkPreviewRowInjected {
  hooks: {
    /** Persisted collapsed Think preview mode bound as useCollapsedThinkPreview. */
    collapsedThinkPreview: SnapshotStore<CollapsedThinkPreview>
  }
  /** Change the collapsed streaming Think summary mode. */
  setCollapsedThinkPreview: (mode: CollapsedThinkPreview) => void
}

/** Full Settings-row props. */
export type ThinkPreviewRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'conversation'>
  & InjectFace<ThinkPreviewRowInjected>

const OPTIONS: readonly {
  id: CollapsedThinkPreview
  label: ConversationKey
}[] = [
  { id: 'prefix', label: 'settings.thinkPreview.prefix' },
  { id: 'follow-end', label: 'settings.thinkPreview.followEnd' },
]

/**
 * Render the collapsed Think preview mode selector.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function ThinkPreviewRow({
  useCollapsedThinkPreview, setCollapsedThinkPreview, t,
}: ThinkPreviewRowProps) {
  const mode = useCollapsedThinkPreview(value => value)
  const selectedLabel = mode === 'follow-end'
    ? 'settings.thinkPreview.followEnd'
    : 'settings.thinkPreview.prefix'
  return (
    <SettingsSelectRow
      title={t('settings.thinkPreview.title')}
      description={t('settings.thinkPreview.description')}
      items={OPTIONS.map(option => ({ id: option.id, label: t(option.label) }))}
      selectedId={mode}
      selectedLabel={t(selectedLabel)}
      onSelect={setCollapsedThinkPreview}
    />
  )
}
