import { escapeHtml } from '../escape.js'

// `highlighter: none` (D1): the frame (bar, copy button, shell lines) without
// any token markup. Every block is treated like one in an unknown language.
export function create() {
    return {
        name: 'none',
        codeClass: '',
        hasLanguage: () => false,
        highlight: (code) => escapeHtml(code),
    }
}
