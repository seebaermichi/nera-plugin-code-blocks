import path from 'path'
import { getConfig } from '@nera-static/plugin-utils'
import { warn } from './warn.js'

// `config/code-blocks.yaml` is optional and every key has a default (ROADMAP
// "Configuration"). `getConfig` returns `{}` for a missing file, so each key
// gets its own JS fallback here. A key with a bad value warns and falls back to
// its default rather than failing the build.

export const BARS = ['always', 'auto', 'never']
export const BUILTIN_HIGHLIGHTERS = ['highlight.js', 'shiki', 'none']
export const LABEL_KEYS = ['copy', 'copied', 'terminal']

export function defaults() {
    return {
        bar: 'always',
        copy_button: true,
        shell_languages: ['sh', 'bash', 'shell', 'zsh', 'console'],
        labels: {},
        assets: true,
        highlighter: 'highlight.js',
        highlighter_options: {},
    }
}

const isPlainObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

const show = (value) => JSON.stringify(value)

function bad(key, value, fallback) {
    warn(`config/code-blocks.yaml: invalid ${key} ${show(value)}, using ${show(fallback)}`)
    return fallback
}

const isPath = (value) => /^(\.{1,2}\/|\/)/.test(value) || /^[A-Za-z]:[\\/]/.test(value)

function readLabels(value, fallback) {
    if (!isPlainObject(value)) return bad('labels', value, fallback)

    const labels = {}
    for (const [lang, set] of Object.entries(value)) {
        if (!isPlainObject(set)) {
            warn(`config/code-blocks.yaml: ignoring labels.${lang}, expected a mapping`)
            continue
        }
        labels[lang] = {}
        for (const [key, text] of Object.entries(set)) {
            if (!LABEL_KEYS.includes(key)) {
                warn(`config/code-blocks.yaml: ignoring unknown label labels.${lang}.${key}`)
            } else if (typeof text !== 'string' && typeof text !== 'number') {
                warn(`config/code-blocks.yaml: ignoring labels.${lang}.${key}, expected text`)
            } else {
                labels[lang][key] = String(text)
            }
        }
    }
    return labels
}

const readers = {
    bar: (value, fallback) => (BARS.includes(value) ? value : bad('bar', value, fallback)),
    copy_button: (value, fallback) =>
        typeof value === 'boolean' ? value : bad('copy_button', value, fallback),
    assets: (value, fallback) =>
        typeof value === 'boolean' ? value : bad('assets', value, fallback),
    shell_languages: (value, fallback) =>
        Array.isArray(value) && value.every((l) => typeof l === 'string' && l !== '')
            ? [...new Set(value)]
            : bad('shell_languages', value, fallback),
    labels: readLabels,
    highlighter: (value, fallback) =>
        typeof value === 'string' &&
        (BUILTIN_HIGHLIGHTERS.includes(value) || isPath(value))
            ? value
            : bad('highlighter', value, fallback),
    highlighter_options: (value, fallback) =>
        isPlainObject(value) ? value : bad('highlighter_options', value, fallback),
}

/**
 * Merge a raw config object over the defaults, key by key, with validation.
 * Pure apart from warnings; `normalizeConfig({})` is the full default config.
 *
 * @param {object} raw parsed `config/code-blocks.yaml`
 * @returns {object} complete, validated config
 */
export function normalizeConfig(raw) {
    const config = defaults()
    if (raw === null || raw === undefined) return config
    if (!isPlainObject(raw)) {
        warn('config/code-blocks.yaml: expected a mapping at the top level, using defaults')
        return config
    }

    for (const [key, value] of Object.entries(raw)) {
        const read = readers[key]
        if (!read) {
            warn(`config/code-blocks.yaml: ignoring unknown key ${show(key)}`)
            continue
        }
        // A key present but empty reads as null; treat it like an absent key.
        if (value === null) continue
        config[key] = read(value, config[key])
    }
    return config
}

/**
 * Read and normalize the site's `config/code-blocks.yaml`. Called inside the
 * hooks, not at module scope, so each build (and each test) sees the current
 * file (D10).
 *
 * @param {{ cwd?: string, app?: object }} [options] `app.folders.config` is
 *     honoured when set, like the rest of the pipeline
 */
export function loadConfig({ cwd = process.cwd(), app } = {}) {
    const folder = app?.folders?.config || 'config'
    return normalizeConfig(getConfig(path.resolve(cwd, folder, 'code-blocks.yaml')))
}
