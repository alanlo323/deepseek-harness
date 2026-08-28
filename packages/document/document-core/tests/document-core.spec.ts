import { mkdir, mkdtemp, readlink, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LogicalPathError,
  joinLogicalPath,
  logicalDirectory,
  normalizeLogicalPath,
} from '../src/path.ts'
import { extractWorkspaceImages, isRemoteImageSrc, mediaTypeForLogicalPath, rasterImagePixelSize, sniffRasterImageMediaType } from '../src/images.ts'
import { buildSubmittedDocumentMeta, parseSubmittedDocumentMeta, presentDocumentValue } from '../src/meta.ts'
import * as documentCoreClient from '../src/client.ts'
import { ContainedReadError, readContainedImage, readContainedUtf8, resolveContainedFile } from '../src/resolve.ts'
import { PRESENTATION_META_MAX_BYTES, SUBMITTED_DOCUMENT_KIND } from '../src/constants.ts'

describe('normalizeLogicalPath', () => {
  it('accepts nested POSIX relative paths and drops redundant dots', () => {
    expect(normalizeLogicalPath('notes/./report.md')).toBe('notes/report.md')
  })

  it('rejects absolute, parent-escape, empty, and NUL paths', () => {
    expect(() => normalizeLogicalPath('/etc/passwd')).toThrow(LogicalPathError)
    expect(() => normalizeLogicalPath('C:\\Windows\\x.md')).toThrow(LogicalPathError)
    expect(() => normalizeLogicalPath('../outside.md')).toThrow(LogicalPathError)
    expect(() => normalizeLogicalPath('a/../../b.md')).toThrow(LogicalPathError)
    expect(() => normalizeLogicalPath('   ')).toThrow(LogicalPathError)
    expect(() => normalizeLogicalPath('a\0b.md')).toThrow(LogicalPathError)
    expect(() => normalizeLogicalPath('.')).toThrow(LogicalPathError)
    expect(() => normalizeLogicalPath('././')).toThrow(LogicalPathError)
    expect(() => normalizeLogicalPath('\\\\server\\share.md')).toThrow(LogicalPathError)
  })
})

describe('extractWorkspaceImages', () => {
  it('resolves relative images against the Markdown file directory', () => {
    const images = extractWorkspaceImages(
      'out/report.md',
      'See ![arch](images/a.png) and ![remote](https://example.com/x.png) and ![skip](images/a.svg).',
    )
    expect(images).toEqual([{ ref: 'out/images/a.png', mediaType: 'image/png' }])
    expect(joinLogicalPath('out', 'images/a.png')).toBe('out/images/a.png')
    expect(joinLogicalPath('out', '../assets/x.png')).toBe('assets/x.png')
    expect(joinLogicalPath('out', '../../secret.png')).toBeUndefined()
    expect(joinLogicalPath('', 'a.png')).toBe('a.png')
    expect(joinLogicalPath('out', 'https://x/a.png')).toBeUndefined()
    expect(joinLogicalPath('out', 'data:image/png;base64,xx')).toBeUndefined()
    expect(joinLogicalPath('out', '')).toBeUndefined()
    expect(joinLogicalPath('out', '/abs.png')).toBeUndefined()
    expect(joinLogicalPath('out', '\\win.png')).toBeUndefined()
    expect(joinLogicalPath('out', '\\\\server\\a.png')).toBeUndefined()
    expect(joinLogicalPath('out', 'C:\\a.png')).toBeUndefined()
    expect(joinLogicalPath('out', 'blob:abc')).toBeUndefined()
    expect(joinLogicalPath('out', 'a\0b.png')).toBeUndefined()
    expect(joinLogicalPath('a', '..')).toBeUndefined()
    expect(joinLogicalPath('', '.')).toBeUndefined()
    expect(joinLogicalPath('out', 'foo/./bar.png')).toBe('out/foo/bar.png')
    expect(logicalDirectory('out/report.md')).toBe('out')
    expect(logicalDirectory('report.md')).toBe('')
  })
})

