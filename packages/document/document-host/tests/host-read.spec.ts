import { mkdtemp, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { SUBMITTED_DOCUMENT_KIND } from '@deepseek-ai/dsh-document-core'
import DocumentHost from '../src/index.ts'

function connectionStub() {
  const registered: Array<(request: Request) => Promise<Response>> = []
  return {
    fetch: {
      register: (route: { fetch: (request: Request) => Promise<Response> }) => {
        registered.push(route.fetch)
        return async () => {}
      },
    },
    registered,
  }
}

async function harness(cwd?: string) {
  const ctx = new Context()
  const connection = connectionStub()
  ctx.provide('connection', connection)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(DocumentHost)
  const session = ctx.sessions.create(SessionId('s1'), cwd === undefined ? undefined : { meta: { cwd } })
  return { ctx, session, connection }
}

describe('DocumentHost.read', () => {
  it('prefers a live workspace read and falls back to the submit-time snapshot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-host-'))
    await writeFile(join(root, 'report.md'), '# Live\n\nlive body\n', 'utf8')
    const { ctx, session, connection } = await harness(root)
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: ToolCallId('c1'),
      name: 'present_document',
      arguments: '{"path":"report.md"}',
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: ToolCallId('c1'),
        content: [{ type: 'text', text: 'presented' }],
        isError: false,
      }),
      meta: {
        kind: SUBMITTED_DOCUMENT_KIND,
        title: 'Report',
        logicalPath: 'report.md',
        byteLength: 12,
        images: [],
        truncated: false,
        content: '# Snapshot\n',
      },
    }, { surfaceOp: 'append' })

    const live = await ctx.documentHost.read({ sessionId: session.id, documentCallId: 'c1' })
    expect(live).toMatchObject({
      ok: true,
      value: { source: 'live', markdown: '# Live\n\nlive body\n', title: 'Report' },
    })

    await unlink(join(root, 'report.md'))
    const snapshot = await ctx.documentHost.read({ sessionId: session.id, documentCallId: 'c1' })
    expect(snapshot).toMatchObject({
      ok: true,
      value: { source: 'snapshot', markdown: '# Snapshot\n' },
    })

    const missing = await ctx.documentHost.read({
      sessionId: SessionId('missing'),
      documentCallId: 'c1',
    })
    expect(missing).toEqual({ ok: false, error: { code: 'session-not-found' } })

    const unknownCall = await ctx.documentHost.read({
      sessionId: session.id,
      documentCallId: 'nope',
    })
    expect(unknownCall).toEqual({ ok: false, error: { code: 'document-not-found' } })

    const image = await connection.registered[0]!((
      new Request('http://host/api/submitted-document-image?sessionId=s1&documentCallId=c1&imageRef=missing.png')
    ))
    expect(image.status).toBeGreaterThanOrEqual(400)
  })

  it('falls back to the snapshot when the live file is an escaping symlink', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-host-'))
    const outside = await mkdtemp(join(tmpdir(), 'dsh-doc-host-out-'))
    await writeFile(join(outside, 'secret.md'), 'secret\n', 'utf8')
    try {
      const { symlink } = await import('node:fs/promises')
      await symlink(join(outside, 'secret.md'), join(root, 'report.md'))
    } catch {
      return
    }
    const { ctx, session } = await harness(root)
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: ToolCallId('c1'),
      name: 'present_document',
      arguments: '{"path":"report.md"}',
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: ToolCallId('c1'),
        content: [{ type: 'text', text: 'presented' }],
        isError: false,
      }),
      meta: {
        kind: SUBMITTED_DOCUMENT_KIND,
        title: 'Report',
        logicalPath: 'report.md',
        byteLength: 12,
        images: [],
        truncated: false,
        content: '# Snapshot\n',
      },
    }, { surfaceOp: 'append' })
    const result = await ctx.documentHost.read({ sessionId: session.id, documentCallId: 'c1' })
    expect(result).toMatchObject({
      ok: true,
      value: { source: 'snapshot', markdown: '# Snapshot\n' },
    })
  })

  it('returns missing-cwd when the header has no workspace and no snapshot body', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: ToolCallId('c1'),
      name: 'present_document',
      arguments: '{"path":"report.md"}',
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: ToolCallId('c1'),
        content: [{ type: 'text', text: 'presented' }],
        isError: false,
      }),
      meta: {
        kind: SUBMITTED_DOCUMENT_KIND,
        title: 'Report',
        logicalPath: 'report.md',
        byteLength: 1,
        images: [],
        truncated: true,
      },
    }, { surfaceOp: 'append' })
    const result = await ctx.documentHost.read({ sessionId: session.id, documentCallId: 'c1' })
    expect(result).toEqual({ ok: false, error: { code: 'missing-cwd' } })
  })

  it('returns the snapshot when cwd is missing but the submit-time body exists', async () => {
    const { ctx, session } = await harness()
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: ToolCallId('c1'),
      name: 'present_document',
      arguments: '{"path":"report.md"}',
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: ToolCallId('c1'),
        content: [{ type: 'text', text: 'presented' }],
        isError: false,
      }),
      meta: {
        kind: SUBMITTED_DOCUMENT_KIND,
        title: 'Report',
        logicalPath: 'report.md',
        byteLength: 12,
        images: [],
        truncated: false,
        content: '# Snapshot\n',
      },
    }, { surfaceOp: 'append' })
    const result = await ctx.documentHost.read({ sessionId: session.id, documentCallId: 'c1' })
    expect(result).toMatchObject({
      ok: true,
      value: { source: 'snapshot', markdown: '# Snapshot\n' },
    })
  })

  it('returns document-not-found and unreadable when the call or file is gone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-host-gone-'))
    const { ctx, session } = await harness(root)
    expect(await ctx.documentHost.read({
      sessionId: session.id,
      documentCallId: 'missing',
    })).toEqual({ ok: false, error: { code: 'document-not-found' } })

    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: ToolCallId('c1'),
      name: 'present_document',
      arguments: '{"path":"gone.md"}',
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: ToolCallId('c1'),
        content: [{ type: 'text', text: 'presented' }],
        isError: false,
      }),
      meta: {
        kind: SUBMITTED_DOCUMENT_KIND,
        title: 'Gone',
        logicalPath: 'gone.md',
        byteLength: 1,
        images: [],
        truncated: true,
      },
    }, { surfaceOp: 'append' })
    expect(await ctx.documentHost.read({
      sessionId: session.id,
      documentCallId: 'c1',
    })).toEqual({ ok: false, error: { code: 'unreadable' } })
  })

  it('drops the projection when the service fiber is disposed', async () => {
    const ctx = new Context()
    ctx.provide('connection', connectionStub())
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    const fiber = ctx.plugin(DocumentHost)
    await fiber.await()
    const session = ctx.sessions.create(SessionId('s-hmr'))
    expect(ctx.sessionProjections.snapshot(session).values.submittedDocuments).toEqual([])
    await fiber.dispose()
    expect(ctx.sessionProjections.snapshot(session).values.submittedDocuments).toBeUndefined()
  })
})
