// D2. markdown-it keeps only the first word of the fence info string and
// renders it as `class="language-<word>"`, so ```markdown:pages/x.md arrives
// here as `language-markdown:pages/x.md`. The language is everything before
// the first `:`, the file name everything after it (`yaml:C:/x.yaml` keeps
// `C:/x.yaml`).

/**
 * Language and optional file name from a `<code>` class attribute, or `null`
 * when it has no `language-*` class (a plain block, D5).
 *
 * @param {string|undefined} classAttr
 * @returns {{ lang: string, file: string|null }|null}
 */
export function parseFence(classAttr) {
    const match = /(?:^|\s)language-(\S+)/.exec(classAttr || '')
    if (!match) return null

    const info = match[1]
    const colon = info.indexOf(':')
    const lang = colon === -1 ? info : info.slice(0, colon)
    const file = colon === -1 ? '' : info.slice(colon + 1)
    if (lang === '') return null

    return { lang, file: file || null }
}