describe('buildSubmittedDocumentMeta', () => {
  it('keeps content when the snapshot fits the byte cap', () => {
    const meta = buildSubmittedDocumentMeta('Title', 'report.md', '# Hello\n', 8)
    expect(meta.kind).toBe(SUBMITTED_DOCUMENT_KIND)
    expect(meta.content).toBe('# Hello\n')
    expect(meta.truncated).toBe(false)
    expect(parseSubmittedDocumentMeta(meta)).toEqual(meta)
  })

  it('drops content then trailing images to honor the serialized byte cap', () => {
    const huge = `# ${'x'.repeat(PRESENTATION_META_MAX_BYTES)}`
    const markdown = `${huge}\n\n![a](a.png)\n![b](b.png)\n`
    const meta = buildSubmittedDocumentMeta('Title', 'report.md', markdown, markdown.length, 400)
    expect(meta.truncated).toBe(true)
    expect(meta.content).toBeUndefined()
    expect(parseSubmittedDocumentMeta(meta)?.kind).toBe(SUBMITTED_DOCUMENT_KIND)
    expect(presentDocumentValue(meta)).toEqual({
      status: 'presented',
      title: 'Title',
      logicalPath: 'report.md',
      byteLength: markdown.length,
    })
    expect(() => buildSubmittedDocumentMeta('T', 'report.md', 'x', 1, 8)).toThrow(/exceeds maxBytes/)
    expect(parseSubmittedDocumentMeta(undefined)).toBeUndefined()
    expect(parseSubmittedDocumentMeta({ kind: SUBMITTED_DOCUMENT_KIND })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: '../escape.md',
      byteLength: 1,
      images: [],
      truncated: false,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 'ok.md',
      byteLength: 1,
      images: [{ ref: '../x.png', mediaType: 'image/png' }],
      truncated: false,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: '  ',
      logicalPath: 'ok.md',
      byteLength: 1,
      images: [],
      truncated: false,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 1,
      byteLength: 1,
      images: [],
      truncated: false,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 'ok.md',
      byteLength: 1.5,
      images: [],
      truncated: false,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 'ok.md',
      byteLength: -1,
      images: [],
      truncated: false,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 'ok.md',
      byteLength: 1,
      images: [],
      truncated: 'yes',
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 'ok.md',
      byteLength: 1,
      images: [],
      truncated: false,
      content: 1,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 'ok.md',
      byteLength: 1,
      images: 'no',
      truncated: false,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 'ok.md',
      byteLength: 1,
      images: [null],
      truncated: false,
    })).toBeUndefined()
    expect(parseSubmittedDocumentMeta({
      kind: SUBMITTED_DOCUMENT_KIND,
      title: 'T',
      logicalPath: 'ok.md',
      byteLength: 1,
      images: [{ ref: 1, mediaType: 'image/png' }],
      truncated: false,
    })).toBeUndefined()
    expect(buildSubmittedDocumentMeta(
      'Title',
      'report.md',
      '![a](a.png)\n![b](b.png)\n![c](c.png)\n',
      40,
      120,
    ).images.length).toBeLessThan(3)
    expect(isRemoteImageSrc('https://x/a.png')).toBe(true)
    expect(mediaTypeForLogicalPath('a.JPG')).toBe('image/jpeg')
    expect(mediaTypeForLogicalPath('a.svg')).toBeUndefined()
    expect(mediaTypeForLogicalPath('noext')).toBeUndefined()
    expect(extractWorkspaceImages('report.md', '![a](a.png) ![again](a.png) ![skip](gone.svg)').map(image => image.ref))
      .toEqual(['a.png'])
    expect(documentCoreClient.PRESENT_DOCUMENT_TOOL_NAME).toBe('present_document')
  })
})

