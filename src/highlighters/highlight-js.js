import { createRequire } from 'module'
import path from 'path'
import { pathToFileURL } from 'url'
import hljs from 'highlight.js'
import pug from '@nera-static/highlightjs-pug'
import { escapeHtml } from '../escape.js'

// The default highlighter (D1): the full highlight.js build plus Pug from
// `@nera-static/highlightjs-pug` (D12), which registers its `jade` alias
// itself. Emits classes, not inline styles, so a theme colors tokens from CSS.
//
// `highlighter_options.languages` registers more grammars: a mapping of
// language name → module, where the module is a package name or a path
// relative to the site root and its default export is a highlight.js language
// function, e.g. `{ languages: { cypher: highlightjs-cypher } }`.

const isPath = (spec) => /^(\.{1,2}\/|\/)/.test(spec)

async function importFromSite(spec, cwd) {
    const file = isPath(spec)
        ? path.resolve(cwd, spec)
        : createRequire(path.join(cwd, 'package.json')).resolve(spec)
    return import(pathToFileURL(file).href)
}

async function registerExtraLanguages(languages, cwd) {
    if (languages === undefined || languages === null) return
    if (typeof languages !== 'object' || Array.isArray(languages)) {
        throw new Error(
            'plugin-code-blocks: highlighter_options.languages must be a mapping of language name to module'
        )
    }
    for (const [name, spec] of Object.entries(languages)) {
        let mod
        try {
            mod = await importFromSite(String(spec), cwd)
        } catch (err) {
            throw new Error(
                `plugin-code-blocks: could not load the highlight.js grammar "${name}" from "${spec}" (${err.message})`
            )
        }
        const language = mod.default ?? mod
        if (typeof language !== 'function') {
            throw new Error(
                `plugin-code-blocks: "${spec}" does not export a highlight.js language function as default`
            )
        }
        hljs.registerLanguage(name, language)
    }
}

/**
 * @param {object} [options] `highlighter_options`
 * @param {{ cwd: string }} context
 */
export async function create(options = {}, { cwd = process.cwd() } = {}) {
    hljs.registerLanguage('pug', pug)
    await registerExtraLanguages(options.languages, cwd)

    return {
        name: 'highlight.js',
        codeClass: 'hljs',
        hasLanguage: (lang) => Boolean(hljs.getLanguage(lang)),
        highlight: (code, lang) =>
            hljs.highlight(code, { language: lang, ignoreIllegals: true }).value,
        // D4: the first word of a shell line is the command.
        shellLine(line) {
            const [, space, command, rest] = /^(\s*)(\S*)(.*)$/.exec(line)
            const cmd = command ? `<span class="hljs-built_in">${escapeHtml(command)}</span>` : ''
            return escapeHtml(space) + cmd + escapeHtml(rest)
        },
    }
}
