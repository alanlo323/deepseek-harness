import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type ToolExecutionToken } from '@deepseek-ai/dsh-tools'
import { type Agent } from '@deepseek-ai/dsh-agent'
import { PRESENT_DOCUMENT_TOOL_NAME, parseSubmittedDocumentMeta } from '@deepseek-ai/dsh-document-core'
import * as tool from '../src/index.ts'
import { titleFromMarkdown } from '../src/index.ts'

const testToolSignal = new AbortController().signal

function agentWithCwd(cwd: string | undefined, id = 'present-1'): Agent & { session: Session } {
  const sessionId = SessionId(id)
  const session = Session.create(sessionId, undefined, {
    version: SESSION_FORMAT_VERSION,
    id: sessionId,
    createdAt: 1,
    ...cwd !== undefined ? { cwd } : {},
  })
  return { id: sessionId, session } as unknown as Agent & { session: Session }
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(tool)
  return ctx
}

let callCounter = 0
function present(
  ctx: Context,
  args: unknown,
  over: { agent?: Agent | undefined; parent?: ToolExecutionToken } = {},
) {
  const agent = 'agent' in over ? over.agent : agentWithCwd(process.cwd())
  return ctx.tools.execute({
    signal: testToolSignal,
    callId: ToolCallId(`call-${++callCounter}`),
    name: PRESENT_DOCUMENT_TOOL_NAME,
    arguments: args,
    ...agent ? { agent } : {},
    ...over.parent !== undefined ? { parent: over.parent } : {},
  })
}

describe('titleFromMarkdown', () => {
  it('prefers the first ATX heading over the file stem', () => {
    expect(titleFromMarkdown('# Deep Report\n\nbody', 'out/notes.md')).toBe('Deep Report')
    expect(titleFromMarkdown('no heading', 'out/notes.md')).toBe('notes')
    expect(titleFromMarkdown('#   ', 'out/notes.md')).toBe('notes')
    expect(titleFromMarkdown('body', '.md')).toBe('Report')
    expect(titleFromMarkdown('body', 'dir/.markdown')).toBe('Report')
  })
})

describe('present_document', () => {
  it('registers the tool and presents a workspace Markdown file', async () => {
    const ctx = await setup()
    const root = await mkdtemp(join(tmpdir(), 'dsh-present-'))
    await writeFile(join(root, 'report.md'), '# Findings\n\nHello.\n', 'utf8')
    const agent = agentWithCwd(root)
    const result = await present(ctx, { path: 'report.md' }, { agent })
    expect(result.isError).toBe(false)
    if (result.isError) throw new Error('expected success')
    expect(result.value).toMatchObject({
      status: 'presented',
      title: 'Findings',
      logicalPath: 'report.md',
    })
    const meta = parseSubmittedDocumentMeta(result.meta)
    expect(meta?.content).toContain('Hello.')
    expect(meta?.kind).toBe('submitted-document')
  })

  it('rejects missing cwd, traversal, and non-markdown paths without a snapshot', async () => {
    const ctx = await setup()
    const noCwd = await present(ctx, { path: 'report.md' }, { agent: agentWithCwd(undefined) })
    expect(noCwd.isError).toBe(true)
    expect(noCwd.meta).toBeUndefined()
    const blankCwd = await present(ctx, { path: 'report.md' }, {
      agent: { id: SessionId('blank'), session: { header: { cwd: '   ' } } } as Agent,
    })
    expect(blankCwd.isError).toBe(true)

    const root = await mkdtemp(join(tmpdir(), 'dsh-present-bad-'))
    await writeFile(join(root, 'notes.txt'), 'x', 'utf8')
    const agent = agentWithCwd(root)
    const traversal = await present(ctx, { path: '../secret.md' }, { agent })
    expect(traversal.isError).toBe(true)
    const notMd = await present(ctx, { path: 'notes.txt' }, { agent })
    expect(notMd.isError).toBe(true)
  })

  it('uses an explicit title and rejects an empty file', async () => {
    const ctx = await setup()
    const root = await mkdtemp(join(tmpdir(), 'dsh-present-title-'))
    await writeFile(join(root, 'report.md'), '# Heading\n\nBody.\n', 'utf8')
    const agent = agentWithCwd(root)
    const named = await present(ctx, { path: 'report.md', title: 'Custom Title' }, { agent })
    expect(named.isError).toBe(false)
    if (named.isError) throw new Error('expected success')
    expect(named.value).toMatchObject({ title: 'Custom Title' })

    await writeFile(join(root, 'empty.md'), '   \n', 'utf8')
    const empty = await present(ctx, { path: 'empty.md' }, { agent })
    expect(empty.isError).toBe(true)
  })

  it('fails when even a stripped snapshot exceeds maxBytes', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(tool, { maxBytes: 1024 })
    const root = await mkdtemp(join(tmpdir(), 'dsh-present-cap-'))
    const hugeTitle = 'T'.repeat(2000)
    await writeFile(join(root, 'report.md'), `# ${hugeTitle}\n\nbody\n`, 'utf8')
    const result = await present(ctx, { path: 'report.md', title: hugeTitle }, { agent: agentWithCwd(root) })
    expect(result.isError).toBe(true)
  })

  it('rejects cancellation, a missing agent, a missing file, and a stolen snapshot handle', async () => {
    const ctx = await setup()
    const root = await mkdtemp(join(tmpdir(), 'dsh-present-edges-'))
    await writeFile(join(root, 'report.md'), '# Findings\n\nHello.\n', 'utf8')
    await writeFile(join(root, 'notes.markdown'), '# Other\n\nBody.\n', 'utf8')
    const agent = agentWithCwd(root)

    const cancelled = new AbortController()
    cancelled.abort()
    const aborted = await ctx.tools.execute({
      signal: cancelled.signal,
      callId: ToolCallId(`call-${++callCounter}`),
      name: PRESENT_DOCUMENT_TOOL_NAME,
      arguments: { path: 'report.md' },
      agent,
    })
    expect(aborted.isError).toBe(true)

    const noAgent = await present(ctx, { path: 'report.md' }, { agent: undefined })
    expect(noAgent.isError).toBe(true)

    const nested = await present(ctx, { path: 'report.md' }, {
      agent,
      parent: Symbol('ptc-parent') as ToolExecutionToken,
    })
    expect(nested.isError).toBe(true)
    expect(nested.meta).toBeUndefined()

    const missing = await present(ctx, { path: 'gone.md' }, { agent })
    expect(missing.isError).toBe(true)

    const markdown = await present(ctx, { path: 'notes.markdown' }, { agent })
    expect(markdown.isError).toBe(false)

    const def = ctx.tools.get(PRESENT_DOCUMENT_TOOL_NAME)!
    expect(def.presentCall?.({ path: 'report.md' })).toEqual({
      card: 'generic',
      title: 'Present document',
      kind: 'other',
      rawInput: 'report.md',
    })
    expect(() => def.output.presentationMeta?.({}, {
      status: 'presented',
      title: 'T',
      logicalPath: 'report.md',
      byteLength: 1,
      snapshotId: 'missing',
    })).toThrow(/not captured/)
  })

  it('applies the default byte cap when Config is omitted', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    tool.apply(ctx)
    const root = await mkdtemp(join(tmpdir(), 'dsh-present-default-'))
    await writeFile(join(root, 'report.md'), '# Findings\n\nHello.\n', 'utf8')
    const result = await present(ctx, { path: 'report.md' }, { agent: agentWithCwd(root) })
    expect(result.isError).toBe(false)
  })
})
