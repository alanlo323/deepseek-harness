/**
 * Worker boot: parse Config from the environment and run the child loop.
 * @module @deepseek-ai/dsh-browser-playwright/boot
 */

import { resolvePlaywrightConfig } from './config.ts'
import { runChildMain, type ChildStdio } from './child-main.ts'
import type { PlaywrightLike } from './session-engine.ts'

/**
 * Start the engine child from process environment.
 * @param env - process env carrying `DSH_BROWSER_PLAYWRIGHT_CONFIG`.
 * @param stdio - stdin/stdout.
 * @param playwright - Playwright module or test fake.
 * @returns when stdin closes.
 */
export function bootWorker(
  env: NodeJS.ProcessEnv,
  stdio: ChildStdio,
  playwright: PlaywrightLike,
): Promise<void> {
  const configJson = env['DSH_BROWSER_PLAYWRIGHT_CONFIG']
  if (configJson === undefined) {
    throw new Error('dsh-browser-playwright: worker started without DSH_BROWSER_PLAYWRIGHT_CONFIG')
  }
  const config = resolvePlaywrightConfig(JSON.parse(configJson) as Parameters<typeof resolvePlaywrightConfig>[0])
  return runChildMain(stdio, playwright, config)
}
