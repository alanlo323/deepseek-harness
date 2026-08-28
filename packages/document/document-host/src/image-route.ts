/**
 * Authenticated Fetch route for workspace images named by a submitted document.
 * @module @deepseek-ai/dsh-document-host/image-route
 */

import type { Session } from '@deepseek-ai/dsh-session'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import {
  ContainedReadError,
  SUBMITTED_DOCUMENT_MAX_IMAGE_EDGE,
  mediaTypeForLogicalPath,
  normalizeLogicalPath,
  rasterImagePixelSize,
  readContainedImage,
  sniffRasterImageMediaType,
} from '@deepseek-ai/dsh-document-core'

/** Stable browser image path on the shared `/api` channel. */
export const SUBMITTED_DOCUMENT_IMAGE_PATH = '/api/submitted-document-image'

/** Session store face used by the image route. */
export interface ImageRouteSessions {
  get(id: SessionId): Session | undefined
}

/** Host faces the image route reads. */
export interface ImageRouteDeps {
  readonly sessions: ImageRouteSessions
  readonly sessionProjections: SessionProjectionRegistry
}

/**
 * Handle one image GET/HEAD after Connection has authenticated the request.
 * @param deps - live sessions and the submitted-document projection.
 * @param request - authenticated Fetch request.
 * @returns 200 with the image bytes, or 400/404 when the image cannot be served.
 */
export async function submittedDocumentImageResponse(
  deps: ImageRouteDeps,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  const sessionIdValue = url.searchParams.get('sessionId')
  const documentCallId = url.searchParams.get('documentCallId')
  const imageRefValue = url.searchParams.get('imageRef')
  if (
    sessionIdValue === null || sessionIdValue.length === 0
    || documentCallId === null || documentCallId.length === 0
    || imageRefValue === null || imageRefValue.length === 0
  ) {
    return new Response('missing sessionId, documentCallId, or imageRef', { status: 400 })
  }
  let imageRef: string
  try {
    imageRef = normalizeLogicalPath(imageRefValue)
  } catch {
    return new Response('invalid imageRef', { status: 400 })
  }
  const session = deps.sessions.get(SessionId(sessionIdValue))
  if (session === undefined) return new Response('session not found', { status: 404 })
  const cwd = session.header.cwd
  if (cwd === undefined || cwd.trim() === '') {
    return new Response('session workspace cwd is required', { status: 404 })
  }
  const records = deps.sessionProjections.snapshot(session).values.submittedDocuments ?? []
  const record = records.find(item => item.callId === documentCallId)
  if (record === undefined) return new Response('document not found', { status: 404 })
  if (!record.images.some(image => image.ref === imageRef)) {
    return new Response('image is not part of this document', { status: 404 })
  }
  const declaredType = mediaTypeForLogicalPath(imageRef)
  if (declaredType === undefined) {
    return new Response('image type is not served', { status: 404 })
  }
  try {
    const bytes = await readContainedImage(cwd, imageRef)
    const sniffed = sniffRasterImageMediaType(bytes)
    if (sniffed === undefined || sniffed !== declaredType) {
      return new Response('image bytes do not match the declared type', { status: 404 })
    }
    const size = rasterImagePixelSize(bytes)
    if (
      size !== undefined
      && (size.width > SUBMITTED_DOCUMENT_MAX_IMAGE_EDGE || size.height > SUBMITTED_DOCUMENT_MAX_IMAGE_EDGE)
    ) {
      return new Response('image exceeds the pixel-edge cap', { status: 404 })
    }
    const headers = {
      'content-type': sniffed,
      'cache-control': 'private, max-age=0',
      'x-content-type-options': 'nosniff',
    }
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
    return new Response(Uint8Array.from(bytes), { status: 200, headers })
  } catch (error: unknown) {
    if (error instanceof ContainedReadError && error.code === 'escape') {
      return new Response('image is outside the session workspace', { status: 404 })
    }
    return new Response('image not readable', { status: 404 })
  }
}
