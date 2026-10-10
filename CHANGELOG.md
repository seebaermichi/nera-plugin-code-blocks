# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-10

### Added

-   `--nera-code-button-radius` (default `4px`) sets the copy button's corners in the default stylesheet, so a site with a square design maps one more property instead of overriding the rule. The default output is unchanged.

## [1.1.0] - 2026-10-10

### Added

-   The bar carries `data-search-ignore`, so `@nera-static/plugin-search` 2.2.0 and later leaves the file name and the "Copy" label out of its index and excerpts. With an older plugin-search the labels are still indexed, as before.

### Removed

-   README: the "Search excerpts include the bar text" known limitation; the Markup section shows the new attribute.

## [1.0.1] - 2026-10-10

### Changed

-   README: a "Known limitations" section (no spaces in file names, bar labels in plugin-search excerpts, no line numbers yet).

## [1.0.0] - 2026-10-10

### Added

-   First release. Requires `@nera-static/core` 4.13.0 or later for the default stylesheet and copy script (the `getAssets` hook).
-   Build-time highlighting of fenced code blocks with a language, rendered as `div.nera-code` with a header bar (`nera-code__bar`, `nera-code__title`), a copy button (`nera-code__copy`, hidden until the script can copy) and a keyboard-focusable `pre.nera-code__pre`.
-   Fence syntax `lang:path/to/file` for a file name in the bar, split on the first colon.
-   Shell blocks (`shell_languages`, default `sh`, `bash`, `shell`, `zsh`, `console`): one `span.nera-code__line` per line, the prompt from CSS so it is never copied.
-   YAML frontmatter in `markdown`/`md` blocks is highlighted as YAML.
-   Highlighters: `highlight.js` (default, with Pug from `@nera-static/highlightjs-pug`, extra grammars via `highlighter_options.languages`), `shiki` (optional peer dependency), `none`, or a site's own adapter module.
-   `config/code-blocks.yaml` with `bar`, `copy_button`, `shell_languages`, `labels`, `assets`, `highlighter` and `highlighter_options`; built-in English and German labels, picked by `meta.lang` or `app.lang`.
-   Default stylesheet and copy script, copied to `public/_nera/code-blocks.css` and `public/_nera/code-blocks.js` through `getAssets` (`assets: false` turns it off), themed by `--nera-code-*` custom properties.
-   `npx nera-code-blocks` publishes the documented config into a site.
-   A clear error on `@nera-static/core` older than 4.13.0 while `assets` is on.
