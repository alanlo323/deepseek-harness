import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('../../../../', import.meta.url)))

function readPatch(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), 'utf8')
}

describe('browser tools mount only on the Web profile', () => {
  it('web-app patch lists the three browser host rows and ui-browser', () => {
    const patch = readPatch('packages/bundle/web-app/cordis.patch.yml')
    expect(patch).toContain("name: '@deepseek-ai/dsh-tool-browser'")
    expect(patch).toContain("name: '@deepseek-ai/dsh-browser-playwright'")
    expect(patch).toContain("name: '@deepseek-ai/dsh-client-ui-browser'")
  })

  it('headless and acp patches do not list the browser tools', () => {
    const headless = readPatch('packages/bundle/headless/cordis.patch.yml')
    const acp = readPatch('packages/bundle/acp-app/cordis.patch.yml')
    expect(headless).not.toContain('dsh-tool-browser')
    expect(acp).not.toContain('dsh-tool-browser')
  })
})
