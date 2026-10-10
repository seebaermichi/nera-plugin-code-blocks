import { escapeAttr, escapeHtml } from './escape.js'

// One code block → the D3 markup. The plugin owns everything around the code:
// the wrapper, the bar, the copy button, shell lines (D4) and the frontmatter
// split (D6). The adapter only turns `(code, lang)` into token HTML (D1).

const MARKDOWN = new Set(['markdown', 'md'])
const FRONTMATTER = /^(---\n[\s\S]*?\n---)(\n[\s\S]*)?$/

// D5: an unknown language is escaped without token spans.
async function tokens(adapter, code, lang) {
    if (!adapter.hasLanguage(lang)) return escapeHtml(code)
    return adapter.highlight(code, lang)
}

// D6: highlight.js reads a YAML frontmatter as Markdown and gets it wrong, so
// a leading `---` … `---` block is highlighted as YAML, the rest as Markdown.
async function markdownTokens(adapter, code, lang) {
    const match = FRONTMATTER.exec(code)
    if (!match || !adapter.hasLanguage(lang) || !adapter.hasLanguage('yaml')) {
        return tokens(adapter, code, lang)
    }
    const [, frontmatter, body = ''] = match
    return (await tokens(adapter, frontmatter, 'yaml')) + (await tokens(adapter, body, lang))
}

// D4: one span per line; the prompt comes from CSS, so it is never part of
// the copied text. The adapter may format a line itself (`shellLine`), else
// each line is highlighted on its own.
async function shellTokens(adapter, code, lang) {
    let line
    if (adapter.shellLine) line = (text) => adapter.shellLine(text, lang)
    else if (adapter.hasLanguage(lang)) line = (text) => adapter.highlight(text, lang)
    else line = (text) => escapeHtml(text)

    const lines = await Promise.all(code.split('\n').map(async (text) => line(text)))
    return lines.map((html) => `<span class="nera-code__line">${html}</span>`).join('\n')
}

function bar({ lang, file, shell }, { config, labels }) {
    const showBar =
        config.bar === 'always' || (config.bar === 'auto' && (file !== null || shell))
    if (!showBar) return ''

    let title
    if (file !== null) title = `<b>${escapeHtml(file)}</b> · ${escapeHtml(lang)}`
    else title = escapeHtml(shell ? labels.terminal : lang)

    const button = config.copy_button
        ? `<button class="nera-code__copy" type="button" data-nera-code-copy data-done="${escapeAttr(labels.copied)}" hidden>${escapeHtml(labels.copy)}</button>`
        : ''

    // Whitespace between the parts (ignored by the flex layout) keeps tools
    // that strip tags, like plugin-search, from gluing the words together.
    return `<div class="nera-code__bar"><span class="nera-code__title">${title}</span>${button ? `\n${button}` : ''}</div>\n`
}

/**
 * @param {{ code: string, lang: string, file: string|null }} block
 * @param {{ adapter: object, config: object, labels: object, shell: Set<string> }} context
 * @returns {Promise<string>} the block's HTML
 */
export async function renderBlock({ code, lang, file = null }, context) {
    const { adapter, shell: shellLanguages } = context
    const shell = shellLanguages.has(lang)

    let html
    if (shell) html = await shellTokens(adapter, code, lang)
    else if (MARKDOWN.has(lang)) html = await markdownTokens(adapter, code, lang)
    else html = await tokens(adapter, code, lang)

    const codeClass = [adapter.codeClass, `language-${lang}`].filter(Boolean).join(' ')
    const wrapperClass = shell ? 'nera-code nera-code--shell' : 'nera-code'

    return (
        `<div class="${wrapperClass}">\n` +
        bar({ lang, file, shell }, context) +
        `<pre class="nera-code__pre" tabindex="0"><code class="${escapeAttr(codeClass)}">${html}</code></pre>\n` +
        '</div>'
    )
}
