import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * The website lives under a subpath on GitHub Pages, so every asset URL and
 * the router basename hang off one base. `PAGES_BASE_PATH` lets the deploy
 * workflow pass the path `actions/configure-pages` computed; the default is
 * the project site for Right202209/ccset.
 */
const DEFAULT_BASE_PATH = '/ccset/'

function readBasePath(): string {
  const raw = process.env.PAGES_BASE_PATH
  if (raw === undefined || raw === '') return DEFAULT_BASE_PATH
  if (!(raw.startsWith('/') && raw.endsWith('/'))) {
    throw new Error(`PAGES_BASE_PATH must start and end with "/": got "${raw}"`)
  }
  return raw
}

/** Copies the built SPA shell to 404.html so GitHub Pages serves deep links. */
function spaFallback(): PluginOption {
  return {
    name: 'spa-404',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist', import.meta.url))
      copyFileSync(`${dist}/index.html`, `${dist}/404.html`)
    },
  }
}

export default defineConfig({
  base: readBasePath(),
  plugins: [react(), spaFallback()],
  server: {
    fs: {
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/test/**',
        'src/vite-env.d.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/styles/**',
        'src/i18n/index.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
})
