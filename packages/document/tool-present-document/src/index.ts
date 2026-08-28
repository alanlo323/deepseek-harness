/**
 * Model-facing `present_document` tool: submit a workspace Markdown file for the Web document view.
 * @module @deepseek-ai/dsh-tool-present-document
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  PRESENT_DOCUMENT_TOOL_NAME,
  PRESENTATION_META_MAX_BYTES,
  buildSubmittedDocumentMeta,
  normalizeLogicalPath,
  presentDocumentValue,
  readContainedUtf8,
  type PresentDocumentValue,
  type SubmittedDocumentMeta,
} from '@deepseek-ai/dsh-document-core'

export const name = 'tool-present-document'
export const inject = ['tools']

/** Serialized `presentationMeta` byte cap for one successful present. */
export interface Config {
  /**
   * Maximum UTF-8 byte length of the complete serialized `presentationMeta` JSON.
   * @default 262144
   */
  readonly maxBytes?: number
}

/** Schemastery configuration for the present-document tool. */
export const Config: z<Config> = z.object({
  maxBytes: z.number().step(1).min(1024).default(PRESENTATION_META_MAX_BYTES),
})

const MARKDOWN_EXTENSION = /\.(?:md|markdown)$/i
const pendingSnapshots = new Map<string, SubmittedDocumentMeta>()
let snapshotSeq = 0

/**
 * Display title: the first ATX H1 when present, otherwise the file stem.
 * @param markdown - file contents.
 * @param logicalPath - workspace-relative path.
 * @returns title shown in the Report view and tool card.
 */
export function titleFromMarkdown(markdown: string, logicalPath: string): string {
  const heading = /^#\s+(.+)$/m.exec(markdown)
  const fromHeading = heading?.[1]?.trim()
  if (fromHeading !== undefined && fromHeading.length > 0) return fromHeading
  const base = logicalPath.slice(logicalPath.lastIndexOf('/') + 1)
  const stem = base.replace(MARKDOWN_EXTENSION, '')
  return stem.length > 0 ? stem : 'Report'
}

interface PresentDocumentToolValue extends PresentDocumentValue {
  readonly snapshotId: string
}

/**
 * Register `present_document` on `ctx.tools`.
 * @param ctx - registrant context carrying the tool registry.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const maxBytes = config.maxBytes ?? PRESENTATION_META_MAX_BYTES
  ctx.tools.register(defineTool({
    name: PRESENT_DOCUMENT_TOOL_NAME,
    description: [
      'Submit a finished Markdown report so the user can open it in the Report view.',
      'Call this once the final report file is written in the workspace.',
      'Pass the workspace-relative path (POSIX slashes, no `..`, not absolute).',
      'An optional title overrides the first ATX heading or the file stem.',
      'The tool does not return the file body; it confirms presentation to the UI.',
      'Call it as a direct tool, not from inside run_code.',
    ].join(' '),
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Workspace-relative path to the Markdown report (`.md` or `.markdown`).',
      },
      title: {
        type: 'string',
        description: 'Optional display title. When omitted, the first ATX heading or the file stem is used.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', required: true, const: 'presented' },
          title: { type: 'string', required: true },
          logicalPath: { type: 'string', required: true },
          byteLength: { type: 'integer', required: true },
          snapshotId: { type: 'string', required: true },
        },
      },
      render: (_args, value: PresentDocumentToolValue) => [{
        type: 'text',
        text: `Presented ${value.logicalPath} (${String(value.byteLength)} bytes) as "${value.title}".`,
      }],
      presentationMeta: (_args, value: PresentDocumentToolValue): JsonValue => {
        const meta = pendingSnapshots.get(value.snapshotId)
        pendingSnapshots.delete(value.snapshotId)
        if (meta === undefined) {
          throw new Error('present_document snapshot was not captured during execute')
        }
        return meta as unknown as JsonValue
      },
    },
    async execute(args, exec) {
      /* v8 ignore next 3 -- the registry rejects an already-aborted signal before execute */
      if (exec.signal.aborted) {
        throw new Error('present_document was cancelled')
      }
      if (exec.parent !== undefined) {
        throw new Error('present_document must be a top-level tool call, not a nested dispatch')
      }
      if (exec.agent === undefined) {
        throw new Error('present_document requires an owning agent session')
      }
      const cwd = exec.agent.session.header.cwd
      if (cwd === undefined || cwd.trim() === '') {
        throw new Error('present_document requires the session workspace cwd')
      }
      let logicalPath: string
      try {
        logicalPath = normalizeLogicalPath(args.path)
      } catch (error: unknown) {
        throw new Error((error as Error).message)
      }
      if (!MARKDOWN_EXTENSION.test(logicalPath)) {
        throw new Error('present_document path must end in .md or .markdown')
      }
      let text: string
      let byteLength: number
      try {
        const read = await readContainedUtf8(cwd, logicalPath)
        text = read.text
        byteLength = read.byteLength
      } catch (error: unknown) {
        throw new Error((error as Error).message)
      }
      if (text.trim().length === 0) {
        throw new Error('present_document refuses an empty Markdown file')
      }
      const requestedTitle = typeof args.title === 'string' ? args.title.trim() : ''
      const title = requestedTitle.length > 0 ? requestedTitle : titleFromMarkdown(text, logicalPath)
      const meta = buildSubmittedDocumentMeta(title, logicalPath, text, byteLength, maxBytes)
      snapshotSeq += 1
      const snapshotId = `${exec.callId}:${String(snapshotSeq)}`
      pendingSnapshots.set(snapshotId, meta)
      return { ...presentDocumentValue(meta), snapshotId }
    },
    presentCall: args => ({
      card: 'generic',
      title: 'Present document',
      kind: 'other',
      rawInput: args.path,
    }),
  }))
}
