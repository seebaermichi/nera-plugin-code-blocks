import path from 'path'
import { describe, it, expect, beforeEach } from 'vitest'
import { clearHighlighterCache, loadHighlighter, validateAdapter } from '../src/highlighters/index.js'
import { rewriteHtml } from '../src/rewrite-html.js'
import { $, context, fence, tempDir, write } from './helpers.js'

// D11 / acceptance 7: the same fixtures against every built-in adapter. The
// wrapper markup (everything outside <code>) and the code's text must be the
// same whichever highlighter runs; only the tokens inside <code> differ.

const FIXTURES = [
    ['yaml', 'title: Impressum\nlayout: page.pug'],
    ['markdown:pages/impressum.md', '---\ntitle: Impressum\n---\nText in **Markdown**.'],
    ['bash', 'npm install @nera-static/nera\nnera build'],
    ['pug', 'html(lang="en")\n  body.page\n    h1= title'],
    ['html', '<p class="x">a &amp; b</p>'],
    ['js:index.js', 'export function getMetaData() {}'],
    ['nope', 'not a language <at> all'],
]

const page = FIXTURES.map(([info, code]) => fence(info, code)).join('<p>between</p>\n')

// The markup with every <code>'s content replaced by its text: what the
// plugin owns.
function frame(html) {
    const doc = $(html)
    doc('code').each((_, el) => {
        const text = doc(el).text()
        doc(el).text(text).removeAttr('class')
    })
    return doc.html()
}

beforeEach(() => clearHighlighterCache())

describe.each(['highlight.js', 'shiki', 'none'])('adapter %s', (name) => {
    it('renders the same frame and text as highlight.js', async () => {
        const reference = await rewriteHtml(page, context(await loadHighlighter('highlight.js')))
        const out = await rewriteHtml(page, context(await loadHighlighter(name)))
        expect(frame(out)).toBe(frame(reference))

        const doc = $(out)
        expect(doc('code').map((_, el) => doc(el).text()).get()).toEqual(
            FIXTURES.map(([, code]) => code)
        )
    })

    it('sets its code class next to the language', async () => {
        const adapter = await loadHighlighter(name)
        const doc = $(await rewriteHtml(fence('yaml', 'a: 1'), context(adapter)))
        const expected = { 'highlight.js': 'hljs language-yaml', shiki: 'shiki language-yaml', none: 'language-yaml' }
        expect(doc('code').attr('class')).toBe(expected[name])
    })
})

describe('built-in adapters', () => {
    it('none emits no tokens', async () => {
        const doc = $(await rewriteHtml(page, context(await loadHighlighter('none'))))
        expect(doc('code span:not(.nera-code__line)')).toHaveLength(0)
    })

    it('shiki emits inline colors with a dark variant and knows Pug', async () => {
        const adapter = await loadHighlighter('shiki')
        expect(adapter.hasLanguage('pug')).toBe(true)
        expect(adapter.hasLanguage('jade')).toBe(true)
        const html = await rewriteHtml(fence('pug', 'p.lead Hi'), context(adapter))
        expect(html).toMatch(/style="color:#[0-9A-Fa-f]{6};--shiki-dark:#[0-9A-Fa-f]{6}"/)
    })

    it('shiki takes a single theme', async () => {
        const adapter = await loadHighlighter('shiki', { theme: 'nord' })
        const html = await rewriteHtml(fence('js', 'let a = 1'), context(adapter))
        expect(html).toMatch(/style="color:#/)
        expect(html).not.toContain('--shiki-dark')
    })

    it('caches an adapter per name and options', async () => {
        const a = loadHighlighter('none')
        expect(loadHighlighter('none')).toBe(a)
        expect(loadHighlighter('none', { x: 1 })).not.toBe(a)
    })
})

describe('a site adapter (D1)', () => {
    it('loads an adapter object from a path relative to the site root', async () => {
        const root = tempDir()
        write(
            path.join(root, 'hl.js'),
            `export default {
                name: 'upper',
                codeClass: 'upper',
                hasLanguage: (lang) => lang === 'js',
                highlight: async (code) => '<i>' + code.toUpperCase() + '</i>',
            }\n`
        )
        const adapter = await loadHighlighter('./hl.js', {}, root)
        const doc = $(await rewriteHtml(fence('js', 'ab') + fence('py', 'x'), context(adapter)))
        expect(doc('code').first().attr('class')).toBe('upper language-js')
        expect(doc('code i').text()).toBe('AB')
        expect(doc('code').last().html()).toBe('x')
    })

    it('calls a factory with the options', async () => {
        const root = tempDir()
        write(
            path.join(root, 'factory.js'),
            `export default (options) => ({
                hasLanguage: () => true,
                highlight: (code) => options.prefix + code,
            })\n`
        )
        const adapter = await loadHighlighter('./factory.js', { prefix: '» ' }, root)
        const doc = $(await rewriteHtml(fence('js', 'x'), context(adapter)))
        expect(doc('code').text()).toBe('» x')
    })

    it('fails clearly for a missing or broken adapter', async () => {
        const root = tempDir()
        await expect(loadHighlighter('./missing.js', {}, root)).rejects.toThrow(
            /could not load the highlighter "\.\/missing\.js"/
        )
        write(path.join(root, 'broken.js'), 'export default { highlight: () => "" }\n')
        await expect(loadHighlighter('./broken.js', {}, root)).rejects.toThrow(
            /"\.\/broken\.js" has no hasLanguage/
        )
    })

    it('validateAdapter lists every problem', () => {
        expect(() => validateAdapter({ codeClass: 1, shellLine: 'x' }, 'x')).toThrow(
            /no hasLanguage\(lang\), has no highlight\(code, lang\), has a codeClass that is not a string, has a shellLine that is not a function/
        )
    })
})

describe('highlight.js extra languages (D11)', () => {
    it('registers a grammar from a path', async () => {
        const root = tempDir()
        write(
            path.join(root, 'grammar.js'),
            'export default () => ({ name: \'Greet\', contains: [{ scope: \'keyword\', begin: /hello/ }] })\n'
        )
        const adapter = await loadHighlighter('highlight.js', { languages: { greet: './grammar.js' } }, root)
        const doc = $(await rewriteHtml(fence('greet', 'hello world'), context(adapter)))
        expect(doc('code .hljs-keyword').text()).toBe('hello')
    })

    it('fails clearly for a missing grammar', async () => {
        await expect(
            loadHighlighter('highlight.js', { languages: { x: 'no-such-grammar' } }, tempDir())
        ).rejects.toThrow(/could not load the highlight\.js grammar "x" from "no-such-grammar"/)
    })
})
