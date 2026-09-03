/**
 * Unbuilt worker `execArgv`: enable Node type stripping when the host has
 * native TypeScript off, without inheriting host loaders.
 * @module @deepseek-ai/dsh-browser-playwright/spawn
 */

import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Child CLI flags for the unbuilt TypeScript entry.
 * @param typescript - `process.features.typescript`.
 * @returns `execArgv` for the unbuilt worker.
 */
export function sourceWorkerExecArgv(
  typescript: typeof process.features.typescript = process.features.typescript,
): string[] {
  if (typescript) return []
  return ['--experimental-strip-types', '--disable-warning=ExperimentalWarning']
}

/** Engine child entry and Node flags for the current compile face. */
export type EngineWorkerSpawn = {
  readonly file: string
  readonly execArgv: string[]
}

/**
 * Resolve the engine child entry next to this compile face.
 * The unbuilt arm uses `sourceWorkerExecArgv()`; the built `lib/` arm loads
 * the bundled `worker.js` with a clean `execArgv`.
 * @param here - absolute path of the calling module (`fileURLToPath(import.meta.url)`).
 * @returns the worker file and `execArgv`.
 */
export function resolveEngineWorker(here: string): EngineWorkerSpawn {
  const base = pathToFileURL(here).href
  if (here.endsWith('.ts')) {
    return {
      file: fileURLToPath(new URL('./worker.ts', base)),
      execArgv: sourceWorkerExecArgv(),
    }
  }
  return {
    file: fileURLToPath(new URL('./worker.js', base)),
    execArgv: [],
  }
}