describe('contained reads', () => {
  it('reads a workspace file and rejects a symlink that escapes the root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-core-'))
    await writeFile(join(root, 'report.md'), '# ok\n', 'utf8')
    const text = await readContainedUtf8(root, 'report.md')
    expect(text.text).toBe('# ok\n')
    expect((await readContainedImage(root, 'report.md')).toString('utf8')).toBe('# ok\n')
    await expect(readContainedUtf8(root, 'report.md', 2)).rejects.toMatchObject({ code: 'too-large' })
    await expect(readContainedUtf8(join(root, 'missing-dir'), 'report.md')).rejects.toMatchObject({ code: 'missing-cwd' })

    await expect(readContainedUtf8(undefined, 'report.md')).rejects.toBeInstanceOf(ContainedReadError)

    const outside = await mkdtemp(join(tmpdir(), 'dsh-doc-core-out-'))
    await writeFile(join(outside, 'secret.md'), 'nope\n', 'utf8')
    await mkdir(join(root, 'nested'))
    const escapeLink = join(root, 'nested', 'escape.md')
    try {
      await symlink(join(outside, 'secret.md'), escapeLink)
      await readlink(escapeLink)
    } catch {
      return
    }
    await expect(resolveContainedFile(root, 'nested/escape.md')).rejects.toBeInstanceOf(ContainedReadError)

    await mkdir(join(root, 'folder.md'))
    await expect(resolveContainedFile(root, 'folder.md')).rejects.toMatchObject({ code: 'not-file' })
  })
})

describe('sniffRasterImageMediaType', () => {
  it('recognizes PNG, JPEG, GIF, and WebP magic and rejects SVG', () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    expect(sniffRasterImageMediaType(png)).toBe('image/png')
    expect(rasterImagePixelSize(png)).toEqual({ width: 1, height: 1 })

    const jpeg = Buffer.alloc(32)
    jpeg[0] = 0xff
    jpeg[1] = 0xd8
    jpeg[2] = 0xff
    jpeg[3] = 0xe0
    jpeg.writeUInt16BE(4, 4)
    jpeg[8] = 0xff
    jpeg[9] = 0xc0
    jpeg.writeUInt16BE(11, 10)
    jpeg[12] = 8
    jpeg.writeUInt16BE(12, 13)
    jpeg.writeUInt16BE(16, 15)
    expect(sniffRasterImageMediaType(jpeg)).toBe('image/jpeg')
    expect(rasterImagePixelSize(jpeg)).toEqual({ width: 16, height: 12 })

    const jpegNoSof = Buffer.alloc(20)
    jpegNoSof[0] = 0xff
    jpegNoSof[1] = 0xd8
    jpegNoSof[2] = 0xff
    jpegNoSof[3] = 0xe0
    jpegNoSof.writeUInt16BE(4, 4)
    jpegNoSof[8] = 0x00
    expect(rasterImagePixelSize(jpegNoSof)).toBeUndefined()

    const jpegExhaust = Buffer.alloc(12)
    jpegExhaust[0] = 0xff
    jpegExhaust[1] = 0xd8
    jpegExhaust[2] = 0xff
    jpegExhaust[3] = 0xe0
    jpegExhaust.writeUInt16BE(4, 4)
    expect(rasterImagePixelSize(jpegExhaust)).toBeUndefined()

    const gif = Buffer.from('GIF89a\x02\x00\x03\x00xxxx', 'latin1')
    expect(sniffRasterImageMediaType(gif)).toBe('image/gif')
    expect(rasterImagePixelSize(gif)).toEqual({ width: 2, height: 3 })

    const webp = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'latin1')
    expect(sniffRasterImageMediaType(webp)).toBe('image/webp')
    expect(rasterImagePixelSize(webp)).toBeUndefined()

    const pngMagicOnly = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(sniffRasterImageMediaType(pngMagicOnly)).toBe('image/png')
    expect(rasterImagePixelSize(pngMagicOnly)).toBeUndefined()
    expect(rasterImagePixelSize(Buffer.from('GIF89a'))).toBeUndefined()

    expect(sniffRasterImageMediaType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeUndefined()
  })
})
