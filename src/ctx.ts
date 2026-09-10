/**
 * The run context, in its own module so the shared vocabulary and the
 * operation vocabulary can both name it without importing each other:
 * `types.ts` needs the agent command surface from `operations/types.ts`, and
 * `operations/types.ts` needs this. One direction, no cycle.
 */

/** Everything an action needs from the process it runs in. */
export interface Ctx {
  /** Home directory root; overridable via CCSET_HOME for isolated runs. */
  home: string
}
