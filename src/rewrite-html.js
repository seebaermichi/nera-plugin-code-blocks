import { load } from 'cheerio'
import { parseFence } from './fence.js'
import { renderBlock } from './render-block.js'

// D5. Only `pre > code.language-*` is processed; plain blocks and inline code
// keep markdown-it's markup, and a block inside `.nera-code` (a second run, or
// another plugin's markup) is skipped.

/**
 * Cheap pre-check, so pages without a fenced block with a language are
 * returned as they are, without a cheerio parse.
 *
 * @param {unknown} content
 */
export function hasCodeBlock(content) {
    return (
        typeof content === 'string' &&
        content.includes('language-') &&
        /<pre[\s>]/.test(content)
    )
}

/**
 * @param {string} content rendered page HTML
 * @param {object} context see `renderBlock`
 * @returns {Promise<string>} the rewritten HTML, or `content` itself when no
 *     block was processed
 */
export async function rewriteHtml(content, context) {
    if (!hasCodeBlock(content)) return content

    const $ = load(content, null, false)
    const jobs = []

    $('pre').each((_, pre) => {
        const $pre = $(pre)
        if ($pre.closest('.nera-code').length > 0) return

        const $children = $pre.children()
        if ($children.length !== 1 || !$children.is('code')) return

        const fence = parseFence($children.attr('class'))
        if (!fence) return

        // markdown-it ends every fenced block with a newline.
        const code = $children.text().replace(/\n$/, '')
        jobs.push(renderBlock({ ...fence, code }, context).then((html) => [$pre, html]))
    })

    if (jobs.length === 0) return content
    for (const [$pre, html] of await Promise.all(jobs)) $pre.replaceWith(html)
    return $.html()
}
