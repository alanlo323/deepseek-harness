/**
 * Newline-delimited JSON protocol between the Host provider and the engine child.
 * Isolation of this child is not a security boundary.
 * @module @deepseek-ai/dsh-browser-playwright/protocol
 */

import type { JsonValue } from '@deepseek-ai/dsh-util-values'

/** Host → child command. */
export type HostToChild =
  | { readonly type: 'open'; readonly id: string }
  | { readonly type: 'run'; readonly id: string; readonly script: string }
  | { readonly type: 'close'; readonly id: string }
  | { readonly type: 'abort'; readonly id: string }

/** Child → host event. */
export type ChildToHost =
  | { readonly type: 'ok'; readonly id: string; readonly result?: JsonValue }
  | { readonly type: 'error'; readonly id: string; readonly code: string; readonly message: string }
  | {
    readonly type: 'frame'
    readonly mime: 'image/jpeg'
    readonly dataBase64: string
    readonly timestamp: number
  }
  | { readonly type: 'dropped' }

/**
 * Parse one protocol line.
 * @param line - one JSON object.
 * @returns the message, or `undefined` when the line is empty or not JSON.
 */
export function parseProtocolLine(line: string): unknown {
  if (line.length === 0) return undefined
  try {
    return JSON.parse(line) as unknown
  } catch {
    // Non-JSON stdout (Playwright banners, torn writes) must not crash the Host.
    return undefined
  }
}

/**
 * Encode one protocol message as a newline-terminated JSON line.
 * @param message - protocol object.
 * @returns the wire line including the trailing newline.
 */
export function encodeProtocolLine(message: HostToChild | ChildToHost): string {
  return `${JSON.stringify(message)}\n`
}
