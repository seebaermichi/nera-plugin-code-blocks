import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { load } from 'cheerio'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import run from '@nera-static/core'

// End to end through core's real pipeline (ROADMAP slices 1 and 3): a
// throwaway site in a temp dir loads this repo's index.js as a local plugin,
// and `run()` builds it with core's own markdown-it, including the
// `getAssets` copy into public/.

const pluginEntry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.js')

const write = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
}

const FENCE = '```'

const POST = [
    '---',
    'title: Post',
    'layout: layout.pug',
    'lang: de',
    '---',
    'Inline `code` stays.',
    '',
    `${FENCE}markdown:pages/impressum.md`,
    '---',
    'title: Impressum',
    '---',
    'Text in **Markdown**.',
    FENCE,
    '',
    `${FENCE}bash`,
    'npm install @nera-static/plugin-code-blocks',
    FENCE,
    '',
    `${FENCE}pug`,
    'html(lang="en")',
    '  body.page',
    FENCE,
    '',
    `${FENCE}html`,
    '<p class="x">a &amp; b</p>',
    FENCE,
    '',
    FENCE,
    'plain block',
    FENCE,
    '',
].join('\n')

function makeSite(root, { codeBlocksYaml } = {}) {
    write(path.join(root, 'package.json'), JSON.stringify({ name: 'demo', private: true, type: 'module' }))
    write(path.join(root, 'config', 'app.yaml'), 'name: Demo\nlang: en\n')
    if (codeBlocksYaml) write(path.join(root, 'config', 'code-blocks.yaml'), codeBlocksYaml)
    write(path.join(root, 'views', 'layout.pug'), 'doctype html\nhtml\n  body\n    main!= content')
    write(
        path.join(root, 'plugins', 'code-blocks', 'index.js'),
        `export * from '${pathToFileURL(pluginEntry).href}'\n`
    )
    write(path.join(root, 'pages', 'post.md'), POST)
    write(path.join(root, 'pages', 'plain.md'), '---\ntitle: Plain\nlayout: layout.pug\n---\nNo code.\n')
}

const folders = (root) => ({
    config: path.join(root, 'config'),
    pages: path.join(root, 'pages'),
    views: path.join(root, 'views'),
    assets: path.join(root, 'assets'),
    dist: path.join(root, 'public'),
    plugins: path.join(root, 'plugins'),
})

async function build(root) {
    const prev = process.cwd()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.chdir(root)
    try {
        await run({ folders: folders(root) })
        return warn.mock.calls.map((c) => c.join(' '))
    } finally {
        process.chdir(prev)
        log.mockRestore()
        warn.mockRestore()
    }
}

const html = (root, rel) => load(fs.readFileSync(path.join(root, 'public', rel), 'utf-8'))

describe('a site with code blocks', () => {
    let root
    let warnings

    beforeAll(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'nera-code-blocks-int-'))
        makeSite(root)
        warnings = await build(root)
    }, 60_000)

    afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

    it('builds without warnings', () => {
        expect(warnings).toEqual([])
    })

    it('renders every fenced block with a language in the D3 markup', () => {
        const $ = html(root, 'post.html')
        expect($('.nera-code')).toHaveLength(4)
        expect($('.nera-code__title').map((_, el) => $(el).html()).get()).toEqual([
            '<b>pages/impressum.md</b> · markdown',
            'Terminal',
            'pug',
            'html',
        ])
        expect($('button.nera-code__copy').first().text()).toBe('Kopieren')
    })

    it('keeps the source text of every block (acceptance 3)', () => {
        const $ = html(root, 'post.html')
        expect($('.nera-code code').map((_, el) => $(el).text()).get()).toEqual([
            '---\ntitle: Impressum\n---\nText in **Markdown**.',
            'npm install @nera-static/plugin-code-blocks',
            'html(lang="en")\n  body.page',
            '<p class="x">a &amp; b</p>',
        ])
    })

    it('highlights Markdown frontmatter, shell commands and Pug', () => {
        const $ = html(root, 'post.html')
        expect($('.language-markdown .hljs-attr').text()).toBe('title:')
        expect($('.nera-code--shell .nera-code__line .hljs-built_in').text()).toBe('npm')
        expect($('.language-pug .hljs-selector-class').text()).toBe('.page')
    })

    it('leaves plain blocks and inline code alone (acceptance 2)', () => {
        const $ = html(root, 'post.html')
        expect($('main > pre > code').text()).toBe('plain block\n')
        expect($('p code').text()).toBe('code')
    })

    it('copies the stylesheet and script to public/_nera/', () => {
        const dir = path.join(root, 'public', '_nera')
        expect(fs.readdirSync(dir).sort()).toEqual(['code-blocks.css', 'code-blocks.js'])
        expect(fs.readFileSync(path.join(dir, 'code-blocks.css'), 'utf-8')).toContain('.nera-code__bar')
    })
})

describe('a site with assets: false', () => {
    let root

    beforeAll(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'nera-code-blocks-int-'))
        makeSite(root, { codeBlocksYaml: 'assets: false\nbar: auto\n' })
        await build(root)
    }, 60_000)

    afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

    it('gets no files in public/_nera/ (acceptance 5)', () => {
        expect(fs.existsSync(path.join(root, 'public', '_nera'))).toBe(false)
    })

    it('still renders the blocks with the configured bar', () => {
        const $ = html(root, 'post.html')
        expect($('.nera-code')).toHaveLength(4)
        expect($('.nera-code__bar')).toHaveLength(2)
    })
})
