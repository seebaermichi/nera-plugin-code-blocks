# ROADMAP — `@nera-static/plugin-code-blocks`

Syntax-highlighted code blocks for Nera, done at build time. Each fenced block gets syntax highlighting (highlight.js by default, Shiki or a custom highlighter by config), an optional header bar (file name or "terminal") and a copy button. Shell blocks show a `$` prompt that is never copied.

**This file is the single source of truth for the plugin. Extend it; never start a parallel document.** Each slice below is sized for one session. Work through them in order, tick the checkboxes, and add a dated `**Done YYYY-MM-DD**` note with anything learned. The next session reads this file first and continues where the last one stopped.

Written 2026-10-09. Each package is set up and worked on in a session started in its own folder. The repository starts with this file as its first commit; no `package.json` and no code yet. Slice 0 scaffolds the package.

---

## Where it comes from

The plugin starts as a local plugin in `../nera-websites/michael-becker-berlin.de/plugins/code-blocks/index.js` (commit `f68f3d9`, 2026-10-09), built for the design "Code-Styling · A Paper" (claude.ai/design project `f40836f9-…`, file `Code-Styling.html`). The styling lives in that site's `themes/technical/sass/blog.scss` and the copy script in `themes/technical/js/app.js`. Commit `638852b` set the language and file name on the code blocks of the Nera post. That code is the starting point for slice 1. It works, but it is site-specific: hard-coded de/en labels, theme CSS variables, no config, no tests.

## The problem

`generator/src/core.js` renders Markdown with `markdown-it` (`html: true`) and no `highlight` option, so

````md
```yaml
title: Impressum
```
````

becomes `<pre><code class="language-yaml">title: Impressum</code></pre>`: no highlighting, no file name, no copy button. Every Nera site that shows code, nera.js.org first of all, has to solve this itself or leave it plain.

## The goal

````md
```markdown:pages/impressum.md
---
title: Impressum
---
Text in **Markdown**.
```
````

renders to (D3):

```html
<div class="nera-code">
    <div class="nera-code__bar">
        <span class="nera-code__title"><b>pages/impressum.md</b> · markdown</span>
        <button class="nera-code__copy" type="button" data-nera-code-copy data-done="Kopiert" hidden>Kopieren</button>
    </div>
    <pre class="nera-code__pre" tabindex="0"><code class="hljs language-markdown">…token spans…</code></pre>
</div>
```

The author only adds a language (and optionally a file name) to the fence. A site with no config and no stylesheet still gets correct, accessible markup, and it can include the shipped default CSS/JS (D7) or style the classes itself.

---

## Verified facts this design rests on (2026-10-09, core 4.14.0)

