import fs from 'fs'
import vm from 'vm'
import { describe, it, expect, vi } from 'vitest'

const css = fs.readFileSync('assets/nera-code.css', 'utf-8')
const script = fs.readFileSync('assets/nera-code.js', 'utf-8')

const luminance = (hex) => {
    const channels = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
}

describe('default stylesheet (D7)', () => {
    it('uses only --nera-code-* custom properties with fallbacks for colors', () => {
        const colors = [...css.matchAll(/(?:^|[\s;{])(?:color|background|border(?:-color)?|outline)\s*:\s*([^;]+);/g)]
            .map((m) => m[1])
            .filter((value) => /#[0-9a-f]{3,6}/i.test(value))
        expect(colors.length).toBeGreaterThan(0)
        for (const value of colors) expect(value).toMatch(/var\(--nera-code-[a-z-]+, #[0-9a-f]{6}\)/i)
    })

    it('gives every default text color 4.5:1 on the default background', () => {
        const background = /--nera-code-bg, (#[0-9a-f]{6})/i.exec(css)[1]
        const textColors = new Set(
            [...css.matchAll(/(?:^|[\s;{])color: var\(--nera-code-[a-z-]+, (#[0-9a-f]{6})\)/gi)].map((m) => m[1])
        )
        expect(textColors.size).toBeGreaterThan(3)
        for (const color of textColors) {
            expect(contrast(color, background), color).toBeGreaterThanOrEqual(4.5)
        }
    })

    it('makes the shell prompt generated content', () => {
        expect(css).toMatch(/\.nera-code\.nera-code--shell \.nera-code__line::before \{\s*content: var\(--nera-code-prompt, '\$ '\);/)
    })

    it('colors the Pug grammar scopes', () => {
        for (const scope of ['selector-class', 'selector-id', 'title.function_', 'subst', 'operator', 'params', 'property', 'title.class_', 'regexp']) {
            expect(css).toContain(`.nera-code .hljs-${scope}`)
        }
    })
})

// A minimal DOM, enough for the copy script.
function makeButton({ done = 'Copied' } = {}) {
    const listeners = {}
    const code = { textContent: 'npm install' }
    const button = {
        hidden: true,
        textContent: 'Copy',
        dataset: { done },
        closest: (sel) => (sel === '.nera-code' ? { querySelector: () => code } : null),
        addEventListener: (type, fn) => (listeners[type] = fn),
        click: () => listeners.click(),
    }
    return button
}

function runScript({ clipboard, buttons }) {
    const document = {
        readyState: 'complete',
        querySelectorAll: () => buttons,
        addEventListener: vi.fn(),
    }
    vm.runInNewContext(script, { navigator: { clipboard }, document, setTimeout, clearTimeout })
}

describe('copy script (D7, D9)', () => {
    it('leaves the buttons hidden without a clipboard', () => {
        const button = makeButton()
        runScript({ clipboard: undefined, buttons: [button] })
        expect(button.hidden).toBe(true)
    })

    it('shows the button and copies the code text', async () => {
        const writeText = vi.fn(() => Promise.resolve())
        const button = makeButton({ done: 'Kopiert' })
        runScript({ clipboard: { writeText }, buttons: [button] })
        expect(button.hidden).toBe(false)

        button.click()
        await Promise.resolve()
        expect(writeText).toHaveBeenCalledWith('npm install')
        expect(button.textContent).toBe('Kopiert')
    })

    it('binds a button only once when the script runs twice', () => {
        const writeText = vi.fn(() => Promise.resolve())
        const button = makeButton()
        const add = vi.spyOn(button, 'addEventListener')
        runScript({ clipboard: { writeText }, buttons: [button] })
        runScript({ clipboard: { writeText }, buttons: [button] })
        expect(add).toHaveBeenCalledTimes(1)
    })
})
