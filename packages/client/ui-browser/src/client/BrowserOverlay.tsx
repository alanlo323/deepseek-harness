/** Watch-only enlarged Browser Session overlay. */
import { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './BrowserPanel.module.css'
import type { BrowserView } from './view.ts'

/** Overlay inject face. */
export interface BrowserOverlayInjected {
  view: BrowserView
}

export type BrowserOverlayProps =
  & PropsRuntime<'shell.overlay'>
  & InjectFace<BrowserOverlayInjected>
  & PropsLocale<'browser'>

/**
 * Frame-wide enlarge layer. Hidden while the enlarge flag is off.
 */
export function BrowserOverlay({ view, t }: BrowserOverlayProps) {
  const [, tick] = useState(0)
  useEffect(() => view.subscribe(() => { tick(n => n + 1) }), [view])
  if (!view.enlarged) return null
  const current = view.frame
  const src = current === undefined ? undefined : `data:${current.mime};base64,${current.dataBase64}`
  return (
    <div className={css.overlay}>
      <div className={css.header}>
        <div className={css.title}>{t('title')}</div>
        <button type="button" onClick={() => { view.setEnlarged(false) }}>{t('shrink')}</button>
      </div>
      <div className={css.overlayFrame}>
        {src === undefined
          ? <div className={css.empty}>{t('empty')}</div>
          : <img className={css.overlayImage} src={src} alt="" />}
      </div>
    </div>
  )
}
