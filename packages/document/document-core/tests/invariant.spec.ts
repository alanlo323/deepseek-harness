import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as DocumentCoreInvariant from '../src/invariant.ts'

describe('document-core invariant companion', () => {
  it('reserves package ownership and releases it with the fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(DocumentCoreInvariant)
    await fiber.await()
    expect(DocumentCoreInvariant.name).toBe('document-core-invariant')
    expect(DocumentCoreInvariant.inject).toEqual(['invariants'])
    expect(() => {
      ctx.invariants.register('@deepseek-ai/dsh-document-core', () => {})
    }).toThrow(/already registered/)
    await fiber.dispose()
    await expect(ctx.plugin(DocumentCoreInvariant).await()).resolves.toBeDefined()
  })
})
