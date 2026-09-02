/** Assistant reasoning disclosure, independent of Tool-call presentation. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DisclosureRow, IconThinkOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CollapsedThinkPreview } from '../think-preview.ts'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import { useThrottledVisualUpdate } from './use-throttled-visual-update.ts'
import a11yCss from './accessibility.module.css'
import css from './ReasoningRow.module.css'

const BLANK_LINE = /\r?\n\r?\n/

/** Duration of one prefix paragraph-advance roll; CSS `transition` uses the same ms. */
export const PARAGRAPH_ADVANCE_MS = 500

function latestLine(text: string): string {
  const visible = text.trimEnd()
  const newline = visible.lastIndexOf('\n')
  return newline === -1 ? visible : visible.slice(newline + 1)
}

function latestParagraph(text: string): string {
  const parts = text.split(BLANK_LINE)
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const chunk = parts[index]
    if (chunk !== undefined && chunk.trim() !== '') return chunk
  }
  return text
}

/** 0-based index among non-empty blank-line segments; trailing empty chunks do not increment. */
function paragraphGeneration(text: string): number {
  let generation = -1
  for (const chunk of text.split(BLANK_LINE)) {
    if (chunk.trim() !== '') generation += 1
  }
  return generation < 0 ? 0 : generation
}

function streamingSummary(text: string, followEnd: boolean): string {
  return followEnd ? latestLine(text) : latestParagraph(text)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
}

interface PrefixAdvance {
  outgoing: string
  incoming: string
  incomingGeneration: number
}

/**
 * Collapsed prefix summary: one-line slot that rolls on blank-line generation change.
 * Unmounts with `collapsedContent` on expand so the commit timeout dies with the subtree.
 * @param props.text - complete or streaming reasoning text.
 * @param props.running - whether this block is the streaming tail.
 * @returns the prefix summary viewport.
 */
function PrefixAdvanceSlot({ text, running }: { text: string; running: boolean }) {
  const singleLineRef = useRef<HTMLSpanElement>(null)
  const outgoingLineRef = useRef<HTMLSpanElement>(null)
  const incomingLineRef = useRef<HTMLSpanElement>(null)
  const committedGenerationRef = useRef<number | undefined>(undefined)
  const committedTextRef = useRef('')
  const grownIncomingRef = useRef('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const runningRef = useRef(running)
  runningRef.current = running
  const textRef = useRef(text)
  textRef.current = text
  const [advance, setAdvance] = useState<PrefixAdvance | null>(null)
  const [slide, setSlide] = useState(false)
  const generation = paragraphGeneration(text)
  const summary = latestParagraph(text)
  const incomingDisplay = advance === null
    ? ''
    : generation === advance.incomingGeneration
      ? latestParagraph(text)
      : grownIncomingRef.current

  if (advance !== null && generation === advance.incomingGeneration) {
    grownIncomingRef.current = latestParagraph(text)
  }

  const clearAdvanceTimer = (): void => {
    if (timeoutRef.current === null) return
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }

  useLayoutEffect(() => {
    if (!running) {
      clearAdvanceTimer()
      committedGenerationRef.current = undefined
      if (advance !== null) setAdvance(null)
      return
    }

    if (prefersReducedMotion()) {
      committedGenerationRef.current = generation
      committedTextRef.current = latestParagraph(text)
      clearAdvanceTimer()
      if (advance !== null) setAdvance(null)
      return
    }

    if (committedGenerationRef.current === undefined) {
      committedGenerationRef.current = generation
      committedTextRef.current = latestParagraph(text)
      return
    }

    if (advance !== null || timeoutRef.current !== null) return

    if (generation === committedGenerationRef.current) {
      committedTextRef.current = latestParagraph(text)
      return
    }

    const next: PrefixAdvance = {
      outgoing: committedTextRef.current,
      incoming: latestParagraph(text),
      incomingGeneration: generation,
    }
    grownIncomingRef.current = next.incoming
    setAdvance(next)
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      if (!mountedRef.current || !runningRef.current) return
      committedGenerationRef.current = paragraphGeneration(textRef.current)
      committedTextRef.current = latestParagraph(textRef.current)
      setAdvance(null)
    }, PARAGRAPH_ADVANCE_MS)
  }, [advance, generation, running, text])

  useEffect(() => {
    setSlide(advance !== null)
  }, [advance])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearAdvanceTimer()
    }
  }, [])

  useLayoutEffect(() => {
    for (const element of [singleLineRef.current, outgoingLineRef.current, incomingLineRef.current]) {
      if (element !== null) element.scrollLeft = 0
    }
  })

  return (
    <span className={css.summary}>
      {running && advance !== null
        ? (
          <span className={css.track} data-advancing={slide || undefined}>
            <span key="outgoing" ref={outgoingLineRef} className={css.line}>{advance.outgoing}</span>
            <span key="incoming" ref={incomingLineRef} className={css.line}>{incomingDisplay}</span>
          </span>
        )
        : <span ref={singleLineRef} className={css.line}>{summary}</span>}
    </span>
  )
}

/**
 * Render one assistant reasoning block as the Think disclosure row.
 * @param props.text - complete or streaming reasoning text.
 * @param props.running - whether this block is the streaming tail.
 * @param props.previewMode - collapsed streaming summary mode; ignored once settled, which keeps the last paragraph.
 * @param props.t - Chat locale seat for the running status.
 * @returns the reasoning disclosure.
 */
export function ReasoningRow({
  text, running, previewMode = 'prefix', t,
}: {
  text: string
  running: boolean
  previewMode?: CollapsedThinkPreview
  t: ChatViewSlotProps['t']
}) {
  const [expanded, setExpanded] = useState(false)
  const summaryRef = useRef<HTMLSpanElement>(null)
  const followEnd = running && previewMode === 'follow-end'
  const summary = streamingSummary(text, followEnd)
  const scheduleSummaryScroll = useThrottledVisualUpdate(() => {
    const element = summaryRef.current
    if (element === null) return
    element.scrollLeft = element.scrollWidth - element.clientWidth
  })
  useEffect(() => {
    if (!followEnd) return
    scheduleSummaryScroll()
  }, [followEnd, scheduleSummaryScroll, summary])

  return (
    <div
      className={css.root}
      data-variant="think"
      data-state={running ? 'running' : 'ok'}
      data-expanded={expanded || undefined}
    >
      {running && <span className={a11yCss.visuallyHidden}>{t('row.running')}</span>}
      <DisclosureRow
        rowClassName={css.row}
        leadingClassName={css.leading}
        titleClassName={css.title}
        chevronClassName={css.chevron}
        icon={<IconThinkOutline14 size={14} />}
        title={t('message.think')}
        open={expanded}
        expandable
        expandOnRowClick
        onToggle={() => { setExpanded(value => !value) }}
        collapsedContent={(
          <>
            <span className={css.separator} aria-hidden />
            {followEnd
              ? (
                <span
                  ref={summaryRef}
                  className={css.summary}
                  data-follow-end
                >
                  {summary}
                </span>
              )
              : <PrefixAdvanceSlot text={text} running={running} />}
          </>
        )}
      >
        <div className={css.thinkBody}>{text}</div>
      </DisclosureRow>
    </div>
  )
}
