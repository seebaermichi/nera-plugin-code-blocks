import { describe, it, expect } from 'vitest'
import { labelsFor } from '../src/labels.js'

describe('labelsFor (D8)', () => {
    it('has built-in English and German', () => {
        expect(labelsFor({}, 'en')).toEqual({ copy: 'Copy', copied: 'Copied', terminal: 'terminal' })
        expect(labelsFor({}, 'de')).toEqual({ copy: 'Kopieren', copied: 'Kopiert', terminal: 'Terminal' })
    })

    it('falls back to English for an unknown or missing language', () => {
        expect(labelsFor({}, 'fr').copy).toBe('Copy')
        expect(labelsFor({}, undefined).copy).toBe('Copy')
    })

    it('prefers configured labels, key by key', () => {
        const labels = labelsFor({ de: { copy: 'Kopie' } }, 'de')
        expect(labels).toEqual({ copy: 'Kopie', copied: 'Kopiert', terminal: 'Terminal' })
    })

    it('adds a language through config, falling back to configured English', () => {
        const configured = { es: { copy: 'Copiar' }, en: { copied: 'Done' } }
        expect(labelsFor(configured, 'es')).toEqual({ copy: 'Copiar', copied: 'Done', terminal: 'terminal' })
    })
})
