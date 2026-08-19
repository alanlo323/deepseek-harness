/**
 * Production-vector fixture: load the unbuilt runtime through `node --import tsx/esm`
 * and run one program. The spec asserts the printed JSON.
 */
import { Context } from '@deepseek-ai/cordis'
import { WorkerThreadCodeRuntime } from '../src/index.ts'

const ctx = new Context()
await ctx.plugin(WorkerThreadCodeRuntime, {})
const runtime = ctx.codeRuntime as WorkerThreadCodeRuntime
const result = await runtime.run({
  program: 'return { answer: 42, execArgv: process.execArgv }',
  bindings: [],
})
if (result.error) {
  console.error(JSON.stringify(result.error))
  process.exit(1)
}
console.log(JSON.stringify(result.value))
process.exit(0)
