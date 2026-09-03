/**
 * In-plugin enlarge flag and latest JPEG frame shared by the column and overlay.
 * Not layout geometry and not a session-log payload.
 */

import type { ScreencastFrame } from '@deepseek-ai/dsh-browser-host/client'

type Listener = () => void

/** Mutable enlarge flag and latest frame with subscribe. */
export interface BrowserView {
  readonly enlarged: boolean
  readonly frame: ScreencastFrame | undefined
  setEnlarged(enlarged: boolean): void
  setFrame(frame: ScreencastFrame | undefined): void
  subscribe(listener: Listener): () => void
}

/**
 * Create the enlarge-flag handle used by both slot occupants.
 * @returns a subscribe-able enlarge flag and latest frame.
 */
export function createBrowserView(): BrowserView {
  let enlarged = false
  let frame: ScreencastFrame | undefined
  const listeners = new Set<Listener>()
  const notify = (): void => { for (const listener of listeners) listener() }
  return {
    get enlarged() { return enlarged },
    get frame() { return frame },
    setEnlarged(next: boolean) {
      if (enlarged === next) return
      enlarged = next
      notify()
    },
    setFrame(next: ScreencastFrame | undefined) {
      frame = next
      notify()
    },
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
