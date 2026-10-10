import path from 'path'
import { pathToFileURL } from 'url'

// D1/D11. Picks the adapter for `config.highlighter` and caches it per
// highlighter, options and site root, so a build creates it once (Shiki's
// engine is expensive to start) and a later build in the same process reuses
// it. A failed creation is not cached, so the next build tries again.

const BUILTIN = {
    'highlight.js': () => import('./highlight-js.js'),
    shiki: () => import('./shiki.js'),
    none: () => import('./none.js'),
}

const cache = new Map()

/**
 * Check that an adapter has the D1 interface; throw a message naming the
 * source otherwise.
 */
export function validateAdapter(adapter, source) {
    const problems = []
    if (!adapter || typeof adapter !== 'object') problems.push('is not an object')
    else {
        if (typeof adapter.hasLanguage !== 'function') problems.push('has no hasLanguage(lang)')
        if (typeof adapter.highlight !== 'function') problems.push('has no highlight(code, lang)')
        if (adapter.codeClass !== undefined && typeof adapter.codeClass !== 'string') {
            problems.push('has a codeClass that is not a string')
        }
        if (adapter.shellLine !== undefined && typeof adapter.shellLine !== 'function') {
            problems.push('has a shellLine that is not a function')
        }
    }
    if (problems.length > 0) {
        throw new Error(`plugin-code-blocks: the highlighter ${source} ${problems.join(', ')}`)
    }
    return adapter
}

// A site's own adapter: default export is the adapter object, or a function
// `(options, { cwd })` returning it (or a promise of it).
async function loadSiteAdapter(spec, options, cwd) {
    const file = path.resolve(cwd, spec)
    let mod
    try {
        mod = await import(pathToFileURL(file).href)
    } catch (err) {
        throw new Error(
            `plugin-code-blocks: could not load the highlighter "${spec}" (${err.message})`
        )
    }
    const exported = mod.default
    const adapter =
        typeof exported === 'function' ? await exported(options, { cwd }) : exported
    return validateAdapter(adapter, `"${spec}"`)
}

async function createAdapter(name, options, cwd) {
    if (BUILTIN[name]) {
        const { create } = await BUILTIN[name]()
        return validateAdapter(await create(options, { cwd }), `"${name}"`)
    }
    return loadSiteAdapter(name, options, cwd)
}

/**
 * @param {string} name `config.highlighter`
 * @param {object} options `config.highlighter_options`
 * @param {string} cwd site root
 * @returns {Promise<object>} the adapter
 */
export function loadHighlighter(name, options = {}, cwd = process.cwd()) {
    const key = JSON.stringify([name, options, cwd])
    if (!cache.has(key)) {
        const promise = createAdapter(name, options, cwd)
        promise.catch(() => cache.delete(key))
        cache.set(key, promise)
    }
    return cache.get(key)
}

/** Forget every cached adapter (tests). */
export function clearHighlighterCache() {
    cache.clear()
}
