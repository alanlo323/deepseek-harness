import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as DocumentHostInvariant from '../src/invariant.ts'

describe('document-host invariant companion', () => {
  it('reserves package ownership and releases it with the fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(DocumentHostInvariant)
    await fiber.await()
    expect(DocumentHostInvariant.name).toBe('document-host-invariant')
    expect(DocumentHostInvariant.inject).toEqual(['invariants'])
    expect(() => {
      ctx.invariants.register('@deepseek-ai/dsh-document-host', () => {})
    }).toThrow(/already registered/)
    await fiber.dispose()
    await expect(ctx.plugin(DocumentHostInvariant).await()).resolves.toBeDefined()
  })
})
