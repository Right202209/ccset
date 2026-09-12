import os from 'node:os'
import path from 'node:path'
import type { ConfigFile } from '../../types.js'
import { backupsDirFor } from '../../core/paths.js'
import {
  AGENT_DIR_ENV,
  AUTH_FILE_NAME,
  MODELS_FILE_NAME,
  PI_DIR_SEGMENTS,
  SETTINGS_FILE_NAME,
} from './constants.js'

/**
 * pi's file layout. Providers live in one document (models.json), the startup
 * defaults live in another (settings.json), and credentials live in a third
 * (auth.json) that ccset never edits -- pi's /login owns it.
 *
 * pi resolves its directory from PI_CODING_AGENT_DIR when set. ccset honours
 * that override, but only when the run points at the real home: a scratch home
 * (CCSET_HOME, or every fixture) keeps its own `.pi/agent` regardless of what
 * the surrounding shell exports, which is what keeps an inherited variable
 * from taking a run's writes out of the scratch directory.
 */

export function piDir(home: string): string {
  if (path.resolve(home) !== path.resolve(os.homedir())) {
    return path.join(home, ...PI_DIR_SEGMENTS)
  }
  const override = process.env[AGENT_DIR_ENV]
  if (override !== undefined && override.trim().length > 0) return override
  return path.join(home, ...PI_DIR_SEGMENTS)
}

export function settingsPath(home: string): string {
  return path.join(piDir(home), SETTINGS_FILE_NAME)
}

export function modelsPath(home: string): string {
  return path.join(piDir(home), MODELS_FILE_NAME)
}

export function authPath(home: string): string {
  return path.join(piDir(home), AUTH_FILE_NAME)
}

/**
 * settings.json is plain JSON: pi parses it with JSON.parse and nothing else.
 */
export function settingsFile(home: string): ConfigFile {
  return { path: settingsPath(home), codec: 'json' }
}

/**
 * models.json is edited with the format-preserving JSONC codec. pi's own
 * reader strips comments from this one file before parsing (coding-agent
 * model-config.ts), so a hand-edited models.json may carry comments, and a
 * parse-and-re-emit codec would delete them on the first save. A plain-JSON
 * models.json is valid JSONC, so the choice changes nothing for one without
 * comments.
 */
export function modelsFile(home: string): ConfigFile {
  return { path: modelsPath(home), codec: 'jsonc' }
}

export function backupsDir(home: string): string {
  return backupsDirFor(piDir(home))
}

/**
 * There is nothing to activate: pi reads settings.json and models.json on
 * start. The command is what the user runs next, not a flag ccset had to
 * construct.
 */
export function launchCommand(): string {
  return 'pi'
}
