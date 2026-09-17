# Render the website from the repository Markdown

ccset needs a website under `pages/` deployed to GitHub Pages: a landing page,
a docs viewer, English and Simplified Chinese, a 404 fallback, and two
workflows (a PR check and a deploy). Nothing about *what the site says* is
new content — the repository already maintains its documentation as Markdown
at the root and under `docs/`, in both languages. The decisions below are
about where the site's words come from, where it lives on the URL space, how
it picks a language, and how it meets the same quality bar as the CLI.

The site renders the repository's own Markdown instead of a copy. `pages/`
imports the documents with Vite `?raw` and rewrites their links at render
time, so a doc edit and the site that shows it are the same change; a copied
corpus would drift the moment someone edited a README and not the site, and
AGENTS.md forbids duplicated guidance. Link rewriting resolves each link
relative to the source file's directory: a path that is a registered doc
(`README.md`, `docs/user-guide.md`, …) becomes a `/docs/<slug>` route with its
GitHub anchor preserved; every other repository path (ADRs, the verification
register, source files) becomes its `github.com/Right202209/ccset/blob/master`
URL; non-repo URLs pass through. Heading ids are GitHub-compatible, so the
anchors the docs already cross-link with (`user-guide.md#cli`) work on the
site. The terminal demo on the landing page imports the CLI's own catalogs
rather than restating them, for the same drift reason.

The site is served from a subpath and takes its base from the deploy
pipeline. GitHub Pages serves this repository at `/ccset/` unless a custom
domain is configured later; Vite's `base` (and the router's basename) is read
from `PAGES_BASE_PATH`, which the deploy workflow fills from
`actions/configure-pages` and which defaults to `/ccset/`. Nothing in the site
hard-codes the prefix, so moving to a custom domain — which would also need a
`public/CNAME` — changes configuration, not code. `dist/404.html` is a copy of
the built `index.html`, so deep links like `/ccset/docs/user-guide` reach the
SPA router, as GitHub Pages' 404 fallback requires.

The site may infer a language from the browser; the CLI still never does. ADR
0005's rule — locale preference is an explicit choice, saved in ccset's own
settings, never sniffed from `LANG` — exists because the CLI is a tool run in
a terminal where a wrong guess is invisible until a script parses the wrong
output. A website is read, not executed: the cost asymmetry of guessing runs
the other way, and the established web behavior of following
`navigator.languages` is itself an expectation the visitor brings. The site
therefore reads the browser hint on first visit, keeps an explicit choice in
`localStorage` under a key of its own (nothing to do with
`~/.ccset/settings.json`), and sets `<html lang>`; a document without a
translation falls back to the other language rather than hiding. The two
locales are the two the CLI carries, `en` and `zh-Hans`; their catalogs stay
in parity through a site-side test mirroring `verify:i18n-zh`.

The site meets the register's code-quality gates without a second standard.
The §7 gates parse TypeScript with the compiler's own AST, so
`verify:code-gates` walks `pages/` alongside `src/` and `scripts/` with no new
dependencies: files stay ≤ 300 lines, functions ≤ 50 non-blank lines,
complexity ≤ 10, and the style rules (two spaces, no semicolons, single
quotes, `.js` import suffixes) apply unchanged. The site keeps its own
`package.json` and lockfile — its toolchain (Vite, Vitest, jsdom) needs a
newer Node than the CLI supports — with no npm workspaces and no change to the
root's dependency tree or tarball.

Non-goals: no blog or benchmark content (ccset has none), no third-party
fonts, icon CDNs, or analytics (the site loads everything first-party), no
server-side rendering (the docs corpus is small and static), and no rendering
of ADRs or the verification register as site routes — they are linked to
GitHub instead. The root `ci.yml` and the npm package are untouched; the
deploy workflow runs the same site checks the PR workflow runs, then uploads
`pages/dist` with the official Pages actions.
