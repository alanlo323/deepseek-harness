import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { execa } from 'execa'
import { expect, it } from 'vitest'
import { decodeWorkerJson } from '../src/worker-json.ts'
import { sourceWorkerExecArgv } from '../src/spawn.ts'

const WORKER_SOURCES = ['worker.ts', 'bootstrap.ts', 'protocol.ts', 'worker-json.ts', 'output-json.ts'] as const

/**
 * Copy the unbuilt worker closure out of the workspace and boot it so a
 * package runtime import fails even when local `lib/` artifacts exist.
 */
async function bootCopiedSourceWorker(execArgv: string[], code: string): Promise<unknown> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-code-source-worker-'))
  let worker: Worker | undefined
  try {
    await Promise.all(WORKER_SOURCES.map(async (file) => {
      await copyFile(new URL(`../src/${file}`, import.meta.url), join(directory, file))
    }))
    worker = new Worker(join(directory, 'worker.ts'), {
      workerData: { code, namespaces: [], maxOutputBytes: 65_536 },
      env: {},
      execArgv,
    })
    return await new Promise<unknown>((resolve, reject) => {
      worker?.once('message', resolve)
      worker?.once('error', reject)
    })
  } finally {
    if (worker) await worker.terminate()
    await rm(directory, { recursive: true, force: true })
  }
}

function completionValue(message: unknown): unknown {
  expect(message).toMatchObject({ type: 'done' })
  return typeof message === 'object' && message !== null ? (message as { value?: unknown }).value : undefined
}

/**
 * Prove the unbuilt worker is a self-contained source closure.
 * `sourceWorkerExecArgv` is the product source spawn: empty `execArgv` cannot
 * load `.ts` when native TypeScript is off.
 */
it('boots the source worker without workspace package outputs', async () => {
  const message = await bootCopiedSourceWorker(sourceWorkerExecArgv(), 'return { answer: 42 }')
  expect(decodeWorkerJson(completionValue(message))).toEqual({ answer: 42 })
})

it('boots the source worker when type stripping is explicitly enabled', async () => {
  const message = await bootCopiedSourceWorker(
    sourceWorkerExecArgv(false),
    'return { answer: 42, execArgv: process.execArgv }',
  )
  expect(decodeWorkerJson(completionValue(message))).toEqual({
    answer: 42,
    execArgv: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning'],
  })
})

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const launchFixture = fileURLToPath(new URL('./source-worker-launch.ts', import.meta.url))
const tsconfig = fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url))

it('runs a program through the source runtime under node --import tsx/esm', async () => {
  const { exitCode, stdout, stderr } = await execa(
    process.execPath,
    ['--import', 'tsx/esm', launchFixture],
    {
      cwd: repoRoot,
      stdin: 'ignore',
      timeout: 55_000,
      killSignal: 'SIGKILL',
      reject: false,
      env: { ...process.env, TSX_TSCONFIG_PATH: tsconfig },
    },
  )
  expect(exitCode, `stderr:\n${stderr}\nstdout:\n${stdout}`).toBe(0)
  const lastLine = stdout.trim().split('\n').at(-1) ?? ''
  expect(JSON.parse(lastLine)).toEqual({ answer: 42, execArgv: sourceWorkerExecArgv() })
}, 60_000)
