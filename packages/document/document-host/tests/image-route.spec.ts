import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import { SUBMITTED_DOCUMENT_MAX_IMAGE_EDGE } from '@deepseek-ai/dsh-document-core'
import {
  SUBMITTED_DOCUMENT_IMAGE_PATH,
  submittedDocumentImageResponse,
  type ImageRouteDeps,
} from '../src/image-route.ts'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

function deps(cwd: string | undefined, records: readonly {
  callId: string
  images: readonly { ref: string; mediaType: string }[]
}[]): ImageRouteDeps {
  const session = cwd === undefined
    ? undefined
    : Session.create(SessionId('s1'), undefined, {
      version: 0,
      id: SessionId('s1'),
      createdAt: 1,
      cwd,
    })
  return {
    sessions: {
      get: id => id === 's1' ? session : undefined,
    },
    sessionProjections: {
      snapshot: () => ({ values: { submittedDocuments: records } }),
    } as unknown as SessionProjectionRegistry,
  }
}

function imageRequest(
  params: Record<string, string>,
  method: 'GET' | 'HEAD' = 'GET',
): Request {
  const url = new URL(`http://host${SUBMITTED_DOCUMENT_IMAGE_PATH}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return new Request(url, { method })
}

describe('submittedDocumentImageResponse', () => {
  it('serves a contained PNG with nosniff and rejects mismatched or oversized bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-img-'))
    await writeFile(join(root, 'ok.png'), PNG_1X1)
    await writeFile(join(root, 'lie.png'), Buffer.from('<svg></svg>'))
    const huge = Buffer.from(PNG_1X1)
    huge.writeUInt32BE(SUBMITTED_DOCUMENT_MAX_IMAGE_EDGE + 1, 16)
    await writeFile(join(root, 'huge.png'), huge)
    const records = [{
      callId: 'c1',
      images: [
        { ref: 'ok.png', mediaType: 'image/png' },
        { ref: 'lie.png', mediaType: 'image/png' },
        { ref: 'huge.png', mediaType: 'image/png' },
        { ref: 'missing.png', mediaType: 'image/png' },
        { ref: 'note.svg', mediaType: 'image/svg+xml' },
      ],
    }]
    const route = deps(root, records)

    const ok = await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'c1', imageRef: 'ok.png',
    }))
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('image/png')
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await ok.arrayBuffer()).equals(PNG_1X1)).toBe(true)

    const head = await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'c1', imageRef: 'ok.png',
    }, 'HEAD'))
    expect(head.status).toBe(200)
    expect(head.body).toBeNull()

    expect((await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'c1', imageRef: 'lie.png',
    }))).status).toBe(404)
    expect((await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'c1', imageRef: 'huge.png',
    }))).status).toBe(404)
    expect((await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'c1', imageRef: 'missing.png',
    }))).status).toBe(404)
    expect((await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'c1', imageRef: 'other.png',
    }))).status).toBe(404)
    expect((await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 'missing', documentCallId: 'c1', imageRef: 'ok.png',
    }))).status).toBe(404)
    expect((await submittedDocumentImageResponse(route, imageRequest({
      documentCallId: 'c1', imageRef: 'ok.png',
    }))).status).toBe(400)
    expect((await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'c1', imageRef: '../ok.png',
    }))).status).toBe(400)
    expect((await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'missing', imageRef: 'ok.png',
    }))).status).toBe(404)
    expect((await submittedDocumentImageResponse(route, imageRequest({
      sessionId: 's1', documentCallId: 'c1', imageRef: 'note.svg',
    }))).status).toBe(404)
  })

  it('fails closed when the session has no cwd', async () => {
    const response = await submittedDocumentImageResponse(
      deps(undefined, [{ callId: 'c1', images: [{ ref: 'ok.png', mediaType: 'image/png' }] }]),
      imageRequest({ sessionId: 's1', documentCallId: 'c1', imageRef: 'ok.png' }),
    )
    expect(response.status).toBe(404)
  })

  it('fails closed when the session cwd is empty or the projection omits the document list', async () => {
    const emptyCwdDeps: ImageRouteDeps = {
      sessions: {
        get: id => id === 's1'
          ? { header: { cwd: '   ' } } as Session
          : undefined,
      },
      sessionProjections: {
        snapshot: () => ({ values: { submittedDocuments: [{ callId: 'c1', images: [{ ref: 'ok.png', mediaType: 'image/png' }] }] } }),
      } as unknown as SessionProjectionRegistry,
    }
    expect((await submittedDocumentImageResponse(
      emptyCwdDeps,
      imageRequest({ sessionId: 's1', documentCallId: 'c1', imageRef: 'ok.png' }),
    )).status).toBe(404)

    const omitted: ImageRouteDeps = {
      sessions: deps(tmpdir(), []).sessions,
      sessionProjections: {
        snapshot: () => ({ values: {} }),
      } as unknown as SessionProjectionRegistry,
    }
    expect((await submittedDocumentImageResponse(
      omitted,
      imageRequest({ sessionId: 's1', documentCallId: 'c1', imageRef: 'ok.png' }),
    )).status).toBe(404)
  })

  it('rejects an escaping symlink image', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-img-esc-'))
    const outside = await mkdtemp(join(tmpdir(), 'dsh-doc-img-out-'))
    await writeFile(join(outside, 'secret.png'), PNG_1X1)
    try {
      const { symlink } = await import('node:fs/promises')
      await symlink(join(outside, 'secret.png'), join(root, 'ok.png'))
    } catch {
      return
    }
    const response = await submittedDocumentImageResponse(
      deps(root, [{ callId: 'c1', images: [{ ref: 'ok.png', mediaType: 'image/png' }] }]),
      imageRequest({ sessionId: 's1', documentCallId: 'c1', imageRef: 'ok.png' }),
    )
    expect(response.status).toBe(404)
  })

  it('rejects a PNG whose height exceeds the pixel-edge cap', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-img-h-'))
    const tall = Buffer.from(PNG_1X1)
    tall.writeUInt32BE(1, 16)
    tall.writeUInt32BE(SUBMITTED_DOCUMENT_MAX_IMAGE_EDGE + 1, 20)
    await writeFile(join(root, 'tall.png'), tall)
    const response = await submittedDocumentImageResponse(
      deps(root, [{ callId: 'c1', images: [{ ref: 'tall.png', mediaType: 'image/png' }] }]),
      imageRequest({ sessionId: 's1', documentCallId: 'c1', imageRef: 'tall.png' }),
    )
    expect(response.status).toBe(404)
  })

  it('refuses a directory named like an image', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-img-dir-'))
    await mkdir(join(root, 'dir.png'))
    const response = await submittedDocumentImageResponse(
      deps(root, [{ callId: 'c1', images: [{ ref: 'dir.png', mediaType: 'image/png' }] }]),
      imageRequest({ sessionId: 's1', documentCallId: 'c1', imageRef: 'dir.png' }),
    )
    expect(response.status).toBe(404)
  })
})
