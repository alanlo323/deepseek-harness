/**
 * Browser Session viewport plugin: watch-only column and enlarge overlay.
 * @module @deepseek-ai/dsh-client-ui-browser/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-browser-host/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { BrowserOverlay, type BrowserOverlayInjected } from './BrowserOverlay.tsx'
import { BrowserPanel, type BrowserPanelInjected } from './BrowserPanel.tsx'
import { createBrowserView } from './view.ts'
import { en, NS, zh, zhHant, type BrowserKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Browser viewport column and enlarge overlay. */
    browser: BrowserKey
  }
}

export type { BrowserKey } from './locales.ts'
export type { BrowserPanelInjected } from './BrowserPanel.tsx'
export type { BrowserOverlayInjected } from './BrowserOverlay.tsx'

/** Required services: slots, locale, layout, and the browser Remote. */
export const inject = ['slots', 'locale', 'layout', 'remote', 'remote.browser']

/**
 * Client plugin body: viewport column and enlarge overlay.
 * @param ctx - client root context.
 * @returns nothing; slot registrations are effects on `ctx`.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, 'zh-Hant': zhHant }), 'ui-browser: dictionaries')
  const t = ctx.locale.bind(NS)
  const view = createBrowserView()

  ctx.slots.inject('browser', () => ctx.slots.register({
    name: 'browser',
    locale: NS,
    inject: (_sessionId: SessionId): BrowserPanelInjected => ({
      openBrowser: () => { ctx.layout.openBrowser() },
      closeBrowser: () => { ctx.layout.closeBrowser() },
      subscribeScreencast: (browserSessionId, signal) => ctx.remote.browser.screencast(
        { sessionId: _sessionId, browserSessionId },
        signal,
      ),
      view,
    }),
  }, BrowserPanel))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'browser-enlarged',
    locale: NS,
    label: () => t('title'),
    inject: (): BrowserOverlayInjected => ({ view }),
  }, BrowserOverlay))
}
