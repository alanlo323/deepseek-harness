/**
 * CJK UI font contract, asserted against CSS text on disk: DshCjk precedes
 * system-ui, prefers local PingFang TC, then the Noto Sans TC Traditional
 * webfont, and retired Simplified family names do not reappear in package
 * source sheets.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const require = createRequire(fileURLToPath(new URL('../../web/package.json', import.meta.url)))
const STYLES = new URL('../src/styles/', import.meta.url)
const CJK_FACES = fileURLToPath(new URL('../../web/src/cjk-faces.css', import.meta.url))
const PACKAGES_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const WEB_SHELL_DIR = fileURLToPath(new URL('../../web', import.meta.url))
const TRAJECTORY_TYPEFACE = fileURLToPath(
  new URL('../../ui-trajectory/src/client/TrajectoryTable.module.css', import.meta.url),
)
const baseCss = readFileSync(fileURLToPath(new URL('base.css', STYLES)), 'utf8')
const facesCss = readFileSync(CJK_FACES, 'utf8')

/** Fontsource Traditional subset woff2 files DshCjk lists, one per UI weight. */
const NOTO_TRADITIONAL_WOFF2 = [
  '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-400-normal.woff2',
  '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-500-normal.woff2',
  '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-600-normal.woff2',
  '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff2',
] as const

const RETIRED_SIMPLIFIED_FAMILIES = [
  /(['"])PingFang SC\1/,
  /(['"])Hiragino Sans GB\1/,
  /(['"])Microsoft YaHei\1/,
] as const

/**
 * One `@font-face` block's declarations, whitespace collapsed.
 */
interface FontFace {
  family: string
  weight: string
  display: string
  src: string
  unicodeRange: string
}

/**
 * Collapse CSS whitespace so multiline token values compare as a single list.
 * @param value - raw CSS value text.
 * @returns the value with internal whitespace reduced to single spaces.
 */
function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Declaration map for one `{ ... }` block.
 * @param body - inside the braces, comments already stripped from the sheet.
 * @returns property to collapsed value.
 */
function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of body.split(';')) {
    const trimmed = part.trim()
    if (!trimmed.includes(':')) continue
    const colon = trimmed.indexOf(':')
    map.set(trimmed.slice(0, colon).trim(), collapse(trimmed.slice(colon + 1)))
  }
  return map
}

/**
 * `@font-face` rules in source order.
 * @param css - stylesheet text.
 * @returns one entry per face.
 */
function fontFaces(css: string): FontFace[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const faces: FontFace[] = []
  for (const [, body = ''] of withoutComments.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const declared = declarations(body)
    faces.push({
      family: declared.get('font-family') ?? '',
      weight: declared.get('font-weight') ?? '',
      display: declared.get('font-display') ?? '',
      src: declared.get('src') ?? '',
      unicodeRange: declared.get('unicode-range') ?? '',
    })
  }
  return faces
}

/**
 * `:root` custom properties from the theme base sheet.
 * @param css - stylesheet text.
 * @returns property to collapsed value for the `:root` rule.
 */
function rootProperties(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const match = /:root\s*\{([^}]*)\}/.exec(withoutComments)
  if (match?.[1] === undefined) return new Map()
  return declarations(match[1])
}

/**
 * Every CSS file shipped as package source, excluding build output,
 * installed dependencies, and the pre-plugin web shell (its fallback stack
 * may name system Simplified families until ui-theme tokens arrive).
 * @returns absolute paths of the stylesheets under packages/.
 */
function packageStylesheets(): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'lib' || entry.name === 'dist') continue
        // Pre-plugin shell CSS may name system Simplified families until ui-theme
        // tokens arrive; DshCjk ownership starts at the theme sheets.
        if (path === WEB_SHELL_DIR || path.startsWith(`${WEB_SHELL_DIR}${sep}`)) continue
        walk(path)
      } else if (entry.name.endsWith('.css')) found.push(path)
    }
  }
  walk(PACKAGES_DIR)
  return found
}

const root = rootProperties(baseCss)
const uiStack = root.get('--dsw-font-family') ?? ''
const codeStack = root.get('--ds-font-family-code') ?? ''
const dshCjkFaces = fontFaces(facesCss).filter(face => face.family === "'DshCjk'")

describe('theme CJK font stack', () => {
  it('puts DshCjk before system-ui in the UI stack and before mono Latin in the code stack', () => {
    expect(uiStack.startsWith("'DshCjk', -apple-system")).toBe(true)
    expect(codeStack.startsWith("'DshCjk', 'SF Mono'")).toBe(true)
    expect(codeStack.endsWith(', sans-serif')).toBe(true)
    expect(codeStack.includes('-apple-system')).toBe(false)
  })

  it('omits a bare monospace tail from the code stack', () => {
    expect(codeStack).not.toMatch(/(^|,\s*)monospace(\s*,|$)/)
  })

  it('loads PingFang TC locally, then the Noto Sans TC Traditional webfont', () => {
    expect(dshCjkFaces.map(face => face.weight)).toEqual(['400', '500', '600', '700'])
    const ranges = dshCjkFaces.map(face => face.unicodeRange)
    expect(new Set(ranges).size).toBe(1)
    // Literal resolve calls so knip traces the CSS-only Fontsource dependency.
    expect(existsSync(require.resolve(
      '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-400-normal.woff2',
    ))).toBe(true)
    expect(existsSync(require.resolve(
      '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-500-normal.woff2',
    ))).toBe(true)
    expect(existsSync(require.resolve(
      '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-600-normal.woff2',
    ))).toBe(true)
    expect(existsSync(require.resolve(
      '@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff2',
    ))).toBe(true)
    for (const [index, face] of dshCjkFaces.entries()) {
      const file = NOTO_TRADITIONAL_WOFF2[index]
      if (file === undefined) throw new Error(`missing Noto woff2 specifier for DshCjk weight ${face.weight}`)
      const pingfang = face.src.indexOf("local('PingFang TC')")
      const webfont = face.src.indexOf(`url('${file}')`)
      const jhenghei = face.src.indexOf("local('Microsoft JhengHei')")
      expect(face.display, face.weight).toBe('swap')
      expect(pingfang, face.weight).toBeGreaterThanOrEqual(0)
      expect(webfont, face.weight).toBeGreaterThan(pingfang)
      expect(jhenghei, face.weight).toBeGreaterThan(webfont)
      expect(face.src.includes("format('woff2')"), face.weight).toBe(true)
      expect(face.unicodeRange.includes('U+4E00-9FFF'), face.weight).toBe(true)
    }
  })

  it('does not name retired Simplified CJK families in package source CSS', () => {
    const hits: string[] = []
    for (const file of packageStylesheets()) {
      const css = readFileSync(file, 'utf8')
      for (const family of RETIRED_SIMPLIFIED_FAMILIES) {
        if (family.test(css)) hits.push(`${file}: ${family.source}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('keeps the trajectory tool-call typeface Menlo-first with a DshCjk tail', () => {
    expect(readFileSync(TRAJECTORY_TYPEFACE, 'utf8')).toMatch(
      /font:\s*400 12px\/18px Menlo, Consolas, 'Liberation Mono', 'DshCjk', sans-serif;/,
    )
  })
})