- **Plugins see rendered HTML.** In `getMetaData`, `pagesData[i].content` is markdown-it output. `plugin-link-attributes` and `plugin-images` rewrite it with cheerio (`load(content, null, false)`). The local plugin does the same; no core change is needed for the content pass.
- **markdown-it keeps only the first word of the fence info string.** ```` ```markdown title="x" ```` renders as `class="language-markdown"`, and the rest is dropped before any plugin runs. A word without spaces survives whole: ```` ```markdown:pages/impressum.md ```` renders as `class="language-markdown:pages/impressum.md"`. The local plugin relies on this (D2).
- **Plugins cannot reach markdown-it.** `getPagesData` renders all pages before `getPluginsData` loads any plugin, and the `md` instance is module-private in `core.js`. A markdown-it plugin hook would need a reorder in core (O1).
- **`getAssets` exists since core 4.13.0** (`nera-plugin-images/ROADMAP.md` D2), so the plugin can ship a CSS and a JS file into `public/` (D7). Plugin assets are copied theme → plugins → site and get `base_path` and `?v=` hashing.
- **highlight.js 11.12.0** (`import hljs from 'highlight.js'`, ESM default export, all languages) works in a Nera plugin. It has `bash`, `sh`, `yaml`, `markdown`, `js`, `html`, but **no `pug` (and no `jade`)**. nera.js.org has 24 ```` ```pug ```` blocks (O2).
- **nera.js.org highlights nothing today.** Its Markdown has ```` ```bash ```` (60), ```` ```yaml ```` (39), ```` ```pug ```` (24), ```` ```markdown ```` (18), ```` ```js ```` (12), ```` ```html ```` (3) and about 30 blocks without a language. It is the second field test (slice 5).
- **`cheerio` 1.2 needs Node `>=20.18.1`**, the same floor as `plugin-link-attributes` and `plugin-images`.
- **The npm name is free.** `npm view @nera-static/plugin-code-blocks` returns 404.

---

## Decisions

### D1 — Build-time highlighting through a replaceable highlighter
Highlighting runs during `nera build`; no highlighting script reaches the browser. The plugin owns everything around the code (fence parsing, bar, copy button, shell lines, frontmatter split, D3 markup). The **highlighter** only turns `(code, lang)` into token HTML, behind a small adapter:

```js
// A highlighter adapter. `highlight` may be async.
export default {
    name: 'highlight.js',
    hasLanguage(lang) { … },          // false → block is escaped, bar kept (D5)
    highlight(code, lang) { … },      // → HTML string for inside <code>
    codeClass: 'hljs',                // extra class on <code>, optional
}
```

Config `highlighter` picks it (D11):

- **`highlight.js`** (default). Emits **classes**, not inline styles, so a theme styles tokens from its own CSS, and dark mode is just more CSS. A regular `dependency`, so it works with zero config.
- **`shiki`**. Better (TextMate) grammars and many more languages, but inline colors per theme (or CSS variables via its dual-theme mode), an async engine and a much larger install (`shiki` 4.5.0, ~600 kB unpacked plus grammars). An **optional peer dependency**: loaded with a dynamic `import()` only when selected, and a clear error says to `npm install shiki` when missing.
- **`none`**: bar, copy button and shell lines, no tokens. For sites that only want the frame.
- **A path** (`./highlighter.js`, resolved from the site root): a site's own adapter, for any other library.

Only the wrapper markup (D3) is the plugin's contract. The token markup inside `<code>` belongs to the highlighter, and the default CSS (D7) styles highlight.js classes only.

### D2 — Fence syntax: `lang:file`
- ```` ```lang ```` sets the language.
- ```` ```lang:path/to/file ```` also sets the file name shown in the bar. Split on the **first** `:`, so `yaml:C:/x.yaml` keeps `C:/x.yaml`.
- A file name cannot contain spaces (markdown-it limit, see the facts). Documented in the README.
- ```` ``` ```` with no info stays a plain block (D5).

