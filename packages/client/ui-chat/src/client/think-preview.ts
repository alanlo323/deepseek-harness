/** Host-backed collapsed Think streaming-summary preference. */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'

/** How an unopened streaming Think row shows live reasoning. */
export type CollapsedThinkPreview = 'prefix' | 'follow-end'

/** Matches `COLLAPSED_THINK_PREVIEW_FIELD` on the conversation Host section. */
const COLLAPSED_THINK_PREVIEW_FIELD = 'collapsedThinkPreview' as const

/** Conversation Host section fields this preference reads and writes. */
export interface ThinkPreviewSettings {
  collapsedThinkPreview: CollapsedThinkPreview
}

/** Default keeps the collapsed streaming summary readable at the paragraph start. */
export const DEFAULT_COLLAPSED_THINK_PREVIEW: CollapsedThinkPreview = 'prefix'

/**
 * Durable collapsed-Think preview mode for the assistant Chat-node inject
 * face. Persistence and the General Settings row stay on the conversation
 * plugin; Chat owns the live store that ReasoningRow reads.
 */
export class ThinkPreviewPreference {
  /** Reactive current mode; defaults to prefix before Host settings arrive. */
  readonly mode: SnapshotStore<CollapsedThinkPreview> = createSnapshotStore(DEFAULT_COLLAPSED_THINK_PREVIEW)

  /**
   * @param host - durable conversation settings scope that owns this field.
   */
  constructor(private readonly host: SettingsScope<ThinkPreviewSettings>) {
    host.subscribe(() => { this.adopt() })
    this.adopt()
  }

  /**
   * Publish and persist one explicit user choice.
   * @param mode - paragraph-start prefix or latest-line end-follow.
   */
  setMode(mode: CollapsedThinkPreview): void {
    if (this.mode.getSnapshot() === mode) return
    this.mode.set(mode)
    void this.host.set(COLLAPSED_THINK_PREVIEW_FIELD, mode)
  }

  /** Adopt the latest accepted Host section without writing it back. */
  private adopt(): void {
    const section = this.host.getSnapshot().value
    if (section === undefined || this.mode.getSnapshot() === section.collapsedThinkPreview) return
    this.mode.set(section.collapsedThinkPreview)
  }
}
