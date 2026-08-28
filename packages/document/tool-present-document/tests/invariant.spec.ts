import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as PresentDocumentInvariant from '../src/invariant.ts'

describe('tool-present-document invariant companion', () => {
  it('reserves package ownership and releases it with the fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(PresentDocumentInvariant)
    await fiber.await()
    expect(PresentDocumentInvariant.name).toBe('tool-present-document-invariant')
    expect(PresentDocumentInvariant.inject).toEqual(['invariants'])
    expect(() => {
      ctx.invariants.register('@deepseek-ai/dsh-tool-present-document', () => {})
    }).toThrow(/already registered/)
    await fiber.dispose()
    await expect(ctx.plugin(PresentDocumentInvariant).await()).resolves.toBeDefined()
  })
})