This works on every core ≥ 4.13.0 without a core change. The more common ```` ```lang title="file" ```` needs O1 and would come as an **additional** syntax in a minor release, never as a replacement. **Decide this with the user before slice 1** (O1); it cannot be changed after 1.0.0 without breaking posts.

### D3 — Output markup and BEM classes
Block `nera-code`, matching `figure.nera-image` from plugin-images:

| Element | Class / attribute |
| --- | --- |
| wrapper | `div.nera-code` (plus `.nera-code--shell` for shell blocks) |
| header bar | `div.nera-code__bar` |
| title | `span.nera-code__title`, the file name in `<b>` |
| copy button | `button.nera-code__copy[data-nera-code-copy][data-done][hidden]` |
| pre | `pre.nera-code__pre[tabindex="0"]` |
| code | `code.hljs.language-<lang>` (hljs token spans inside) |
| shell line | `span.nera-code__line` |

Class names are part of the public contract (CLAUDE.md: renaming them is a **major**). The local plugin used `.code-block`/`.code-bar`/`.code-copy`/`.is-shell`/`.line`; the field-test site moves to the new names in slice 5.

### D4 — Shell blocks
Languages in `shell_languages` (default `sh`, `bash`, `shell`, `zsh`, `console`) are split into lines: each line becomes `span.nera-code__line`, its first word `span.hljs-built_in`. The prompt comes from CSS (`.nera-code--shell .nera-code__line::before { content: var(--nera-code-prompt, "$ ") }`), so it is not part of `textContent` and never copied. Bar title: `terminal` (configurable label).

### D5 — Which blocks are processed
- Only `pre > code` with a `language-*` class. Blocks without a language keep markdown-it's markup and get no bar. Inline `code` is never touched.
- An unknown language (`hasLanguage` false) is HTML-escaped without token spans but still gets the bar with its name.
- Already processed blocks (`.nera-code` ancestor) are skipped, so a second run or another plugin's markup is safe.
- Pages whose content has no `<pre><code` are returned unchanged, without a cheerio parse.

### D6 — Markdown with frontmatter
In `markdown`/`md` blocks, a leading `---\n…\n---` is highlighted as YAML and the rest as Markdown. highlight.js reads the frontmatter as Markdown and gets it wrong otherwise. Nera posts show frontmatter constantly, so this is part of 1.0, not an extra.

### D7 — Default CSS and JS through `getAssets`
- The plugin ships `assets/nera-code.css` and `assets/nera-code.js` and returns them from `getAssets` as `_nera/code-blocks.css` and `_nera/code-blocks.js` (config `assets: false` turns it off). The site links them in its layout by hand: plugins cannot touch layouts. README shows the two lines.
- The CSS uses only custom properties with fallbacks (`--nera-code-bg`, `--nera-code-line`, `--nera-code-accent`, `--nera-code-string`, `--nera-code-muted`, `--nera-code-font`, `--nera-code-radius`, `--nera-code-prompt`, …), so a theme maps its tokens instead of overriding rules. Every default color reaches 4.5:1 on its background.
- The CSS also styles the shell prompt and the hljs token classes, scoped under `.nera-code`, and plain blocks under a configurable `scope` selector (default none, i.e. not styled).
- The JS unhides each `[data-nera-code-copy]` when `navigator.clipboard` exists, copies the block's `code.textContent`, and shows `data-done` for 2 s. No i18n in JS: both labels come from the build (D8).
- Needs core ≥ 4.13.0. Fail loudly on an older core, as plugin-images does (its D12).

### D8 — Labels and language
Button label, "copied" label and the shell title come from `labels.<lang>` in the config, `<lang>` = `meta.lang || app.lang`, falling back to built-in `en` and `de`, then to `en`.

### D9 — Accessibility
- The button is a real `<button type="button">` with visible text, hidden until the script can actually copy.
- `pre` gets `tabindex="0"` so a horizontally scrolling block is reachable by keyboard (axe `scrollable-region-focusable`). Check against `nera check` (`a11y-*` rules) in slice 5.
- The bar is not a heading; the file name is plain text.

### D10 — Async hook, config read inside the hook
`getMetaData` is `async`, because Shiki and custom adapters may be (hooks are awaited since core 4.3.0, and the peer floor is 4.13.0 anyway, as in plugin-images). It reads `config/code-blocks.yaml` on every call, as `plugin-link-attributes` does, so tests can point `cwd` at a temp project. The adapter itself is loaded once and cached per `highlighter` value.

### D11 — Choosing the highlighter
`highlighter: highlight.js | shiki | none | ./path.js` plus `highlighter_options`, passed through to the adapter (for Shiki: `themes`, `langs`; for highlight.js: extra grammars to register, besides Pug (D12)). The fence syntax, markup, labels and copy behaviour are identical whichever highlighter is used. A test suite runs the same block fixtures against every built-in adapter.

### D12 — Pug through `@nera-static/highlightjs-pug` (decided 2026-10-09)
highlight.js has no Pug grammar, neither in core nor in its list of 3rd-party grammars (`SUPPORTED_LANGUAGES.md`, checked 2026-10-09). A pull request adding Pug to highlight.js core would not be merged: its language guide says "due to lack of maintainer time we no longer merge new languages grammars into the core library" and asks for 3rd-party grammar packages instead.

- **A separate package, `@nera-static/highlightjs-pug`**, in its own repo `nera-highlightjs-pug` (workspace sibling, `seebaermichi/nera-highlightjs-pug` on GitHub). Not part of this plugin and not a helper library, because the grammar is useful to anyone with highlight.js and Pug.
- **Why this name.** Unscoped `highlightjs-pug` and `highlight-pug` are taken (both 0.0.2). `highlightjs-pug` (pixelastic, last change 2022-05-05) is unusable: a copy of the HAML grammar (`name: 'HAML'`) with almost everything commented out, so it only highlights `.class` and `#id`. The scope is ours, `highlightjs-` says which highlighter it is for (Shiki grammars are a different format), and it follows highlight.js's `highlightjs-<language>` naming for 3rd-party grammars.
- **Never `@nera-static/plugin-…`:** core loads every `@nera-static/plugin-*` dependency as a plugin.
- **Contract:** ESM default export `function (hljs)` returning the language definition, used as `hljs.registerLanguage('pug', pug)`. Aliases: `pug`, `jade`. Grammar scope: tags, classes/ids, attributes in `(…)` (values highlighted as JavaScript), `#{…}`/`!{…}` interpolation, `//` and `//-` comments, `-` code lines and `=`/`!=` output as JavaScript, `include`/`extends`/`block`/`append`/`prepend`/`mixin`/`+call`, `if`/`else`/`unless`/`each`/`while`/`case`/`when`, `doctype`, piped text. highlight.js matches patterns, not indentation, so multi-line text blocks (`tag.`) and filters (`:markdown`) are covered only partly; documented in its README.
- **Tests:** markup fixtures in highlight.js's own format (`test/markup/pug/<case>.txt` + `.expect.txt`), so the grammar can later run in their test runner too. Cases from the 24 ```` ```pug ```` blocks on nera.js.org and `themes/technical/views/` of the field-test site.
- **This plugin** depends on it and registers it in the highlight.js adapter, so Pug works with zero config.
- **After its first release:** a small PR to highlight.js that only adds the package to `SUPPORTED_LANGUAGES.md`.
- Creating the repo, publishing and the PR are outward steps: **confirm each with the user.**

