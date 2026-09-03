/** Watch-only Browser Session viewport column. */
import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ScreencastFrame } from '@deepseek-ai/dsh-browser-host/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import css from './BrowserPanel.module.css'
import type { BrowserView } from './view.ts'

/** Layout and screencast actions injected by the plugin apply. */
export interface BrowserPanelInjected {
  openBrowser: () => void
  closeBrowser: () => void
  subscribeScreencast: (
    browserSessionId: string,
    signal: AbortSignal,
  ) => AsyncIterable<ScreencastFrame>
  view: BrowserView
}

export type BrowserPanelProps =
  & PropsRuntime<'browser'>
  & InjectFace<BrowserPanelInjected>
  & PropsLocale<'browser'>

/**
 * Session-scoped watch-only preview. Auto-opens the layout panel on the
 * non-open → open status edge and when this occupant mounts onto an already
 * open snapshot. Dismiss closes the panel only.
 */
export function BrowserPanel({
  sessionId,
  useProjection,
  openBrowser,
  closeBrowser,
  subscribeScreencast,
  view,
  t,
}: BrowserPanelProps) {
  const snapshot = useProjection('browserSession')
  const status = snapshot?.status
  const browserSessionId = snapshot?.browserSessionId
  const bound = snapshot?.dshSessionId === sessionId && status === 'open'
  const lastStatus = useRef<typeof status>(undefined)
  const [frame, setFrame] = useState<ScreencastFrame | undefined>(undefined)
  const [, tick] = useState(0)

  useEffect(() => view.subscribe(() => { tick(n => n + 1) }), [view])

  useEffect(() => () => {
    view.setEnlarged(false)
    view.setFrame(undefined)
  }, [view])

  useEffect(() => {
    if (view.frame !== undefined && view.frame.dshSessionId !== sessionId) {
      view.setFrame(undefined)
      view.setEnlarged(false)
    }
  }, [sessionId, view])

  useEffect(() => {
    const previous = lastStatus.current
    lastStatus.current = status
    if (status === 'open' && previous !== 'open') {
      openBrowser()
    }
  }, [status, openBrowser])

  useEffect(() => {
    if (!bound || browserSessionId === undefined) return
    const ac = new AbortController()
    void (async () => {
      try {
        for await (const next of subscribeScreencast(browserSessionId, ac.signal)) {
          if (next.dshSessionId !== sessionId) continue
          view.setFrame(next)
          setFrame(next)
        }
      } catch {
        // Host closed the session or the Remote dropped; keep the last frame.
      }
    })()
    return () => { ac.abort() }
  }, [bound, browserSessionId, sessionId, subscribeScreencast, view])

  const src = frame === undefined ? undefined : `data:${frame.mime};base64,${frame.dataBase64}`

  return (
    <div className={css.panel}>
      <div className={css.header}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.actions}>
          <button type="button" onClick={() => { view.setEnlarged(true) }}>{t('enlarge')}</button>
          <button type="button" onClick={() => { closeBrowser() }}>{t('dismiss')}</button>
        </div>
      </div>
      <div className={css.frame}>
        {src === undefined
          ? <div className={css.empty}>{t('empty')}</div>
          : (
            <button type="button" className={css.enlargeHit} onClick={() => { view.setEnlarged(true) }} aria-label={t('enlarge')}>
              <img className={css.image} src={src} alt="" />
            </button>
          )}
      </div>
    </div>
  )
}
