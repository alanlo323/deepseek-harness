/**
 * Shell CSS must emit hashed Noto Sans TC assets. The Vite build CSS plugin
 * rewrites DshCjk `url('@fontsource/...')`; PostCSS preprocess does not.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SHELL_CJK_FACES = resolve(WEB_ROOT, '../../packages/client/web/src/cjk-faces.css')

/**
 * Collect emitted CSS text from a Vite `build({ write: false })` result.
 * @param result - Vite build return value.
 * @returns concatenated CSS asset sources.
 */
function cssAssets(result: Awaited<ReturnType<typeof build>>): string {
  const bundles = Array.isArray(result) ? result : [result]
  const sources: string[] = []
  for (const bundle of bundles) {
    if (!('output' in bundle)) continue
    for (const item of bundle.output) {
      if (item.type !== 'asset' || !item.fileName.endsWith('.css')) continue
      if (typeof item.source === 'string') sources.push(item.source)
    }
  }
  return sources.join('\n')
}

describe('CJK webfont Vite pipeline', () => {
  it('rewrites DshCjk Fontsource url() into hashed font assets', async () => {
    const result = await build({
      configFile: resolve(WEB_ROOT, 'vite.config.ts'),
      root: WEB_ROOT,
      logLevel: 'silent',
      build: {
        write: false,
        sourcemap: false,
        emptyOutDir: false,
        rollupOptions: { input: SHELL_CJK_FACES },
      },
    })
    const css = cssAssets(result)
    expect(css.includes('PingFang TC')).toBe(true)
    expect(css.includes("url('@fontsource/noto-sans-tc")).toBe(false)
    expect(css).toMatch(/noto-sans-tc-chinese-traditional-400-normal/i)
    expect(css).toMatch(/\.woff2/)
  }, 30_000)
})
