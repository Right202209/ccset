# ccset website (`pages/`)

The [site](https://right202209.github.io/ccset/) renders repository Markdown in English/Simplified Chinese through `?raw` imports. Never copy documentation into the site; [ADR 0015](../docs/adr/0015-render-the-website-from-the-repository-markdown.md) records the decision.

## Toolchain

React/Vite/TypeScript; Vitest, jsdom, Testing Library. Independent package and lockfile, **Node `^22.22.2 || ^24.15.0 || >=26`**. No root workspaces; run here:

```bash
npm ci
npm run dev       # http://localhost:5173/ccset/
npm run typecheck
npm test          # coverage thresholds enforced
npm run build
npm run smoke     # preview, routes/assets/gzip assertions
```

`PAGES_BASE_PATH` starts/ends with `/`; default `/ccset/`. Deployment supplies the configured Pages path. Build copies `index.html` to `404.html` for deep links.

## Ownership

| Source | Owns |
| --- | --- |
| `src/content/` | Raw sources, locale registry, links and search |
| `src/markdown/` | Unicode heading slugs, outline, marked + DOMPurify rendering |
| `src/i18n/` | Both catalogs and language context |
| `src/components/`, `src/routes/`, `src/hooks/` | Landing/viewer UI and browser interaction |
| `src/styles/` | Tokens and surface CSS |

Follow [shared style/quality rules](../AGENTS.md#style-and-verification); guard browser APIs for tests. Warm paper/ink surfaces, system fonts, dark code blocks and demo are the current visual system. [ReveriePaint](https://reveriepaint.lanrhyme.top/) is a design reference, not a runtime asset source.

## Adding or changing a document

Edit the repository Markdown and its covered Chinese counterpart (`docs/zh-CN/<name>.zh-CN.md`; root Chinese README stays at root). For a new viewer document, add raw sources in [sources.ts](src/content/sources.ts), a [registry.ts](src/content/registry.ts) entry with locale paths/slugs, and labels in both catalogs. Registered links become viewer routes; other repository paths become GitHub links.

Run the checks above for rendered-document changes. Visible UI changes also need desktop/mobile inspection and PR screenshots. [Site CI](../.github/workflows/pages-ci.yml) watches site/docs/root Markdown; [deployment](../.github/workflows/deploy-pages.yml) repeats checks on every `master` push. Root CLI CI does not build the site.
