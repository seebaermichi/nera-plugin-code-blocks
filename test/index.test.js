import path from 'path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getAssets, getMetaData } from '../index.js'
import { clearHighlighterCache } from '../src/highlighters/index.js'
import { $, fence, tempDir, write } from './helpers.js'

let prevCwd
let root

beforeEach(() => {
    prevCwd = process.cwd()
    root = tempDir()
    process.chdir(root)
    clearHighlighterCache()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    process.chdir(prevCwd)
    vi.restoreAllMocks()
})

const config = (yaml) => write(path.join(root, 'config', 'code-blocks.yaml'), yaml)

describe('getMetaData', () => {
    it('returns an array of pages, rewriting only those with code', async () => {
        const plain = { content: '<p>Hi</p>', meta: { title: 'a' } }
        const code = { content: fence('js', 'x'), meta: { title: 'b' }, extra: 1 }
        const result = await getMetaData({ app: { lang: 'en' }, pagesData: [plain, code] })
        expect(Array.isArray(result)).toBe(true)
        expect(result[0]).toBe(plain)
        expect(result[1]).not.toBe(code)
        expect(result[1]).toMatchObject({ meta: { title: 'b' }, extra: 1 })
        expect(result[1].content).toContain('class="nera-code"')
    })

    it('keeps a page whose blocks have no language', async () => {
        const page = { content: fence('', 'plain'), meta: {} }
        const [result] = await getMetaData({ app: {}, pagesData: [page] })
        expect(result).toBe(page)
    })

    it('labels by meta.lang, then app.lang (D8)', async () => {
        const pagesData = [
            { content: fence('js', 'x'), meta: { lang: 'en' } },
            { content: fence('js', 'x'), meta: {} },
        ]
        const result = await getMetaData({ app: { lang: 'de' }, pagesData })
        expect($(result[0].content)('button').text()).toBe('Copy')
        expect($(result[1].content)('button').text()).toBe('Kopieren')
    })

    it('reads the site config on every call (D10)', async () => {
        const pagesData = [{ content: fence('js', 'x'), meta: {} }]
        config('bar: never\n')
        expect((await getMetaData({ app: {}, pagesData }))[0].content).not.toContain('nera-code__bar')
        config('bar: always\n')
        expect((await getMetaData({ app: {}, pagesData }))[0].content).toContain('nera-code__bar')
    })

    it('does not load the highlighter for a site without code', async () => {
        config('highlighter: ./missing.js\n')
        const pagesData = [{ content: '<p>Hi</p>', meta: {} }]
        await expect(getMetaData({ app: {}, pagesData })).resolves.toEqual(pagesData)
    })

    it('fails loudly for a broken highlighter when there is code', async () => {
        config('highlighter: ./missing.js\n')
        const pagesData = [{ content: fence('js', 'x'), meta: {} }]
        await expect(getMetaData({ app: {}, pagesData })).rejects.toThrow(/missing\.js/)
    })

    it('fails on a core older than 4.13.0 unless assets are off (D7)', async () => {
        write(path.join(root, 'package.json'), '{"name":"site"}')
        write(
            path.join(root, 'node_modules', '@nera-static', 'core', 'package.json'),
            '{"name":"@nera-static/core","version":"4.12.0"}'
        )
        await expect(getMetaData({ app: {}, pagesData: [] })).rejects.toThrow(/4\.12\.0 is too old/)
        config('assets: false\n')
        await expect(getMetaData({ app: {}, pagesData: [] })).resolves.toEqual([])
    })
})

describe('getAssets (D7)', () => {
    it('returns the stylesheet and the script under _nera/', async () => {
        await getMetaData({ app: {}, pagesData: [] })
        const assets = getAssets({ app: {}, pagesData: [] })
        expect(assets.map((a) => a.to)).toEqual(['_nera/code-blocks.css', '_nera/code-blocks.js'])
        for (const { from } of assets) {
            expect(path.isAbsolute(from)).toBe(true)
            expect(from).toMatch(/assets[\\/]nera-code\.(css|js)$/)
        }
    })

    it('returns nothing with assets: false', async () => {
        config('assets: false\n')
        await getMetaData({ app: {}, pagesData: [] })
        expect(getAssets({ app: {}, pagesData: [] })).toEqual([])
    })

    it('reads the config itself when called alone', () => {
        config('assets: false\n')
        expect(getAssets({ app: {} })).toEqual([])
    })
})
