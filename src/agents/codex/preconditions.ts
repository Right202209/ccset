import { CcsetError, EXIT_RUNTIME, ValidationError } from '../../core/errors.js'
import { readConfigFile } from '../../core/config-file.js'
import { isPlainObject } from '../../core/json-file.js'
import { getPath } from '../../core/merge.js'
import type { Ctx, JsonObject } from '../../types.js'
import { keyringInUseIn, loadAdoptedRouting } from './auth.js'
import { codexConfigFile } from './global.js'
import { codexHomeOverride } from './paths.js'
import { providerPath } from './manifest.js'
import { RESERVED_PROVIDER_IDS } from './constants.js'

export function refuseHomeMismatch(ctx: Ctx): void {
  const override = codexHomeOverride(ctx.home)
  if (override !== null) {
    throw new CcsetError('codex.error.homeOverrideUnsupported', EXIT_RUNTIME, { path: override })
  }
}

export function refuseKeyring(data: JsonObject): void {
  if (keyringInUseIn(data)) throw new CcsetError('codex.error.keyringUnsupported', EXIT_RUNTIME)
}

export async function checkActivation(ctx: Ctx): Promise<void> {
  refuseKeyring((await readConfigFile(codexConfigFile(ctx.home))).data)
}

/** Resolve saved routing, including the default route for an orphan profile. */
export async function profileRoute(ctx: Ctx, name: string, data: JsonObject): Promise<string | undefined> {
  const routing = await loadAdoptedRouting(ctx)
  let route: string | undefined
  if (Object.hasOwn(routing, name)) route = routing[name] ?? undefined
  else if (isPlainObject(getPath(data, providerPath(name)))) route = name
  validateRoute(data, route)
  return route
}

export function validateRoute(data: JsonObject, route: string | undefined): void {
  if (route === undefined || RESERVED_PROVIDER_IDS.includes(route)) return
  if (!isPlainObject(getPath(data, providerPath(route)))) {
    throw new ValidationError('codex.error.missingRoute', { id: route })
  }
}
