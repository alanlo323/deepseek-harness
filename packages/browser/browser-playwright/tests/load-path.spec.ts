/**
 * Real Loader-path guard: a default export would drop `inject`/`Config`.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { BrowserRuntime } from '@deepseek-ai/dsh-browser'
import * as playwrightProvider from '../src/index.ts'

describe('dsh-browser-playwright real-load-path guard', () => {
  it('has no default export and keeps name/inject/Config through unwrapExports', () => {
    expect('default' in playwrightProvider).toBe(false)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(playwrightProvider) as Record<string, unknown>
    expect(unwrapped).toBe(playwrightProvider)
    expect(unwrapped.name).toBe('browser-playwright')
    expect(unwrapped.inject).toEqual(['browser'])
    expect(typeof unwrapped.apply).toBe('function')
    expect(unwrapped.Config).toBeDefined()
  })

  it('registers the provider through the unwrapped module', async () => {
    const ctx = new Context()
    await ctx.plugin(BrowserRuntime)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(playwrightProvider) as Parameters<Context['plugin']>[0]
    const fiber = await ctx.plugin(unwrapped, {
      screencastFps: 10,
      screencastQuality: 50,
      maxWallMs: 1000,
      maxResultBytes: 64,
    })
    expect(() => {
      (unwrapped as { apply: (context: Context, config: object) => void }).apply(ctx, {
        screencastFps: 10,
        screencastQuality: 50,
        maxWallMs: 1000,
        maxResultBytes: 64,
      })
    }).toThrow(/already registered/)
    await fiber.dispose()
  })
})
