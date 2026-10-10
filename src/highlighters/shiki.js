// `highlighter: shiki` (D1). Shiki is an optional peer dependency, imported
// only when selected. It colors tokens with inline styles; with `themes`
// (the default, GitHub light and dark) every token also carries a
// `--shiki-dark` custom property a site can switch to in its dark mode CSS.
//
// `highlighter_options`: `theme` (one theme name) or `themes` (`{ light,
// dark, … }`), `defaultColor` (passed through to Shiki) and `langs` (grammars
// to load up front; every bundled language is also loaded on first use).

const DEFAULT_THEMES = { light: 'github-light', dark: 'github-dark' }

async function importShiki() {
    try {
        return await import('shiki')
    } catch (err) {
        if (err.code === 'ERR_MODULE_NOT_FOUND' && /'shiki'/.test(err.message)) {
            throw new Error(
                'plugin-code-blocks: `highlighter: shiki` needs the shiki package. ' +
                    'Install it in the site with `npm install shiki`.'
            )
        }
        throw err
    }
}

// The token markup Shiki puts inside `<code>`; the `<pre>` and `<code>`
// around it are the plugin's (D3).
const inner = (html) => /<code[^>]*>([\s\S]*)<\/code>\s*<\/pre>\s*$/.exec(html)[1]

/**
 * @param {object} [options] `highlighter_options`
 */
export async function create(options = {}) {
    const shiki = await importShiki()

    const colors = options.theme
        ? { theme: options.theme }
        : {
            themes: options.themes || DEFAULT_THEMES,
            ...(options.defaultColor !== undefined && { defaultColor: options.defaultColor }),
        }
    const themes = colors.theme ? [colors.theme] : Object.values(colors.themes)

    const highlighter = await shiki.createHighlighter({
        themes,
        langs: Array.isArray(options.langs) ? options.langs : [],
    })
    const loaded = () => highlighter.getLoadedLanguages()
    const hasLanguage = (lang) => lang in shiki.bundledLanguages || loaded().includes(lang)

    return {
        name: 'shiki',
        codeClass: 'shiki',
        hasLanguage,
        async highlight(code, lang) {
            if (!loaded().includes(lang)) await highlighter.loadLanguage(lang)
            return inner(highlighter.codeToHtml(code, { lang, ...colors }))
        },
    }
}
