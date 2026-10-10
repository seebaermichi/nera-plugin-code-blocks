// D8. Button, "copied" and shell-title labels for a page language: the site's
// `labels.<lang>`, then the built-in `<lang>`, then the site's `en`, then the
// built-in `en`, key by key.

export const BUILTIN_LABELS = {
    en: { copy: 'Copy', copied: 'Copied', terminal: 'terminal' },
    de: { copy: 'Kopieren', copied: 'Kopiert', terminal: 'Terminal' },
}

/**
 * @param {object} configured `config.labels`
 * @param {string|undefined} lang `meta.lang || app.lang`
 * @returns {{ copy: string, copied: string, terminal: string }}
 */
export function labelsFor(configured = {}, lang) {
    const chain = [configured[lang], BUILTIN_LABELS[lang], configured.en, BUILTIN_LABELS.en]
    const pick = (key) => chain.find((set) => set && set[key] !== undefined)[key]
    return { copy: pick('copy'), copied: pick('copied'), terminal: pick('terminal') }
}
