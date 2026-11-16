# ccset forwarding package

[简体中文](README.zh-CN.md) | English

This independent package imports the installed [@droite/ccset](https://www.npmjs.com/package/@droite/ccset) CLI in the same process, preserving arguments, stdin, terminal behavior and exit status. Node ≥18; MIT. Package `0.1.0` pins scoped CLI `0.11.1`; `--version` reports the underlying CLI version. [package.json](package.json) is authoritative for both versions.

The last registry evidence (2026-11-13) recorded the unscoped name as unregistered; source preparation does not prove publication. Until registration/release is verified, use:

```bash
npx @droite/ccset
```

See the [project README](../../README.md) and [user guide](../../docs/user-guide.md).

## Publishing

Main CLI tags: `v<version>`; forwarder tags: `ccset-v<version>`. [publish.yml](../../.github/workflows/publish.yml) uses separate jobs in `npm-publish`, package-specific trusted publishers and provenance. Guards reject local publishing, dirty checkouts, mismatched and cross-package tags.

First registration requires an npm-authenticated maintainer; the 2026-11-13 decision was a minimal `0.0.1` reservation followed by workflow publication of the forwarding version. Configure that package's trusted publisher after registration. This bootstrap is not a completed release claim.

After a main release, update the exact published dependency, forwarder version/lockfile as applicable, and both READMEs. Run root `verify:release-artifact` and full `npm test` sequentially. The fixture installs the forwarder in a separate temporary project and resolves its pin from npm; it never publishes. See [release gates](<../../Important Documentation.md#6-build-and-publish>).
