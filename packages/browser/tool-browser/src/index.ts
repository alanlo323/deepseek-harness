/**
 * Model-facing `browser_open`, `browser_run`, and `browser_close` over `ctx.browser`.
 * Screencast frames never appear in tool results or the session log.
 * @module @deepseek-ai/dsh-tool-browser
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-browser'
import { parseBrowserSessionMeta, type BrowserSessionMeta } from '@deepseek-ai/dsh-browser'

export { parseBrowserSessionMeta }
export type { BrowserSessionMeta }

export const name = 'tool-browser'
export const inject = ['tools', 'browser', 'systemPrompt']

const GUIDANCE = [
  'Use browser_open, browser_run, and browser_close for one headless Chromium Browser Session.',
  'browser_open starts the session; a second open fails until browser_close.',
  'browser_run evaluates a Playwright script body with page, browser, context, and playwright in scope against that same page.',
  'Return JSON-serializable values only; oversized results fail rather than truncate.',
  'browser_close tears the session down. web_search and web_fetch do not open this session.',
].join(' ')

function requireAgentSession(exec: { agent?: { session: { id: string } } }): string {
  if (exec.agent === undefined) {
    throw new Error('browser tools require an owning agent session')
  }
  return exec.agent.session.id
}

function meta(browserSessionId: string, dshSessionId: string, status: 'open' | 'closed'): { readonly [key: string]: string } {
  return { kind: 'browser-session', browserSessionId, dshSessionId, status }
}

const sessionFields = {
  browserSessionId: { type: 'string' as const, required: true as const },
  dshSessionId: { type: 'string' as const, required: true as const },
}

/**
 * Register the three browser tools and their system-prompt section.
 * @param ctx - host context carrying tools, browser, and systemPrompt.
 * @returns nothing; registration is an effect on `ctx`.
 */
export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'tool:browser',
    order: ctx.systemPrompt.getSectionOrder('TOOL_BROWSER'),
    text: GUIDANCE,
  })

  ctx.tools.register(defineTool({
    name: 'browser_open',
    description: 'Open the single headless Chromium Browser Session for this process.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...sessionFields,
          status: { type: 'string', required: true, const: 'open' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Browser Session ${value.browserSessionId} is open.` }],
      presentationMeta: (_args, value) => meta(value.browserSessionId, value.dshSessionId, 'open'),
    },
    isConcurrencySafe: () => false,
    async execute(_args, exec) {
      const dshSessionId = requireAgentSession(exec)
      const browserSessionId = await ctx.browser.open(exec.signal)
      return { browserSessionId, dshSessionId, status: 'open' as const }
    },
    presentCall: () => ({ card: 'generic', title: 'Open browser', kind: 'other' }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_run',
    description: 'Run a Playwright script body against the open Browser Session page.',
    parameters: {
      script: {
        type: 'string',
        required: true,
        description: 'Playwright script body. `page`, `browser`, `context`, and `playwright` are in scope. Return JSON.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...sessionFields,
          result: { type: 'json', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `browser_run result: ${JSON.stringify(value.result)}`,
      }],
      presentationMeta: (_args, value) => meta(value.browserSessionId, value.dshSessionId, 'open'),
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const dshSessionId = requireAgentSession(exec)
      const id = ctx.browser.currentSessionId()
      if (id === undefined) {
        throw new Error('no Browser Session is open')
      }
      const result = await ctx.browser.run(args.script, exec.signal)
      return { browserSessionId: id, dshSessionId, result }
    },
    presentCall: args => ({ card: 'generic', title: 'Run browser script', kind: 'execute', rawInput: args.script }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_close',
    description: 'Close the open headless Chromium Browser Session.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...sessionFields,
          status: { type: 'string', required: true, const: 'closed' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Browser Session ${value.browserSessionId} is closed.` }],
      presentationMeta: (_args, value) => meta(value.browserSessionId, value.dshSessionId, 'closed'),
    },
    isConcurrencySafe: () => false,
    async execute(_args, exec) {
      const dshSessionId = requireAgentSession(exec)
      const browserSessionId = await ctx.browser.close()
      return { browserSessionId, dshSessionId, status: 'closed' as const }
    },
    presentCall: () => ({ card: 'generic', title: 'Close browser', kind: 'other' }),
  }))
}
