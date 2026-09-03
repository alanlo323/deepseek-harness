/**
 * Playwright provider Config (every operational cap is a Config field).
 * @module @deepseek-ai/dsh-browser-playwright/config
 */

import z from '@deepseek-ai/schemastery'

/** Plugin config: screencast cadence, result cap, and optional Chromium path. */
export interface Config {
  /** Target screencast frames per second. */
  screencastFps?: number
  /** JPEG quality 0–100 for CDP screencast. */
  screencastQuality?: number
  /** Wall-clock ceiling in milliseconds for one `browser_run`. */
  maxWallMs?: number
  /** Inclusive UTF-8 byte cap of a JSON `browser_run` result; overflow fails. */
  maxResultBytes?: number
  /** Optional Chromium executable. Omitted uses Playwright's resolved binary. */
  executablePath?: string
}

export const Config: z<Config> = z.object({
  screencastFps: z.number().default(10),
  screencastQuality: z.number().default(50),
  maxWallMs: z.number().default(30_000),
  maxResultBytes: z.number().default(65_536),
  executablePath: z.string().required(false),
})

/** Config after schemastery fills every defaulted field. */
export type ResolvedPlaywrightConfig = {
  readonly screencastFps: number
  readonly screencastQuality: number
  readonly maxWallMs: number
  readonly maxResultBytes: number
  readonly executablePath?: string
}

/**
 * Validate resolved numeric caps.
 * @param config - filled Config object.
 * @returns the resolved config.
 */
export function resolvePlaywrightConfig(config: Config): ResolvedPlaywrightConfig {
  const resolved = config as Required<Pick<Config, 'screencastFps' | 'screencastQuality' | 'maxWallMs' | 'maxResultBytes'>> & Config
  assertIntegerInRange('screencastFps', resolved.screencastFps, 1, 30)
  assertIntegerInRange('screencastQuality', resolved.screencastQuality, 0, 100)
  assertIntegerInRange('maxWallMs', resolved.maxWallMs, 1, 2_147_483_647)
  assertIntegerInRange('maxResultBytes', resolved.maxResultBytes, 1, 16_777_216)
  return {
    screencastFps: resolved.screencastFps,
    screencastQuality: resolved.screencastQuality,
    maxWallMs: resolved.maxWallMs,
    maxResultBytes: resolved.maxResultBytes,
    ...resolved.executablePath !== undefined && resolved.executablePath.length > 0
      ? { executablePath: resolved.executablePath }
      : {},
  }
}

function assertIntegerInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`browser-playwright: ${name} must be an integer in [${String(min)}, ${String(max)}]`)
  }
}
