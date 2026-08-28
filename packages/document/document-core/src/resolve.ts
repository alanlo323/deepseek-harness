/**
 * Containment-checked reads of workspace files for submitted documents.
 * Every live and image read re-resolves; a post-submit symlink swap cannot reuse a prior real path.
 * @module @deepseek-ai/dsh-document-core/resolve
 */

import { readFile, realpath, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { canonicalPath } from '@deepseek-ai/dsh-sandbox'
import { isPathUnder } from '@deepseek-ai/dsh-fs-sandbox'
import { LogicalPathError, normalizeLogicalPath } from './path.ts'
import {
  SUBMITTED_DOCUMENT_MAX_FILE_BYTES,
  SUBMITTED_DOCUMENT_MAX_IMAGE_BYTES,
} from './constants.ts'

/** Why a contained read failed after the logical path was accepted. */
export type ContainedReadFailure = 'missing-cwd' | 'not-found' | 'escape' | 'too-large' | 'not-file'

/** A contained workspace read that did not yield a file. */
export class ContainedReadError extends Error {
  /** Stable failure identity for this contained read. */
  readonly code: ContainedReadFailure

  /**
   * @param code - stable failure identity.
   * @param message - caller-facing reason.
   */
  constructor(code: ContainedReadFailure, message: string) {
    super(message)
    this.name = 'ContainedReadError'
    this.code = code
  }
}

/**
 * Resolve a workspace-relative logical path to a real file that still lies under `cwd`.
 * @param cwd - session workspace root; required.
 * @param logicalPath - already-normalized or raw model path.
 * @returns the real path of the existing file.
 */
export async function resolveContainedFile(cwd: string | undefined, logicalPath: string): Promise<string> {
  if (cwd === undefined || cwd.trim() === '') {
    throw new ContainedReadError('missing-cwd', 'session workspace cwd is required')
  }
  const logical = normalizeLogicalPath(logicalPath)
  let realRoot: string
  try {
    realRoot = await realpath(cwd)
  } catch {
    throw new ContainedReadError('missing-cwd', 'session workspace cwd is not a readable directory')
  }
  const candidate = join(realRoot, ...logical.split('/'))
  let realTarget: string
  try {
    realTarget = await realpath(candidate)
  } catch {
    throw new ContainedReadError('not-found', `file not found: ${logical}`)
  }
  const canonRoot = canonicalPath(realRoot)
  const canonTarget = canonicalPath(realTarget)
  if (!(await isPathUnder(canonTarget, canonRoot))) {
    throw new ContainedReadError('escape', 'path resolves outside the session workspace')
  }
  const info = await stat(realTarget)
  if (!info.isFile()) {
    throw new ContainedReadError('not-file', `path is not a file: ${logical}`)
  }
  return realTarget
}

async function readContainedBytes(
  cwd: string | undefined,
  logicalPath: string,
  maxBytes: number,
): Promise<Buffer> {
  const realTarget = await resolveContainedFile(cwd, logicalPath)
  const bytes = await readFile(realTarget)
  if (bytes.byteLength > maxBytes) {
    throw new ContainedReadError(
      'too-large',
      `file exceeds the ${String(maxBytes)}-byte read limit`,
    )
  }
  return bytes
}

/**
 * Read a Markdown file as UTF-8 after a fresh containment check.
 * @param cwd - session workspace root.
 * @param logicalPath - workspace-relative path.
 * @param maxBytes - complete-result byte cap; defaults to the submitted-document file cap.
 * @returns UTF-8 text and the file's byte length.
 */
export async function readContainedUtf8(
  cwd: string | undefined,
  logicalPath: string,
  maxBytes = SUBMITTED_DOCUMENT_MAX_FILE_BYTES,
): Promise<{ readonly text: string; readonly byteLength: number }> {
  const bytes = await readContainedBytes(cwd, logicalPath, maxBytes)
  return { text: bytes.toString('utf8'), byteLength: bytes.byteLength }
}

/**
 * Read a workspace image after a fresh containment check.
 * @param cwd - session workspace root.
 * @param logicalPath - workspace-relative image path.
 * @param maxBytes - complete-result byte cap; defaults to the submitted-document image cap.
 * @returns the file bytes when the path is a contained regular file.
 */
export async function readContainedImage(
  cwd: string | undefined,
  logicalPath: string,
  maxBytes = SUBMITTED_DOCUMENT_MAX_IMAGE_BYTES,
): Promise<Buffer> {
  return await readContainedBytes(cwd, logicalPath, maxBytes)
}

export { LogicalPathError }
