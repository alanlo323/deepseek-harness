/** Keyed present_document tool card that opens the Report view. */
import { IconBrowseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { parseClientSubmittedDocumentMeta } from './meta.ts'
import css from './DocumentView.module.css'

type PresentDocumentCardProps = ToolCallViewProps & PropsLocale<'document'>

function argsRawOf(block: ToolCallBlock): string {
  return 'kind' in block ? (block.call?.argsRaw ?? '') : block.argsRaw
}

function pathFromArgs(raw: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const path = (parsed as { path?: unknown }).path
    return typeof path === 'string' ? path : undefined
  } catch {
    return undefined
  }
}

/**
 * Compact present_document row with a Report-view opener after a successful call.
 * @param props - tool-card owner share plus this plugin's locale seat.
 * @returns the card chrome; the opener appears only after a successful result.
 */
export function PresentDocumentCard({
  callId, block, openView, t,
}: PresentDocumentCardProps) {
  const meta = 'kind' in block ? parseClientSubmittedDocumentMeta(block.meta) : undefined
  const summary = meta?.logicalPath ?? pathFromArgs(argsRawOf(block)) ?? callId
  const settledOk = 'kind' in block && !block.isError
  return (
    <div className={css.card}>
      <span className={css.cardTitle}>
        <IconBrowseOutline16 size={14} />
        {' '}
        {t('card.title')}
      </span>
      <span className={css.cardSummary}>{summary}</span>
      {settledOk && (
        <button type="button" className={css.open} onClick={() => { openView?.('document', callId) }}>
          {t('card.open')}
        </button>
      )}
    </div>
  )
}
