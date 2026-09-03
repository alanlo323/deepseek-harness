import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { BrowserRuntime, type BrowserProvider } from '@deepseek-ai/dsh-browser'
import BrowserHost from '../src/index.ts'

let root: string | undefined
const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

const FakeBrowserProvider = {
  name: 'fake-browser-provider',
  inject: ['browser'],
  apply(ctx: Context): void {
    const provider: BrowserProvider = {
      id: 'fake',
      open: vi.fn(async () => {}),
      run: vi.fn(async () => ({ ok: true })),
      close: vi.fn(async () => {}),
      subscribeFrames: vi.fn(() => () => {}),
      subscribeDropped: vi.fn(() => () => {}),
    }
    ctx.browser.registerProvider(provider)
  },
}

describe('browser-host through a real Loader composition', () => {
  it('registers the projection and screencast Remote from a cordis.yml row', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-browser-host-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-session'",
      "- name: '@deepseek-ai/dsh-session-projection'",
      "- name: '@deepseek-ai/dsh-browser'",
      "- name: 'fake-browser-provider'",
      "- name: '@deepseek-ai/dsh-browser-host'",
      '',
    ].join('\n'), 'utf8')
    const ctx = new Context()
    contexts.push(ctx)
    ctx.baseUrl = `${pathToFileURL(root).href}/`
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-session', SessionStore],
      ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
      ['@deepseek-ai/dsh-browser', BrowserRuntime],
      ['fake-browser-provider', FakeBrowserProvider],
      ['@deepseek-ai/dsh-browser-host', BrowserHost],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await ctx.loader.await()
    expect(ctx.browserHost.typertRemote.namespace).toBe('browser')
    expect(remoteMethods(ctx.browserHost).map(marker => marker.method)).toEqual(['screencast'])
    const session = ctx.sessions.create(SessionId('loader-browser'))
    expect(ctx.sessionProjections.snapshot(session).values.browserSession).toBeNull()
  })
})
