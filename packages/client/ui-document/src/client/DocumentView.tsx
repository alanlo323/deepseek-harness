/** Report conversation view: snapshot or live Markdown for one submitted document. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ReadSubmittedDocumentResult } from '@deepseek-ai/dsh-document-host/client'
import type { createDocumentViewStore } from './stores.ts'
import {
  latestDocument,
  type ClientSubmittedDocument,
} from './documents.ts'
import { clientJoinLogicalPath, clientLogicalDirectory } from './meta.ts'
import css from './DocumentView.module.css'

const IMAGE_PATH = '/api/submitted-document-image'

/** Session-bound document list and live read. */
export interface DocumentViewInjected {
  hooks: {
    documents: ObservableSnapshot<readonly ClientSubmittedDocument[]>
  }
  readLive: (documentCallId: string) => Promise<ReadSubmittedDocumentResult>
}

type DocumentViewProps = ConvViewProps
  & PropsStore<ReturnType<typeof createDocumentViewStore>>
  & InjectFace<DocumentViewInjected>
  & PropsLocale<'document'>

function imageUrl(sessionId: SessionId, documentCallId: string, imageRef: string): string {
  const params = new URLSearchParams({
    sessionId,
    documentCallId,
    imageRef,
  })
  return `${IMAGE_PATH}?${params.toString()}`
}

/**
 * Render the Report view for the selected successful present.
 * @param props - Conversation view owner, document store, and live read.
 * @returns the Report reader chrome and Markdown body.
 */
export function DocumentView({
  sessionId, viewRequest, completeViewRequest, useStore, actions, useDocuments, readLive, t,
}: DocumentViewProps) {
  const documents = useDocuments(value => value)
  const selectedCallId = useStore(s => s.selectedCallId)
  const source = useStore(s => s.source)
  const labels = useMemo((): MarkdownLabels => ({
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('footnotes'),
    imageFailed: t('imageFailed'),
  }), [t])

  useEffect(() => {
    if (viewRequest?.view !== 'document') return
    actions.selectCall(viewRequest.focus)
    completeViewRequest()
  }, [viewRequest, actions, completeViewRequest])

  const selected = useMemo(() => {
    if (documents.length === 0) return undefined
    const match = selectedCallId === null
      ? undefined
      : documents.find(item => item.callId === selectedCallId)
    return match ?? latestDocument(documents)
  }, [documents, selectedCallId])

  useEffect(() => {
    if (selected === undefined) return
    if (selectedCallId !== selected.callId) actions.fallbackSelected(selected.callId)
  }, [selected, selectedCallId, actions])

  const [live, setLive] = useState<{ callId: string; markdown: string } | null>(null)
  const [liveError, setLiveError] = useState(false)

  useEffect(() => {
    if (selected === undefined || source !== 'live') {
      setLive(null)
      setLiveError(false)
      return
    }
    const callId = selected.callId
    let cancelled = false
    void readLive(callId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setLive({ callId, markdown: result.value.markdown })
        setLiveError(false)
      } else {
        setLive(null)
        setLiveError(true)
      }
    }, () => {
      if (cancelled) return
      setLive(null)
      setLiveError(true)
    })
    return () => { cancelled = true }
  }, [selected, source, readLive])

  const resolveImageUrl = useCallback((src: string) => {
    /* v8 ignore next -- MarkdownText is unmounted while no document is selected */
    if (selected === undefined) return undefined
    const ref = clientJoinLogicalPath(clientLogicalDirectory(selected.logicalPath), src)
    if (ref === undefined) return undefined
    if (!selected.images.some(image => image.ref === ref)) return undefined
    return imageUrl(sessionId, selected.callId, ref)
  }, [selected, sessionId])

  if (selected === undefined) {
    return <div className={css.root}><p className={css.status}>{t('empty')}</p></div>
  }

  const snapshotMarkdown = selected.content
  const liveMarkdown = live?.callId === selected.callId ? live.markdown : undefined
  const markdown = source === 'live' ? liveMarkdown : snapshotMarkdown
  const truncatedNotice = source === 'snapshot' && selected.truncated && snapshotMarkdown === undefined

  return (
    <div className={css.root}>
      <div className={css.toolbar}>
        <select
          className={css.select}
          value={selected.callId}
          onChange={(event) => { actions.selectCall(event.target.value) }}
        >
          {documents.map(document => (
            <option key={document.callId} value={document.callId}>{document.title}</option>
          ))}
        </select>
        <div className={css.source}>
          <button
            type="button"
            data-active={source === 'snapshot' ? 'true' : undefined}
            onClick={() => { actions.setSource('snapshot') }}
          >
            {t('source.snapshot')}
          </button>
          <button
            type="button"
            data-active={source === 'live' ? 'true' : undefined}
            onClick={() => { actions.setSource('live') }}
          >
            {t('source.live')}
          </button>
        </div>
      </div>
      <div className={css.body}>
        {truncatedNotice && <p className={css.status}>{t('truncated')}</p>}
        {source === 'live' && liveError && <p className={css.status}>{t('missing')}</p>}
        {source === 'snapshot' && snapshotMarkdown === undefined && !selected.truncated && (
          <p className={css.status}>{t('missing')}</p>
        )}
        {markdown !== undefined && (
          <MarkdownText text={markdown} labels={labels} resolveImageUrl={resolveImageUrl} />
        )}
      </div>
    </div>
  )
}
