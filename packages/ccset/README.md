# ccset

[简体中文](https://github.com/Right202209/ccset/blob/master/packages/ccset/README.zh-CN.md) | English

The official forwarding package for
[@droite/ccset](https://www.npmjs.com/package/@droite/ccset), a terminal UI and
CLI for coding-agent configuration.

```bash
npx ccset
```

Or install globally:

```bash
npm install -g ccset
ccset --agent claude-code
```

This package runs `@droite/ccset` in the same process, preserving arguments,
standard input, terminal interaction, and exit codes. Version `0.1.0` pins
`@droite/ccset` to its published version `0.11.0`; `ccset --version` reports the
underlying CLI's version.

See the [project README](https://github.com/Right202209/ccset#readme) and
[user guide](https://github.com/Right202209/ccset/blob/master/docs/user-guide.md)
for configuration instructions. Requires Node.js 18 or newer. MIT licensed.

## Publishing

Release this package separately from the main CLI. Its GitHub Release tag is
`ccset-v<version>` (currently `ccset-v0.1.0`); the main CLI uses `v<version>`.
Both run through `.github/workflows/publish.yml` in the `npm-publish`
environment with npm trusted publishing and provenance. The release guard
refuses local publishing, a dirty checkout, and mismatched or main-CLI tags.

npm can attach a trusted publisher only to a package that already exists, so
the workflow cannot create the first version. A maintainer signed in to npm
publishes it once, then configures the `ccset` package's trusted publisher
and publishing permission. Every later version goes through the workflow.

After each main CLI release, update the exact dependency and the version
description in both READMEs, then run the root
`npm run verify:release-artifact` and full `npm test` before releasing the
forwarder. The pinned version must already be available from npm; the fixture
installs it from the registry and compares the forwarded CLI with it.
