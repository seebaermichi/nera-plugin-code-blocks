import fs from 'fs'
import os from 'os'
import path from 'path'
import { load } from 'cheerio'
import { normalizeConfig } from '../src/config.js'
import { labelsFor } from '../src/labels.js'

export const write = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
}

export const tempDir = (prefix = 'nera-code-blocks-') =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

/** A rewrite context with the default config, overridable per key. */
export function context(adapter, { config = {}, lang = 'en' } = {}) {
    const normalized = normalizeConfig(config)
    return {
        adapter,
        config: normalized,
        labels: labelsFor(normalized.labels, lang),
        shell: new Set(normalized.shell_languages),
    }
}

/** markdown-it's markup for a fenced block. */
export const fence = (info, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    return info
        ? `<pre><code class="language-${info}">${escaped}\n</code></pre>\n`
        : `<pre><code>${escaped}\n</code></pre>\n`
}

export const $ = (html) => load(html, null, false)
