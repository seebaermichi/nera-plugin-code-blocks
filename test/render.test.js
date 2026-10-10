import { describe, it, expect, beforeAll } from 'vitest'
import { create } from '../src/highlighters/highlight-js.js'
import { hasCodeBlock, rewriteHtml } from '../src/rewrite-html.js'
import { $, context, fence } from './helpers.js'

// Slice 1: the D3 markup and the D4–D6 rules with the default highlighter.

let hljs
const rewrite = (html, options) => rewriteHtml(html, context(hljs, options))

beforeAll(async () => {
    hljs = await create()
})

describe('rewriteHtml with highlight.js', () => {
    it('renders the D3 markup for a language-only block', async () => {
        const out = $(await rewrite(fence('yaml', 'title: Impressum')))
        const block = out('div.nera-code')
        expect(block).toHaveLength(1)
        expect(block.attr('class')).toBe('nera-code')
        expect(block.children().map((_, el) => el.attribs.class).get()).toEqual([
            'nera-code__bar',
            'nera-code__pre',
        ])
        expect(out('.nera-code__title').html()).toBe('yaml')
        expect(out('pre').attr('tabindex')).toBe('0')
        expect(out('code').attr('class')).toBe('hljs language-yaml')
        expect(out('code .hljs-attr').text()).toBe('title:')
        expect(out('code').text()).toBe('title: Impressum')
    })

    it('keeps words apart when the tags are stripped (plugin-search)', async () => {
        const out = await rewrite(fence('sh', 'npm run build'))
        const text = out.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        expect(text).toBe('terminal Copy npm run build')
    })

    it('renders the copy button hidden, with both labels', async () => {
        const out = $(await rewrite(fence('js', 'x'), { lang: 'de' }))
        const button = out('button.nera-code__copy')
        expect(button.attr('type')).toBe('button')
        expect(button.attr('data-nera-code-copy')).toBe('')
        expect(button.attr('data-done')).toBe('Kopiert')
        expect(button.attr('hidden')).toBeDefined()
        expect(button.text()).toBe('Kopieren')
    })

    it('shows the file name of lang:file in <b>', async () => {
        const out = $(await rewrite(fence('markdown:pages/impressum.md', 'Text')))
        expect(out('.nera-code__title').html()).toBe('<b>pages/impressum.md</b> · markdown')
        expect(out('code').attr('class')).toBe('hljs language-markdown')
    })

    it('keeps a file name with a colon', async () => {
        const out = $(await rewrite(fence('yaml:C:/x.yaml', 'a: 1')))
        expect(out('.nera-code__title b').text()).toBe('C:/x.yaml')
    })

    it('escapes the file name', async () => {
        const out = await rewrite(fence('js:<x>.js', '1'))
        expect(out).toContain('<b>&lt;x&gt;.js</b>')
    })

    it('escapes an unknown language without tokens and keeps the bar', async () => {
        const out = $(await rewrite(fence('nope', 'a & <b>')))
        expect(out('.nera-code__title').text()).toBe('nope')
        expect(out('code').attr('class')).toBe('hljs language-nope')
        expect(out('code').children()).toHaveLength(0)
        expect(out('code').html()).toBe('a &amp; &lt;b&gt;')
    })

    it('leaves a block without language untouched', async () => {
        const html = fence('', 'plain')
        expect(await rewrite(html)).toBe(html)
    })

    it('never touches inline code', async () => {
        const html = '<p>Use <code class="language-js">x</code></p>' + fence('js', 'y')
        const out = $(await rewrite(html))
        expect(out('p').html()).toBe('Use <code class="language-js">x</code>')
        expect(out('.nera-code')).toHaveLength(1)
    })

    it('escapes HTML in code exactly once', async () => {
        const out = await rewrite(fence('html', '<p class="x">a &amp; b</p>'))
        expect(out).not.toContain('&amp;lt;')
        expect(out).not.toContain('&amp;amp;amp;')
        expect($(out)('code').text()).toBe('<p class="x">a &amp; b</p>')
    })

    it('highlights Markdown frontmatter as YAML (D6)', async () => {
        const source = '---\ntitle: Impressum\n---\nText in **Markdown**.'
        const out = $(await rewrite(fence('markdown', source)))
        expect(out('code .hljs-attr').first().text()).toBe('title:')
        expect(out('code .hljs-strong').text()).toBe('**Markdown**')
        expect(out('code').text()).toBe(source)
    })

    it('highlights Markdown without frontmatter as Markdown', async () => {
        const source = '# Title\n\nText with `code`.'
        const out = $(await rewrite(fence('md', source)))
        expect(out('code .hljs-section').text()).toBe('# Title')
        expect(out('code .hljs-attr')).toHaveLength(0)
        expect(out('code').text()).toBe(source)
    })

    it('renders shell lines with the command as built_in (D4)', async () => {
        const source = 'npm install <pkg>\n  nera build\n\ncd site'
        const out = $(await rewrite(fence('bash', source)))
        expect(out('.nera-code').attr('class')).toBe('nera-code nera-code--shell')
        expect(out('.nera-code__title').text()).toBe('terminal')
        const lines = out('.nera-code__line')
        expect(lines).toHaveLength(4)
        expect(out('.nera-code__line .hljs-built_in').map((_, el) => out(el).text()).get()).toEqual([
            'npm',
            'nera',
            'cd',
        ])
        // The prompt is CSS only: the copied text is the source.
        expect(out('code').text()).toBe(source)
    })

    it('shows the file name of a shell block instead of "terminal"', async () => {
        const out = $(await rewrite(fence('sh:install.sh', 'echo hi')))
        expect(out('.nera-code__title').html()).toBe('<b>install.sh</b> · sh')
    })

    it('renders an empty block', async () => {
        const out = $(await rewrite('<pre><code class="language-js"></code></pre>'))
        expect(out('.nera-code')).toHaveLength(1)
        expect(out('code').text()).toBe('')
    })

    it('skips an already processed block', async () => {
        const once = await rewrite(fence('js', 'let a = 1'))
        expect(await rewrite(once)).toBe(once)
    })

    it('skips a pre with more than a code element', async () => {
        const html = '<pre><code class="language-js">a</code><code class="language-js">b</code></pre>'
        expect(await rewrite(html)).toBe(html)
    })

    it('returns a page without code as is', async () => {
        const html = '<p>No code here, only language-free prose.</p>'
        expect(hasCodeBlock(html)).toBe(false)
        expect(await rewrite(html)).toBe(html)
    })

    it('processes several blocks in document order', async () => {
        const html = fence('js', '1') + '<p>between</p>' + fence('', 'plain') + fence('css', 'a{}')
        const out = $(await rewrite(html))
        expect(out('.nera-code code').map((_, el) => out(el).attr('class')).get()).toEqual([
            'hljs language-js',
            'hljs language-css',
        ])
        expect(out('p').text()).toBe('between')
    })

    it('highlights Pug with zero config (D12)', async () => {
        const out = $(await rewrite(fence('pug', 'html(lang="en")\n  body.page#main')))
        expect(out('code .hljs-name').first().text()).toBe('html')
        expect(out('code .hljs-selector-class').text()).toBe('.page')
        expect(out('code .hljs-selector-id').text()).toBe('#main')
    })

    it('knows jade as an alias of pug', async () => {
        const out = $(await rewrite(fence('jade', 'p.lead Hi')))
        expect(out('code .hljs-selector-class').text()).toBe('.lead')
    })
})

