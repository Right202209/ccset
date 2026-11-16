# Render the website from the repository Markdown

Accepted. The React/Vite website imports repository Markdown with `?raw`, preventing drift between docs and the viewer. Registered repo paths become locale viewer routes with anchors; other repo paths link to GitHub. CLI catalogs supply the landing terminal copy for the same reason.

The separate `pages/` package/lockfile accommodates its newer Node toolchain without changing the CLI install or tarball. Shared TypeScript quality gates still apply. [Site SOP](../../pages/README.md) owns commands and registry steps.

`PAGES_BASE_PATH` defaults to `/ccset/` and deployment supplies the configured path; the router shares that base. Build copies index to 404 for deep links. No site code hard-codes a deployment prefix.

Browser language hints are appropriate for a reading surface; explicit localStorage preference overrides them. This is independent of ADR 0005's non-inferred CLI language. Missing translations fall back to the other locale; catalogs remain in parity.

Repository Markdown passes an allowlist sanitizer excluding media/SVG/forms/resource-loading attributes; a first-party CSP covers static hosting. No external fonts/CDNs/analytics or automatic third-party requests; external links are clicked navigation. ADRs/register link to GitHub rather than extra viewer routes. Site CI and deployment repeat typecheck/test/build/smoke; CLI CI is separate.
