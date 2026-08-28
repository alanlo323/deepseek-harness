import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import DocumentHost from '../src/index.ts'

let root: string | undefined
const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

const FakeConnection = {
  name: 'fake-connection',
  apply(ctx: Context): void {
    ctx.provide('connection', {
      fetch: { register: () => async () => {} },
    })
  },
}

describe('document-host through a real Loader composition', () => {
  it('registers the projection and Remote read from a cordis.yml row', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-document-host-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-session'",
      "- name: '@deepseek-ai/dsh-session-projection'",
      "- name: 'fake-connection'",
      "- name: '@deepseek-ai/dsh-document-host'",
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
      ['fake-connection', FakeConnection],
      ['@deepseek-ai/dsh-document-host', DocumentHost],
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
    expect(ctx.documentHost.typertRemote.namespace).toBe('submittedDocument')
    expect(remoteMethods(ctx.documentHost).map(marker => marker.method)).toEqual(['read'])
    const session = ctx.sessions.create(SessionId('loader-doc'))
    expect(ctx.sessionProjections.snapshot(session).values.submittedDocuments).toEqual([])
  })
})
