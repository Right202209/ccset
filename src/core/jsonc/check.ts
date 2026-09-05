import { parseTree, type ParseError } from 'jsonc-parser'
import { describePosition } from '../position.js'

/**
 * Syntax check for a JSONC target. The parser is npm's jsonc-parser (ADR 0004);
 * this is the strict pass that decides whether ccset may rewrite the file at
 * all. A file that fails here reaches the user as the same "back it up and
 * start fresh" confirm a malformed JSON target does -- ccset must never
 * silently overwrite something it could not read.
 *
 * Comments and trailing commas are what make the format JSONC, and opencode
 * parses with both allowed, so neither is a problem. Everything JSON.parse
 * rejects still fails here: jsonc-parser reports non-fatal parse errors
 * alongside the tree it managed to build, and any error at all disqualifies the
 * document. An empty or whitespace-only document is sound and holds nothing.
 */

/** Position of the first syntax problem, or null when the document is sound. */
export function findJsoncProblem(text: string): string | null {
  if (text.trim().length === 0) return null
  const errors: ParseError[] = []
  const root = parseTree(text, errors, { allowTrailingComma: true })
  if (errors.length === 0 && root !== undefined && root.type === 'object') return null
  const first = errors[0]
  return describePosition(text, first !== undefined ? first.offset : (root?.offset ?? 0))
}
