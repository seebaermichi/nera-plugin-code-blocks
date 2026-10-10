# @nera-static/plugin-code-blocks

A plugin for the [Nera](https://github.com/seebaermichi/nera) static site generator that turns fenced code blocks into highlighted, accessible code cards at build time: syntax highlighting, a header bar with the file name (or "terminal"), a copy button, and shell prompts that are never copied.

📖 **Documentation:** [nera.js.org](https://nera.js.org)

> Requires `@nera-static/core` **4.13.0 or later** (see [Compatibility](#compatibility)).

## ✨ Features

- Highlighting at build time: no highlighting script ever reaches the browser
- [highlight.js](https://highlightjs.org) by default, with **Pug** included; [Shiki](https://shiki.style), no highlighting, or your own highlighter by config
- Optional file name in the fence: ```` ```yaml:config/app.yaml ````
- Shell blocks (`sh`, `bash`, `shell`, `zsh`, `console`) get a `$` prompt from CSS, so copied text is exactly the command
- Markdown blocks with a YAML frontmatter highlight the frontmatter as YAML
- A copy button that only appears where copying works, labelled in the page's language
- Keyboard-reachable scrolling blocks (`tabindex="0"`)
- A default stylesheet themed through `--nera-code-*` custom properties, and a tiny copy script, both optional

## 🚀 Installation

```bash
npm install @nera-static/plugin-code-blocks
```

Nera detects the plugin and processes code blocks during `nera build`. `config/code-blocks.yaml` is optional.

Then link the default stylesheet and copy script in your layout. Plugins cannot touch layouts, so this is the one manual step:

```pug
head
    link(rel="stylesheet", href="/_nera/code-blocks.css")
    script(src="/_nera/code-blocks.js", defer)
```

Both files are copied to `public/_nera/` on every build (and get `base_path` and asset hashing like any other asset). Leave them out and style the [classes](#markup-and-classes) yourself if you prefer; set `assets: false` to stop copying them.

## Writing code blocks

````markdown
```markdown:pages/impressum.md
---
title: Impressum
---
Text in **Markdown**.
```
````

| Fence | Result |
| --- | --- |
| ```` ```js ```` | highlighted, bar shows `js` |
| ```` ```js:src/index.js ```` | bar shows **`src/index.js`** · js |
| ```` ```bash ```` | shell block: one `$` prompt per line, bar shows `terminal` |
| ```` ```nope ```` | unknown language: shown as plain text, bar kept |
| ```` ``` ```` | no language: left exactly as Markdown renders it, no bar |

The file name is everything after the **first** colon, so `yaml:C:/site/app.yaml` shows `C:/site/app.yaml`.

**A file name cannot contain spaces.** Markdown keeps only the first word of the fence info, so ```` ```js my file.js ```` loses `file.js` before any plugin sees it.

Inline code (`` `like this` ``) is never touched.

## ⚙️ Configuration

Every key is optional. To start from the documented defaults, copy the file into your site:

```bash
npx nera-code-blocks          # writes config/code-blocks.yaml
npx nera-code-blocks --force  # overwrites an existing one
```

```yaml
# Show the header bar: "always" (every block with a language), "auto" (only
# when a file name is set or the block is a shell block) or "never".
bar: always

# Copy button in the bar.
copy_button: true

# Fence languages rendered as shell sessions with a prompt.
shell_languages: [sh, bash, shell, zsh, console]

# Labels per page language (meta.lang, else app.lang). English and German are
# built in; add your languages here.
labels:
    en: { copy: Copy, copied: Copied, terminal: terminal }
    de: { copy: Kopieren, copied: Kopiert, terminal: Terminal }

# Ship the default stylesheet and copy script to public/_nera/ via getAssets.
assets: true

# highlight.js (default) | shiki (npm install shiki) | none | ./path/to/adapter.js
highlighter: highlight.js

# Passed to the highlighter, see below.
highlighter_options: {}
```

With `bar: never` there is no copy button either, because the button lives in the bar. A label missing for a language falls back to the built-in one for that language, then to English.

## Highlighters

The highlighter only produces the colored tokens inside `<code>`. The fence syntax, the markup around the code, the labels and the copy button are the same whichever one you choose.

### highlight.js (default)

Emits classes (`hljs-keyword`, `hljs-string`, …), which the default stylesheet colors, so dark mode is just more CSS. All highlight.js languages are available, plus **Pug** (and its old name `jade`) from [`@nera-static/highlightjs-pug`](https://github.com/seebaermichi/nera-highlightjs-pug) ([live demo](https://seebaermichi.github.io/nera-highlightjs-pug/demo/)), which is registered by default.

More grammars, from a package or a file in your site:

```yaml
highlighter_options:
    languages:
        cypher: highlightjs-cypher
        mylang: ./grammars/mylang.js
```

Each module's default export is a highlight.js language function.

### Shiki

[Shiki](https://shiki.style) uses VS Code's grammars, so it knows more languages (Pug included) and often highlights more precisely. It colors tokens with inline styles and is a larger install, so it is an optional peer dependency:

```bash
npm install shiki
```

```yaml
highlighter: shiki
highlighter_options:
    themes: { light: github-light, dark: github-dark }  # the default
    # theme: nord                                       # or a single theme
    # langs: [pug, astro]                               # load up front (optional)
```

With `themes`, every token also carries a `--shiki-dark` color. Switch to it in your dark mode CSS:

```css
@media (prefers-color-scheme: dark) {
    .nera-code .shiki span { color: var(--shiki-dark) !important; }
}
```

The `hljs-*` colors of the default stylesheet do not apply to Shiki's tokens; the frame, bar and prompt still do.

### none

`highlighter: none` keeps the bar, the copy button and the shell prompts, without any token colors.

### Your own

`highlighter: ./highlighter.js` loads a module from your site root. Its default export is an adapter object, or a function `(options, { cwd })` returning one (it may be async):

```js
export default {
    name: 'my-highlighter',
    codeClass: 'my-hl',                  // optional, added to <code>
    hasLanguage: (lang) => lang === 'js', // false → the block is shown as escaped text
    highlight: async (code, lang) => '…', // HTML for inside <code>; escape the code yourself
    shellLine: (line, lang) => '…',       // optional, one line of a shell block
}
```

`highlighter_options` is passed to the function.

## Markup and classes

```html
<div class="nera-code">
    <div class="nera-code__bar">
        <span class="nera-code__title"><b>pages/impressum.md</b> · markdown</span>
        <button class="nera-code__copy" type="button" data-nera-code-copy data-done="Kopiert" hidden>Kopieren</button>
    </div>
    <pre class="nera-code__pre" tabindex="0"><code class="hljs language-markdown">…</code></pre>
</div>
```

| Element | Class / attribute |
| --- | --- |
| wrapper | `div.nera-code`, plus `.nera-code--shell` for shell blocks |
| header bar | `div.nera-code__bar` |
| title | `span.nera-code__title`, the file name in `<b>` |
| copy button | `button.nera-code__copy[data-nera-code-copy][data-done][hidden]` |
| pre | `pre.nera-code__pre[tabindex="0"]` |
| code | `code.language-<lang>`, plus the highlighter's class (`hljs`, `shiki`) |
| shell line | `span.nera-code__line` |

These classes are the plugin's public contract: renaming any of them is a major release.

The copy script shows each button only when `navigator.clipboard` exists (HTTPS or localhost), copies the text of the block's `<code>`, and shows the `data-done` label for two seconds.

## Theming

The default stylesheet ("A Paper": a white card, hairline border, monospace bar) reads every color and size from a custom property with a fallback. Map your theme's tokens instead of overriding rules:

```css
.nera-code {
    --nera-code-bg: var(--panel);
    --nera-code-ink: var(--ink);
    --nera-code-line: var(--line);
    --nera-code-accent: var(--accent);
}
```

| Property | Default | Used for |
| --- | --- | --- |
| `--nera-code-bg` | `#ffffff` | card background |
| `--nera-code-ink` | `#0e1116` | code text, file name |
| `--nera-code-line` | `#e4e3dd` | border, bar separator, button border |
| `--nera-code-muted` | `#5c626c` | bar text, prompt, comments, punctuation |
| `--nera-code-accent` | `#2a6fdb` | keywords, tags, attributes, commands, focus |
| `--nera-code-string` | `#1d7a55` | strings, numbers, literals |
| `--nera-code-symbol` | `#8a3ab9` | classes, ids, titles, properties, variables |
| `--nera-code-font` | `ui-monospace, …` | bar, button and code font |
| `--nera-code-size` | `14px` | code font size |
| `--nera-code-radius` | `6px` | card corners |
| `--nera-code-margin` | `1.5rem 0` | space around the card |
| `--nera-code-prompt` | `'$ '` | shell prompt |

Every default text color reaches a 4.5:1 contrast on the default background. For dark mode, redefine the properties in your own media query.

The rules are scoped under `.nera-code`, so they win over usual article rules such as `.prose pre`. Blocks without a language are not styled, unless you add the class `nera-code-scope` to a container (your article element, say): then plain `pre` blocks inside it get the same card look, without a bar.

## Compatibility

- **`@nera-static/core` 4.13.0 or later** (the `getAssets` hook, which copies the stylesheet and script into `public/`). On an older core the build stops with a message naming the required version, rather than publishing pages that link to missing files. With `assets: false` the check is skipped, and any core from 4.3.0 (which awaits async hooks) works.
- Node.js 20.18.1 or later.
- `shiki` 4.x, only when `highlighter: shiki` is selected.

## 🧪 Development

```bash
npx vitest run
npm run lint
```

`npm test` runs Vitest in watch mode. The integration tests build a throwaway site with the real `@nera-static/core` in a temp directory; the highlighter tests run the same fixtures against highlight.js, Shiki and `none`.

## 📦 License

MIT
