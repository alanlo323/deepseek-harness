/**
 * Real Loader-path guard for an injected namespace plugin. A default export
 * would make `unwrapExports` collapse the namespace and drop `inject`.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { BrowserRuntime, type BrowserProvider } from '@deepseek-ai/dsh-browser'
import * as toolBrowser from '../src/index.ts'

const fakeProvider: BrowserProvider = {
  id: 'fake',
  open: async () => {},
  run: async () => null,
  close: async () => {},
  subscribeFrames: () => () => {},
  subscribeDropped: () => () => {},
}

describe('dsh-tool-browser real-load-path guard', () => {
  it('has no default export and keeps name/inject through unwrapExports', () => {
    expect('default' in toolBrowser).toBe(false)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(toolBrowser) as Record<string, unknown>
    expect(unwrapped).toBe(toolBrowser)
    expect(unwrapped.name).toBe('tool-browser')
    expect(unwrapped.inject).toEqual(['tools', 'browser', 'systemPrompt'])
    expect(typeof unwrapped.apply).toBe('function')
  })

  it('boots over ctx.browser through the unwrapped module without an inject error', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(BrowserRuntime)
    ctx.browser.registerProvider(fakeProvider)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(toolBrowser) as Parameters<Context['plugin']>[0]
    const fiber = await ctx.plugin(unwrapped)
    expect(ctx.tools.schemas().map(schema => schema.name)).toEqual(
      expect.arrayContaining(['browser_open', 'browser_run', 'browser_close']),
    )
    await fiber.dispose()
  })
})
