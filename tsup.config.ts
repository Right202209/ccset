import { defineConfig } from 'tsup'

// Single ESM entry point. Runtime dependencies (ink, react, commander) stay
// external: they are declared in package.json and resolved by the installer.
// What matters for PRD 4.3 is that none of ccset's own modules are reached by a
// dynamically scanned import() -- the registry is static, so the whole of src/
// collapses into one file.
export default defineConfig({
  entry: ['src/cli.tsx'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  minify: false,
  banner: { js: '#!/usr/bin/env node' },
})
