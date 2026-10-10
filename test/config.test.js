import path from 'path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defaults, loadConfig, normalizeConfig } from '../src/config.js'
import { tempDir, write } from './helpers.js'

let warn

beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('normalizeConfig', () => {
    it('returns the defaults for an empty config', () => {
        expect(normalizeConfig({})).toEqual(defaults())
        expect(normalizeConfig(null)).toEqual(defaults())
        expect(warn).not.toHaveBeenCalled()
    })

    it('defaults match the ROADMAP configuration', () => {
        expect(defaults()).toEqual({
            bar: 'always',
            copy_button: true,
            shell_languages: ['sh', 'bash', 'shell', 'zsh', 'console'],
            labels: {},
            assets: true,
            highlighter: 'highlight.js',
            highlighter_options: {},
        })
    })

    it('accepts valid values', () => {
        const config = normalizeConfig({
            bar: 'auto',
            copy_button: false,
            shell_languages: ['ps1', 'ps1'],
            labels: { fr: { copy: 'Copier' } },
            assets: false,
            highlighter: 'shiki',
            highlighter_options: { theme: 'nord' },
        })
        expect(config).toEqual({
            bar: 'auto',
            copy_button: false,
            shell_languages: ['ps1'],
            labels: { fr: { copy: 'Copier' } },
            assets: false,
            highlighter: 'shiki',
            highlighter_options: { theme: 'nord' },
        })
    })

    it('accepts a path as highlighter', () => {
        expect(normalizeConfig({ highlighter: './hl.js' }).highlighter).toBe('./hl.js')
        expect(normalizeConfig({ highlighter: '../x/hl.js' }).highlighter).toBe('../x/hl.js')
        expect(normalizeConfig({ highlighter: '/abs/hl.js' }).highlighter).toBe('/abs/hl.js')
    })

    it.each([
        ['bar', 'sometimes'],
        ['copy_button', 'yes'],
        ['assets', 1],
        ['shell_languages', 'bash'],
        ['labels', 'Copy'],
        ['highlighter', 'prism'],
        ['highlighter_options', []],
    ])('warns and falls back for an invalid %s', (key, value) => {
        expect(normalizeConfig({ [key]: value })[key]).toEqual(defaults()[key])
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(`invalid ${key}`))
    })

    it('treats an empty key as absent', () => {
        expect(normalizeConfig({ bar: null }).bar).toBe('always')
        expect(warn).not.toHaveBeenCalled()
    })

    it('warns about unknown keys and labels', () => {
        normalizeConfig({ colour: 'red', labels: { en: { paste: 'x' }, de: 'nope' } })
        const messages = warn.mock.calls.map((c) => c[0]).join('\n')
        expect(messages).toMatch(/unknown key "colour"/)
        expect(messages).toMatch(/labels\.en\.paste/)
        expect(messages).toMatch(/labels\.de, expected a mapping/)
    })

    it('warns about a top level that is not a mapping', () => {
        expect(normalizeConfig(['x'])).toEqual(defaults())
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('top level'))
    })
})

describe('loadConfig', () => {
    it('returns the defaults when the file is missing', () => {
        expect(loadConfig({ cwd: tempDir() })).toEqual(defaults())
    })

    it('reads config/code-blocks.yaml from the site root', () => {
        const root = tempDir()
        write(path.join(root, 'config', 'code-blocks.yaml'), 'bar: never\nassets: false\n')
        expect(loadConfig({ cwd: root })).toMatchObject({ bar: 'never', assets: false })
    })

    it('honours app.folders.config', () => {
        const root = tempDir()
        write(path.join(root, 'settings', 'code-blocks.yaml'), 'bar: auto\n')
        expect(loadConfig({ cwd: root, app: { folders: { config: 'settings' } } }).bar).toBe('auto')
    })

    it('reads a comment-only file as empty', () => {
        const root = tempDir()
        write(path.join(root, 'config', 'code-blocks.yaml'), '# nothing yet\n')
        expect(loadConfig({ cwd: root })).toEqual(defaults())
    })

    it('reads the shipped config file as the defaults plus labels', () => {
        const shipped = path.resolve('config')
        const config = loadConfig({ cwd: path.dirname(shipped) })
        expect({ ...config, labels: {} }).toEqual(defaults())
        expect(config.labels.de.copy).toBe('Kopieren')
        expect(warn).not.toHaveBeenCalled()
    })
})