---

## Open questions (decide with the user)

- **O1 — `title="…"` syntax.** Either keep `lang:file` only (works now), or add a core feature that lets plugins extend markdown-it before pages are rendered (for example an optional `extendMarkdown(md)` export, which needs `getPagesData` to load plugins first). The core feature would also serve future plugins (heading anchors, footnotes, containers). Recommendation: release 1.0 with `lang:file`, and track the core hook separately in `generator/ROADMAP-core.md` if wanted.
- **O3 — Line numbers and line highlighting** (variant C of the design had numbers). Not in 1.0 unless asked for.

---

## Configuration — `config/code-blocks.yaml`

```yaml
# Show the header bar: "auto" (when a file name is set or the block is a shell block),
# "always" (every block with a language) or "never".
bar: always
# Copy button in the bar.
copy_button: true
# Fence languages rendered as shell sessions with a prompt.
shell_languages: [sh, bash, shell, zsh, console]
# Labels per page language.
labels:
  en: { copy: Copy, copied: Copied, terminal: terminal }
  de: { copy: Kopieren, copied: Kopiert, terminal: Terminal }
# Ship the default stylesheet and copy script via getAssets.
assets: true
# highlight.js (default) | shiki (npm install shiki) | none | ./path/to/adapter.js
highlighter: highlight.js
# Passed to the adapter, e.g. for shiki: { themes: { light: github-light, dark: github-dark } }
highlighter_options: {}
```

All keys optional; `getConfig` returns `{}` for a missing file, so every key has a JS fallback. The defaults above reproduce the field-test site's current output (except the class names, D3). Whether `bar` defaults to `always` or `auto`: decide in slice 2 by looking at nera.js.org.

---

## Slices

Each slice ends with `npx vitest run && npm run lint` green, the checkboxes ticked, a dated note, and a commit on `main`. Nothing is published before slice 6.

### Slice 0 — Repository scaffold
- [x] `package.json` (`@nera-static/plugin-code-blocks`, `0.0.0`, `"type": "module"`, `engines.node >=20.18.1`, `exports`, `files` incl. `src`/`assets`, `publishConfig.access: public`, `peerDependencies: { "@nera-static/core": ">=4.13.0" }`), `index.js` stub, `LICENSE` (MIT, 2026), `CHANGELOG.md` (`## [Unreleased]`), `README.md` stub linking https://nera.js.org.
- [x] Copy `eslint.config.js`, `.gitignore`, `.github/workflows/test.yml` and `publish.yml`, `.husky/` plus `prepare: husky` verbatim from `nera-plugin-images`.
- [x] Dependencies: `highlight.js`, `cheerio`, `@nera-static/plugin-utils`. Dev: `vitest`, `eslint`, `husky`, `@nera-static/core` `^4.14.0`.
- [x] `npm install` with npm ≥ 10.9 (Node 22, see the plugin-images slice 0 note), **commit the lockfile in the scaffold commit**, before any workflow that runs `npm ci` (workspace `CLAUDE.md`, ordering rule 1).
- [x] Do **not** create the GitHub repo yet (slice 6).

