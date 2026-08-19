/** Conversation preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the conversation plugin. */
export const CONVERSATION_SETTINGS_NAMESPACE = 'ui-conversation'

/** Field carrying the delivery mode for plain Enter while an agent is busy. */
export const BUSY_ENTER_FIELD = 'busyEnter'

/** Busy-Enter behaviors accepted at settings and input boundaries. */
export const BUSY_ENTER_BEHAVIORS = ['queue', 'steer'] as const

/** Configurable meaning of plain Enter while the addressed agent is busy. */
export type BusyEnterBehavior = typeof BUSY_ENTER_BEHAVIORS[number]

/** Default preserves Enter-as-Queue for running conversations. */
export const DEFAULT_BUSY_ENTER_BEHAVIOR: BusyEnterBehavior = 'queue'

/** Field carrying the collapsed Think streaming-summary mode. */
export const COLLAPSED_THINK_PREVIEW_FIELD = 'collapsedThinkPreview'

/** Collapsed Think preview modes accepted at settings and presentation boundaries. */
export const COLLAPSED_THINK_PREVIEW_MODES = ['prefix', 'follow-end'] as const

/**
 * How an unopened streaming Think row shows live reasoning.
 * `prefix` shows the start of the current blank-line paragraph; `follow-end`
 * pins the latest line to the inline end.
 */
export type CollapsedThinkPreview = typeof COLLAPSED_THINK_PREVIEW_MODES[number]

/** Default keeps the collapsed streaming summary readable at the paragraph start. */
export const DEFAULT_COLLAPSED_THINK_PREVIEW: CollapsedThinkPreview = 'prefix'

/** Durable conversation section shared by the Host schema and the browser scope. */
export interface ConversationSettings {
  /** Delivery mode for plain Enter while the addressed agent is busy. */
  busyEnter: BusyEnterBehavior
  /** Collapsed Think summary while the reasoning block is the streaming tail. */
  collapsedThinkPreview: CollapsedThinkPreview
}

/** Durable conversation schema; also the wire envelope the browser scope validates against. */
export const ConversationSettingsSchema: z<ConversationSettings> = z.object({
  [BUSY_ENTER_FIELD]: z.union([...BUSY_ENTER_BEHAVIORS]).default(DEFAULT_BUSY_ENTER_BEHAVIOR),
  [COLLAPSED_THINK_PREVIEW_FIELD]: z.union([...COLLAPSED_THINK_PREVIEW_MODES])
    .default(DEFAULT_COLLAPSED_THINK_PREVIEW),
})
