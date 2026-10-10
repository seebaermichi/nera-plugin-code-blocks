import { describe, it, expect } from 'vitest'
import { parseFence } from '../src/fence.js'

describe('parseFence (D2)', () => {
    it('reads the language', () => {
        expect(parseFence('language-yaml')).toEqual({ lang: 'yaml', file: null })
    })

    it('reads lang:file', () => {
        expect(parseFence('language-markdown:pages/impressum.md')).toEqual({
            lang: 'markdown',
            file: 'pages/impressum.md',
        })
    })

    it('splits on the first colon only', () => {
        expect(parseFence('language-yaml:C:/x.yaml')).toEqual({ lang: 'yaml', file: 'C:/x.yaml' })
    })

    it('treats an empty file name as none', () => {
        expect(parseFence('language-js:')).toEqual({ lang: 'js', file: null })
    })

    it('finds the class among others', () => {
        expect(parseFence('foo language-js bar')).toEqual({ lang: 'js', file: null })
    })

    it('returns null without a language', () => {
        expect(parseFence(undefined)).toBeNull()
        expect(parseFence('')).toBeNull()
        expect(parseFence('hljs')).toBeNull()
        expect(parseFence('language-:file.txt')).toBeNull()
        expect(parseFence('xlanguage-js')).toBeNull()
    })
})
