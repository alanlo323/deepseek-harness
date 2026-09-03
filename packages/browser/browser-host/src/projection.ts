/**
 * Host projection of browser tool `presentationMeta` snapshots.
 * @module @deepseek-ai/dsh-browser-host/projection
 */

import { z } from 'zod'
import type { ZodType } from 'zod'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { parseBrowserSessionMeta } from '@deepseek-ai/dsh-browser'
import type { BrowserSessionView } from './types.ts'

const browserSessionSchema: ZodType<BrowserSessionView | null> = z.union([
  z.object({
    browserSessionId: z.string().min(1),
    dshSessionId: z.string().min(1),
    status: z.union([z.literal('open'), z.literal('closed')]),
  }),
  z.null(),
])

/**
 * Fold one event into the Browser Session snapshot. Frames never enter.
 * @param state - snapshot so far.
 * @param event - committed session event.
 * @returns the next snapshot, or the same reference when the event is irrelevant.
 */
export function applyBrowserSession(
  state: BrowserSessionView | null,
  event: SessionEvent,
): BrowserSessionView | null {
  if (event.type !== 'tool/result') return state
  const meta = parseBrowserSessionMeta(event.data.meta)
  if (meta === undefined) return state
  return {
    browserSessionId: meta.browserSessionId,
    dshSessionId: meta.dshSessionId,
    status: meta.status,
  }
}

/** Projection unit registered by browser-host. */
export const browserSessionProjectionDefinition = {
  key: 'browserSession',
  stateSchema: browserSessionSchema,
  init: () => null,
  apply: applyBrowserSession,
  wire: { viewSchema: browserSessionSchema, view: state => state },
  stateVersion: 1,
} satisfies ProjectionDefinition<'browserSession', BrowserSessionView | null>