**Done 2026-10-10.** Scaffold copied from `nera-plugin-images` (eslint config, `.gitignore`, workflows, husky hooks, LICENSE). Lockfile generated with Node 22.22.0 / npm 10.9.4 and committed with the scaffold. `npm audit` reports `braces` (high, no fix) only through the dev-only `@nera-static/core` → `cpy`/`fast-glob` → `micromatch`; consumers never install it from here, so nothing to do in this repo. `.github/dependabot.yml` waits for slice 6 with the rest of the GitHub setup.

### Slice 1 — Engine port with tests
- [ ] Decide D2/O1 with the user first.
- [ ] Port `plugins/code-blocks/index.js` into `src/` (`highlight.js`, `render-block.js`, …) and `index.js#getMetaData`, with the D3 markup and D5 rules.
- [ ] Unit tests: language only; `lang:file`; file name with `:`; unknown language (escaped, bar kept); no language (untouched); inline code untouched; HTML in code escaped once (no `&amp;lt;`); Markdown with and without frontmatter (D6); shell lines and first word (D4); empty block; already processed block skipped; page without code returned as is.
- [ ] Integration test: build a throwaway site with `@nera-static/core` in a temp dir and check the HTML.

### Slice 2 — Config, labels, accessibility
- [ ] `config/code-blocks.yaml` in the package (documentation/default only) and `bin/publish-config.js`, as in `plugin-link-attributes`.
- [ ] `bar`, `copy_button`, `shell_languages`, `labels` (D8) with JS fallbacks; tests for each, including a missing config file.
- [ ] `tabindex="0"` and the hidden button (D9).

### Slice 3 — Default CSS and JS (`getAssets`)
- [ ] `assets/nera-code.css` from the "A Paper" styles in the field-test site's `blog.scss`, rewritten to `--nera-code-*` custom properties (D7). Check the contrast of every default color.
- [ ] Also color the scopes `@nera-static/highlightjs-pug` uses (its ROADMAP D2): `selector-class`, `selector-id`, `title.function`, `subst`, `operator`, `params`, and the JavaScript scopes its attribute values and interpolation produce (`property`, `title.class`, `regexp`). The field-test site's CSS has none of them yet (checked 2026-10-10: it already colors `attr`, `keyword`, `meta`, `name`, `punctuation`, `string`, `comment`).
- [ ] `assets/nera-code.js` from the site's `CodeCopy` module, reading `data-done`.
- [ ] `getAssets` + `assets: false`; core-version guard. Tests: entries returned, off switch, assets land in `public/_nera/` in the integration build.

