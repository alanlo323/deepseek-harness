import { describe, expect, it } from 'vitest'
import {
  CallId,
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage,
  freezeMessage,
  MessageId,
  startsPostTokenIdle,
} from '@deepseek-ai/dsh-llm'

describe('message construction', () => {
  it('assigns identity immediately and returns a detached deep-frozen message', () => {
    const input = {
      content: [{ type: 'text' as const, text: 'original' }],
      source: { kind: 'plugin' as const, plugin: 'test' },
    }

    const message = createUserMessage(input)

    expect(message.id).toEqual(expect.any(String))
    expect(message.role).toBe('user')
    expect(message.id).not.toHaveLength(0)
    expect(message).not.toBe(input)
    expect(Object.isFrozen(message)).toBe(true)
    expect(Object.isFrozen(message.content)).toBe(true)
    expect(Object.isFrozen(message.content[0])).toBe(true)
    expect(Object.isFrozen(message.source)).toBe(true)

    input.content[0]!.text = 'caller mutation'
    expect(message.content).toEqual([{ type: 'text', text: 'original' }])
    expect(() => {
      (message.content[0] as { text: string }).text = 'observer mutation'
    }).toThrow()
  })

  it('freezes an existing identity without minting a replacement', () => {
    const id = MessageId('existing')
    const input = {
      id,
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'answer' }],
      source: { kind: 'model' as const, provider: 'test', model: 'test' },
    }

    const message = freezeMessage(input)

    expect(message).not.toBe(input)
    expect(message.id).toBe(id)
    expect(Object.isFrozen(message)).toBe(true)
    expect(Object.isFrozen(message.content[0])).toBe(true)
  })

  it('fixes the assistant role and model source kind at creation', () => {
    const message = createAssistantMessage({
      content: [{ type: 'text', text: 'answer' }],
      source: {
        provider: 'test-provider',
        model: 'test-model',
        replayState: { request: 1 },
      },
    })

    expect(message).toMatchObject({
      role: 'assistant',
      source: {
        kind: 'model',
        provider: 'test-provider',
        model: 'test-model',
        replayState: { request: 1 },
      },
    })
    expect(message.id).not.toHaveLength(0)
    expect(Object.isFrozen(message)).toBe(true)
    expect(Object.isFrozen(message.source)).toBe(true)
  })

  it('couples tool-result content and its cited call seq to one call identity', () => {
    const callId = CallId('call-1')
    const message = createToolResultMessage({
      callId,
      content: [{ type: 'text', text: 'result' }],
      isError: false,
    })

    expect(message).toMatchObject({
      role: 'user',
      source: { kind: 'tool', callId },
      content: [{
        type: 'tool-result',
        toolCallId: callId,
        content: [{ type: 'text', text: 'result' }],
        isError: false,
      }],
    })
    expect(message.id).not.toHaveLength(0)
    expect(Object.isFrozen(message)).toBe(true)
    expect(Object.isFrozen(message.content[0])).toBe(true)
  })
})

describe('startsPostTokenIdle', () => {
  it('ignores empty deltas, usage, finish, and block-end', () => {
    expect(startsPostTokenIdle({ type: 'text-delta', index: 0, text: '' })).toBe(false)
    expect(startsPostTokenIdle({ type: 'reasoning-delta', index: 0, text: '' })).toBe(false)
    expect(startsPostTokenIdle({
      type: 'tool-call-delta',
      index: 0,
      id: CallId('c1'),
      argumentsDelta: '',
    })).toBe(false)
    expect(startsPostTokenIdle({
      type: 'usage',
      usage: { inputTokens: 1, outputTokens: 1 },
    })).toBe(false)
    expect(startsPostTokenIdle({ type: 'finish', reason: { kind: 'stop' } })).toBe(false)
    expect(startsPostTokenIdle({
      type: 'block-end',
      index: 0,
      block: { type: 'text', text: 'hello' },
    })).toBe(false)
  })

  it('starts after a non-empty delta or a content block-start', () => {
    expect(startsPostTokenIdle({ type: 'text-delta', index: 0, text: 'h' })).toBe(true)
    expect(startsPostTokenIdle({ type: 'reasoning-delta', index: 0, text: 'r' })).toBe(true)
    expect(startsPostTokenIdle({
      type: 'tool-call-delta',
      index: 0,
      id: CallId('c1'),
      name: 'echo',
      argumentsDelta: '',
    })).toBe(true)
    expect(startsPostTokenIdle({ type: 'block-start', index: 0, blockType: 'text' })).toBe(true)
    expect(startsPostTokenIdle({ type: 'block-start', index: 0, blockType: 'reasoning' })).toBe(true)
    expect(startsPostTokenIdle({ type: 'block-start', index: 0, blockType: 'tool-call' })).toBe(true)
  })

  it('ignores non-content block-start types', () => {
    expect(startsPostTokenIdle({ type: 'block-start', index: 0, blockType: 'image' })).toBe(false)
    expect(startsPostTokenIdle({ type: 'block-start', index: 0, blockType: 'tool-result' })).toBe(false)
  })
})
