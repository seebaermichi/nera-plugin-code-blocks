// @nera-static/plugin-code-blocks — build-time highlighted code blocks.
//
// `getMetaData` rewrites every fenced block with a language in the rendered
// pages into the D3 markup: a header bar with the file name (or "terminal"),
// a copy button and the code highlighted by the configured highlighter
// (highlight.js by default). `getAssets` (core >= 4.13.0) ships the default
// stylesheet and copy script to `public/_nera/`. See ROADMAP.md for the
// decisions (D1–D12) behind each step.
import path from 'path'
import { fileURLToPath } from 'url'
import { loadConfig } from './src/config.js'
import { assertCoreVersion, coreVersion } from './src/guard.js'
import { loadHighlighter } from './src/highlighters/index.js'
import { labelsFor } from './src/labels.js'
import { hasCodeBlock, rewriteHtml } from './src/rewrite-html.js'

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets')

export const ASSET_FILES = [
    { file: 'nera-code.css', to: '_nera/code-blocks.css' },
    { file: 'nera-code.js', to: '_nera/code-blocks.js' },
]

// The config `getMetaData` read, for `getAssets` in the same build. Core calls
// the two hooks in that order, once per build, so one slot is enough.
let current = null

export async function getMetaData({ app, pagesData }) {
    const cwd = process.cwd()
    const config = loadConfig({ cwd, app })
    if (config.assets) assertCoreVersion(coreVersion(cwd))
    current = config

    const shell = new Set(config.shell_languages)
    // Loaded on the first page that needs it, so a site without code never
    // starts a highlighter (or fails on a missing optional one).
    let adapter = null
    const getAdapter = () =>
        (adapter ??= loadHighlighter(config.highlighter, config.highlighter_options, cwd))

    return Promise.all(
        pagesData.map(async (page) => {
            if (!hasCodeBlock(page.content)) return page

            const labels = labelsFor(config.labels, page.meta?.lang || app?.lang)
            const content = await rewriteHtml(page.content, {
                adapter: await getAdapter(),
                config,
                labels,
                shell,
            })
            return content === page.content ? page : { ...page, content }
        })
    )
}

export function getAssets({ app } = {}) {
    const config = current || loadConfig({ cwd: process.cwd(), app })
    current = null
    if (!config.assets) return []
    return ASSET_FILES.map(({ file, to }) => ({ from: path.join(ASSETS, file), to }))
}