describe('config in the markup (slice 2)', () => {
    it('bar: auto shows a bar only for a file name or a shell block', async () => {
        const options = { config: { bar: 'auto' } }
        const plain = $(await rewrite(fence('js', '1'), options))
        expect(plain('.nera-code__bar')).toHaveLength(0)
        expect(plain('.nera-code > pre.nera-code__pre')).toHaveLength(1)
        expect($(await rewrite(fence('js:a.js', '1'), options))('.nera-code__bar')).toHaveLength(1)
        expect($(await rewrite(fence('sh', 'ls'), options))('.nera-code__bar')).toHaveLength(1)
    })

    it('bar: never shows no bar at all', async () => {
        const out = $(await rewrite(fence('sh:x.sh', 'ls'), { config: { bar: 'never' } }))
        expect(out('.nera-code__bar')).toHaveLength(0)
        expect(out('.nera-code--shell .nera-code__line')).toHaveLength(1)
    })

    it('copy_button: false keeps the bar without a button', async () => {
        const out = $(await rewrite(fence('js', '1'), { config: { copy_button: false } }))
        expect(out('.nera-code__bar')).toHaveLength(1)
        expect(out('button')).toHaveLength(0)
    })

    it('shell_languages replaces the default set', async () => {
        const out = $(await rewrite(fence('ps1', 'Get-Item') + fence('bash', 'ls'), {
            config: { shell_languages: ['ps1'] },
        }))
        expect(out('.nera-code--shell code').attr('class')).toBe('hljs language-ps1')
        expect(out('.nera-code--shell')).toHaveLength(1)
    })

    it('uses configured labels', async () => {
        const out = $(await rewrite(fence('sh', 'ls'), {
            lang: 'es',
            config: { labels: { es: { copy: 'Copiar', copied: 'Copiado', terminal: 'terminal' } } },
        }))
        expect(out('button').text()).toBe('Copiar')
        expect(out('button').attr('data-done')).toBe('Copiado')
    })

    it('escapes labels', async () => {
        const out = await rewrite(fence('js', '1'), {
            config: { labels: { en: { copy: '<Copy>', copied: '"ok"' } } },
        })
        expect(out).toContain('data-done="&quot;ok&quot;"')
        expect(out).toContain('>&lt;Copy&gt;</button>')
    })
})
