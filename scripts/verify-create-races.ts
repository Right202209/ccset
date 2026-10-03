import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { createStateIfMissing } from '../src/agents/claude-code/state.js'
import { claudeStatePath } from '../src/agents/claude-code/paths.js'
import { adoptLiveAuth } from '../src/agents/codex/auth.js'
import { authProfilePath, codexAuthPath, codexDir } from '../src/agents/codex/paths.js'

/** Introduce a competing writer at the final publication boundary. */
async function withCompetingCreation(target: string, run: () => Promise<void>): Promise<void> {
  const rename = fs.rename
  const link = fs.link
  let injected = false
  const compete = async (destination: unknown): Promise<void> => {
    if (String(destination) !== target || injected) return
    injected = true
    await fs.writeFile(target, '{"projects":{"keep":true},"tokens":"KEPT"}\n')
  }
  fs.rename = async (source, destination) => {
    await compete(destination)
    await rename(source, destination)
  }
  fs.link = async (source, destination) => {
    await compete(destination)
    await link(source, destination)
  }
  try {
    await run()
    assert.ok(injected, 'the publication race was not exercised')
    assert.equal(await fs.readFile(target, 'utf8'), '{"projects":{"keep":true},"tokens":"KEPT"}\n')
  } finally {
    fs.rename = rename
    fs.link = link
  }
}

export async function verifyStateCreationRace(home: string): Promise<void> {
  await withCompetingCreation(claudeStatePath(home), async () => {
    assert.equal((await createStateIfMissing({ home })).created, false)
  })
  assert.deepEqual(await fs.readdir(home), ['.claude.json'], 'temporary files survived the conflict')
}

export async function verifyAdoptionRace(home: string): Promise<void> {
  await fs.mkdir(codexDir(home), { recursive: true })
  await fs.writeFile(codexAuthPath(home), '{"OPENAI_API_KEY":"LIVE"}\n')
  await withCompetingCreation(authProfilePath(home, 'race'), async () => {
    await assert.rejects(() => adoptLiveAuth({ home }, 'race'))
  })
  assert.deepEqual((await fs.readdir(codexDir(home))).sort(), ['auth.json', 'auth.race.json'])
}
