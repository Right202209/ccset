import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

/**
 * Post-build smoke for the built site: routes serve the SPA shell, deep links
 * work, every asset URL carries the configured base path, 404.html matches
 * index.html, and the bundle respects a gzip budget. Uses the same
 * PAGES_BASE_PATH default as vite.config.ts, so the deploy job can point it
 * at the path configure-pages computed.
 */

const BASE_PATH = process.env.PAGES_BASE_PATH || '/ccset/'
const PORT = 4173
const ROOT = path.dirname(new URL(import.meta.url).pathname)
const DIST = path.join(ROOT, '..', 'dist')
const GZIP_BUDGET_BYTES = 500 * 1024

if (!BASE_PATH.startsWith('/') || !BASE_PATH.endsWith('/')) {
  console.error(`PAGES_BASE_PATH must start and end with "/": got "${BASE_PATH}"`)
  process.exit(1)
}

async function main() {
  const indexHtml = readDist('index.html')
  assert.equal(readDist('404.html'), indexHtml, 'dist/404.html must be a copy of index.html')

  const assets = collectAssets(indexHtml)
  assert.ok(assets.length > 0, 'index.html references no assets')

  const child = spawnPreview()
  process.on('exit', () => child.kill())

  try {
    await awaitPreview()
    for (const route of [BASE_PATH, `${BASE_PATH}docs/user-guide`, `${BASE_PATH}docs/unknown-doc`]) {
      const body = await getOk(route)
      assert.ok(body.includes('id="root"'), `${route} did not serve the SPA shell`)
    }
    for (const asset of assets) {
      assert.ok(asset.startsWith(BASE_PATH), `asset ${asset} is not base-prefixed`)
      await getOk(asset)
    }
    await assertGzipBudget(assets)
    console.log(`smoke: ${assets.length} assets, all routes and the gzip budget OK`)
  } finally {
    child.kill()
  }
}

function readDist(name) {
  const file = path.join(DIST, name)
  assert.ok(fs.existsSync(file), `dist/${name} is missing -- run the build first`)
  return fs.readFileSync(file, 'utf8')
}

function collectAssets(indexHtml) {
  return [...indexHtml.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((match) => match[1])
}

function spawnPreview() {
  const bin = path.join(ROOT, '..', 'node_modules', '.bin', 'vite')
  return spawn(bin, ['preview', '--port', String(PORT), '--strictPort'], {
    cwd: path.join(ROOT, '..'),
    stdio: ['ignore', 'ignore', 'inherit'],
  })
}

async function awaitPreview() {
  const deadline = Date.now() + 15000
  for (;;) {
    try {
      const response = await fetch(`http://localhost:${PORT}${BASE_PATH}`)
      if (response.ok) return
    } catch {
      /* server not up yet */
    }
    if (Date.now() > deadline) throw new Error('vite preview did not come up in time')
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

async function getOk(route) {
  const response = await fetch(`http://localhost:${PORT}${route}`)
  assert.equal(response.status, 200, `${route} returned ${response.status}`)
  return response.text()
}

async function assertGzipBudget(assets) {
  const scripts = assets.filter((asset) => asset.endsWith('.js'))
  for (const asset of scripts) {
    const raw = Buffer.from(await (await fetch(`http://localhost:${PORT}${asset}`)).arrayBuffer())
    const gzipped = zlib.gzipSync(raw)
    assert.ok(
      gzipped.length <= GZIP_BUDGET_BYTES,
      `${asset} gzips to ${gzipped.length} bytes, over the ${GZIP_BUDGET_BYTES} budget`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
