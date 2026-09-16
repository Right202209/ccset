# ccset website (`pages/`)

The site served at `https://right202209.github.io/ccset/`: a landing page and
a viewer for the repository's own documentation, in English and Simplified
Chinese. It renders the repository Markdown in place (`?raw` imports, links
rewritten to routes or GitHub URLs) — never copy doc text here. Decisions are
recorded in [ADR 0015](../docs/adr/0015-render-the-website-from-the-repository-markdown.md).

## Toolchain

Vite + React 18 + TypeScript, tested with Vitest, jsdom, and Testing Library.
The site has its own `package.json` and lockfile and needs **Node 22.22+/24.15+/26+**
— newer than the CLI's floor — so keep it separate from the root install: no
npm workspaces, and run every command below from `pages/`.

```bash
npm ci            # locked install (pages/package-lock.json)
npm run dev       # dev server at http://localhost:5173/ccset/
npm run typecheck
npm test          # vitest run --coverage (thresholds enforced)
npm run build     # dist/ with base /ccset/ (override with PAGES_BASE_PATH)
npm run smoke     # vite preview + route/asset/gzip assertions
```

`PAGES_BASE_PATH` must start and end with `/`; the deploy workflow passes the
path `actions/configure-pages` computes. `npm run build` also copies
`dist/index.html` to `dist/404.html` for GitHub Pages deep links.

## Structure

```text
src/
├── content/    # sources (?raw), registry (slugs per locale), docs, links, search
├── markdown/   # GitHub-compatible slugs, heading outline, marked+DOMPurify render
├── i18n/       # en/zh-Hans catalogs (parity-tested), language context
├── components/ # Navbar, Footer, LanguageMenu, ErrorBoundary, landing/, docs/
├── routes/     # Landing, Docs, NotFound
├── hooks/      # useCopy, useResponsive, useDocSearch, useActiveHeading
└── styles/     # tokens.css and per-surface CSS
```

Conventions that differ from the CLI: browser APIs are guarded (SSR/test
safety), components are small function components styled by CSS classes, and
`?raw` imports of `../README.md` etc. are the single source of truth for doc
prose. Conventions that carry over unchanged: two spaces, no semicolons,
single quotes, `.js` import suffixes, and the §7 code-quality gates —
`verify:code-gates` walks `pages/` like any other source directory, so files
stay ≤ 300 lines and functions ≤ 50 non-blank lines.

## Adding or changing a document

The viewer serves what [the docs registry](src/content/registry.ts) lists.
To add a document: create the Markdown in the repo (its natural location),
add a `DOC_ENTRIES` row (slug, repo path, group, label key, per-locale
sources), and add the label to both i18n catalogs. Links inside docs need no
changes: registered repo paths become routes, everything else links to
GitHub. Both catalogs must carry the same keys; `npm test` enforces it.

## PRs

Visible website changes need screenshots (desktop and mobile widths) in the
PR description, like TUI changes do. CI runs the checks above on PRs touching
`pages/**`, `docs/**`, root `*.md`, or the workflows; `deploy-pages.yml`
re-runs them and deploys on every push to `master`.
