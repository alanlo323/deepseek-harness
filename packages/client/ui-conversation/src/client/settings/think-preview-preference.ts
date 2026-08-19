/**
 * Collapsed Think preview preference. It owns the live mode store and writes
 * through the Host conversation settings section; ReasoningRow remains a
 * presentation consumer of the published value.
 */
import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  COLLAPSED_THINK_PREVIEW_FIELD, DEFAULT_COLLAPSED_THINK_PREVIEW,
} from '../../submission-settings.ts'
import type { CollapsedThinkPreview, ConversationSettings } from '../../submission-settings.ts'

export { DEFAULT_COLLAPSED_THINK_PREVIEW } from '../../submission-settings.ts'

/**
 * Durable collapsed-Think preview mode used by the General Settings row and
 * the assistant chat-node inject face.
 */
export class ThinkPreviewPreference {
  /** Reactive preference source for Settings and the Think row. */
  readonly mode: SnapshotStore<CollapsedThinkPreview> = createSnapshotStore(DEFAULT_COLLAPSED_THINK_PREVIEW)
  private readonly host: SettingsScope<ConversationSettings> | undefined

  /**
   * @param host - durable preference scope owned by the providing plugin;
   * absent compositions stay process-local. The adoption subscription shares
   * the scope's plugin lifetime — a disposed scope never publishes again, so
   * the preference needs no release hook.
   */
  constructor(host?: SettingsScope<ConversationSettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Change the collapsed streaming summary mode; the live value publishes
   * before the durable write starts.
   * @param mode - paragraph-start prefix or latest-line end-follow.
   */
  setMode(mode: CollapsedThinkPreview): void {
    if (this.mode.getSnapshot() === mode) return
    this.mode.set(mode)
    void this.host?.set(COLLAPSED_THINK_PREVIEW_FIELD, mode)
  }

  /**
   * Adopt the scope's accepted durable mode without writing it back.
   * @param host - the constructor-narrowed scope driving this adoption.
   */
  private adopt(host: SettingsScope<ConversationSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined) return
    const next = section.collapsedThinkPreview
    if (this.mode.getSnapshot() === next) return
    this.mode.set(next)
  }
}
