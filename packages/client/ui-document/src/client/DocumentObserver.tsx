/** Always-mounted observer that opens the Report view on live presents. */
import { useEffect } from 'react'
import type { ConversationSessionLiveOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'

/** Injected live-append watcher closed over the current Session binding. */
export interface DocumentObserverInjected {
  /** Subscribe for successful present_document appends after hydrate. */
  watchAppendedPresents: (onPresent: (callId: string) => void) => () => void
}

type DocumentObserverProps = ConversationSessionLiveOwnerProps
  & InjectFace<DocumentObserverInjected>

/**
 * Opens the Report view exactly once per live successful present after hydrate.
 * @param props - View navigation and the append watcher.
 * @returns nothing; this entry has no chrome.
 */
export function DocumentObserver({ openView, watchAppendedPresents }: DocumentObserverProps) {
  useEffect(
    () => watchAppendedPresents((callId) => { openView('document', callId) }),
    [openView, watchAppendedPresents],
  )
  return null
}
