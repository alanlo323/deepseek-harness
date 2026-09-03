/**
 * Playwright child-process provider for `ctx.browser`.
 * Isolation of the engine child is not a security boundary.
 * @module @deepseek-ai/dsh-browser-playwright
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-browser'
import { Config, resolvePlaywrightConfig } from './config.ts'
import { PlaywrightBrowserProvider } from './provider.ts'

export { Config, resolvePlaywrightConfig } from './config.ts'
export { PlaywrightBrowserProvider } from './provider.ts'
export { SessionEngine, serializeResult } from './session-engine.ts'
export type { PlaywrightLike } from './session-engine.ts'
export { resolveEngineWorker, sourceWorkerExecArgv } from './spawn.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'browser-playwright'

/** The Browser Session seam this provider registers into. */
export const inject = ['browser']

/**
 * Register the Playwright provider on `ctx.browser`.
 * @param ctx - host context carrying `ctx.browser`.
 * @param config - deployment Config.
 * @returns nothing; registration is an effect on `ctx.browser`.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolvePlaywrightConfig(config)
  ctx.browser.registerProvider(new PlaywrightBrowserProvider(resolved))
}
