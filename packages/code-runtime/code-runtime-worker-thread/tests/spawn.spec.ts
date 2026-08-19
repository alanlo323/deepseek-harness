import { expect, it } from 'vitest'
import { sourceWorkerExecArgv } from '../src/spawn.ts'

it('sourceWorkerExecArgv is empty when native TypeScript is on and enables strip when it is off', () => {
  expect(sourceWorkerExecArgv('strip')).toEqual([])
  expect(sourceWorkerExecArgv('transform')).toEqual([])
  expect(sourceWorkerExecArgv(false)).toEqual(['--experimental-strip-types', '--disable-warning=ExperimentalWarning'])
  expect(sourceWorkerExecArgv()).toEqual(sourceWorkerExecArgv(process.features.typescript))
})
