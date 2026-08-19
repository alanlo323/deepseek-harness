/**
 * Unbuilt worker `execArgv`: enable Node type stripping when the host has
 * native TypeScript off, without inheriting host loaders.
 * @module @deepseek-ai/dsh-code-runtime-worker-thread/src/spawn
 */

/**
 * Worker CLI flags for the unbuilt TypeScript entry. Empty `execArgv` drops the
 * host's `--import tsx/esm` and also drops native `.ts` loading when
 * `process.features.typescript` is off (Node before default strip, or a host
 * that disabled it). Re-enable strip in the thread without inheriting tsx.
 * `--disable-warning=ExperimentalWarning` keeps the experimental strip flag
 * off the captured stderr pipes that become program logs.
 * @param typescript - `process.features.typescript`. A truthy value (`'strip'` /
 *   `'transform'`) yields empty `execArgv`; `false` enables type stripping.
 * @returns `execArgv` for the unbuilt worker.
 */
export function sourceWorkerExecArgv(
  typescript: typeof process.features.typescript = process.features.typescript,
): string[] {
  if (typescript) return []
  return ['--experimental-strip-types', '--disable-warning=ExperimentalWarning']
}