### Slice 4 — Other highlighters and Pug
- [ ] Adapters `src/highlighters/{highlight-js,shiki,none}.js` and loading a site path (D1, D11). Shiki as optional peer, dynamic import, clear error when missing.
- [ ] Shared fixture suite run against every built-in adapter; one test with a custom adapter from a temp site.
- [x] Pug per D12, in `nera-highlightjs-pug`, worked on in a **new session started in that folder** (create it there; nothing of it is set up from other repos) (its own slices there are small: scaffold like this repo's slice 0, grammar + markup fixtures, README, release with the same 1.0.0 + CI 1.0.1 procedure as slice 6). **Done 2026-10-10** there, and **released**: `@nera-static/highlightjs-pug` 1.0.2 on npm (1.0.0 bootstrap, 1.0.1+ via CI OIDC), github.com/seebaermichi/nera-highlightjs-pug, live demo https://seebaermichi.github.io/nera-highlightjs-pug/demo/ (its ROADMAP has the record). Usage: `import pug from '@nera-static/highlightjs-pug'` + `hljs.registerLanguage('pug', pug)`; registers the alias `jade` itself. It needs `javascript` (and `xml` for literal HTML lines) registered, which the full `highlight.js` build does.
- [ ] Add `@nera-static/highlightjs-pug` as a dependency here (`^1.0.2`; it is on npm, this only waits for this repo's `package.json`) and register it in the highlight.js adapter. A fixture with a ```` ```pug ```` block proves zero-config Pug (acceptance 1).
- [x] After its release, confirm with the user, then the PR to highlight.js adding it to `SUPPORTED_LANGUAGES.md`. **Opened 2026-10-10** with the user's go: highlightjs/highlight.js#4558, waiting for a maintainer review (first-time contributor, so their CI needs a maintainer's approval to run). Tracked to the merge in `nera-highlightjs-pug/ROADMAP.md` slice 4.
- [ ] Check whether Shiki's grammar set includes Pug, and note it in the README for `highlighter: shiki`.

### Slice 5 — Field tests + README
- [ ] michael-becker-berlin.de: install the packed tarball, delete `plugins/code-blocks`, switch the SCSS to the D3 class names (or map the `--nera-code-*` properties and drop the duplicated rules), move the copy script out of `app.js`. Compare the two Nera posts before/after in the browser; `nera build --check` shows no new findings.
- [ ] nera.js.org (`nera-website`): first site with highlighting. Pick the `bar` default with the user; run through all ~140 blocks for broken output. Do not push the website change before the release.
- [ ] README: install, fence syntax incl. the no-spaces limit, config, linking the CSS/JS, theming via custom properties, class reference (D3), Pug note. The Pug note links `@nera-static/highlightjs-pug` (repo and live demo) and says it is registered by default; this is where `nera-highlightjs-pug/ROADMAP.md` slice 4 wants it mentioned (it is not a plugin, so not in `PLUGINS.md` or the website catalog).

### Slice 6 — Release
Follow `nera-plugin-images` slice 8 step by step, confirming every outward step with the user:
- [ ] GitHub repo `seebaermichi/nera-plugin-code-blocks`, push, private vulnerability reporting, `protect-main` ruleset, secret-scanning push protection, Dependabot config (fleet copy).
- [ ] 1.0.0 bootstrap publish by hand (user runs `npm publish`), Trusted Publisher, then **1.0.1 via CI within two days** so the Trusted Publisher validates (plugin-images lesson).
- [ ] `generator/PLUGINS.md` (alphabetical, count 15 → 16) and `nera-website/pages/{,de/,es/}plugins/index.md` with translated descriptions (no raw `: `).
- [ ] Release the field-test changes of slice 5 in both sites.
- [ ] Workspace `CLAUDE.md`: shipped note, plugin count.
- [ ] Once this repo is public: link `@nera-static/plugin-code-blocks` from the `nera-highlightjs-pug` README (it names the plugin without a link today) and tick that item in `nera-highlightjs-pug/ROADMAP.md` slice 4. A README change there is a patch release (CI, tag `v1.0.x`).

---

## Semver notes for later changes
Per CLAUDE.md. **Major:** renaming D3 classes or attributes, changing the fence syntax, renaming config keys or `--nera-code-*` properties, changing the published asset paths. Changing the default `highlighter` or the adapter interface is also a **major**. **Minor:** a new language grammar, highlighter adapter, config key or syntax (e.g. `title="…"` after O1) with a backward-compatible default. Updating highlight.js is a **minor** when token output changes visibly, noted in the CHANGELOG.

## Not in scope (for now)
- Runtime highlighting in the browser.
- Line numbers, highlighted lines, diff markers (O3).
- Tabs or grouped blocks (one example in several languages).
- Themes beyond the default stylesheet; dark mode is left to the site's CSS through the custom properties.

## Acceptance criteria
1. A fenced block with a known language renders highlighted, with bar and copy button, with zero config.
2. `lang:file` shows the file name; blocks without a language and inline code are unchanged.
3. Copied shell text contains no prompt; copied text equals the source exactly.
4. The button never shows where copying cannot work.
5. A site without the plugin builds byte-identically; a site with it but `assets: false` gets no files in `public/_nera/`.
6. Both field-test sites look right in the browser, and `nera build --check` reports no new findings.
7. Switching `highlighter` between `highlight.js`, `shiki` and `none` changes only the tokens inside `<code>`, never the wrapper markup.
