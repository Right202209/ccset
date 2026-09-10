import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

/**
 * The §7 code-quality gates of `Important Documentation.md`, executed instead
 * of remembered: files <= 300 lines, functions <= 50 non-blank lines,
 * cyclomatic complexity <= 10 per function. Line counts measure every file;
 * the function rules read the TypeScript AST, so JSX and arrow bodies count.
 *
 * The functions over the limit today predate this gate and live in files this
 * change did not touch -- the register's rule is "enforced on every file
 * touched". They are listed in BASELINE, the ratchet that keeps the debt
 * visible instead of forgotten: every entry must still match a live violation,
 * so fixing one forces the entry's removal, and a new violation with no entry
 * fails the gate.
 */

const MAX_FILE_LINES = 300
const MAX_FUNCTION_LINES = 50
const MAX_COMPLEXITY = 10

const BASELINE: readonly string[] = [
  'src/agents/claude-code/commands.ts:proxyWrites',
  'src/agents/codex/actions.ts:openProviders',
  'src/agents/codex/status-dto.ts:codexStatusFindings',
  'src/commands/parser.ts:readOption',
  'src/core/toml/check.ts:checkBasic',
  'src/core/toml/check.ts:checkBare',
  'src/core/toml/edit.ts:findDottedAnchor',
  'src/ui/App.tsx:App',
  'src/ui/SelectList.tsx:(anonymous)@42',
  'src/ui/SelectList.tsx:SelectList',
  'src/ui/Status.tsx:StatusView',
  'src/ui/TextField.tsx:(anonymous)@63',
  'src/ui/TextField.tsx:TextField',
  'src/ui/useReviewForm.ts:(anonymous)@133',
  'src/ui/useReviewForm.ts:useFormInput',
  'src/ui/useReviewForm.ts:useReviewForm',
  'src/ui/useScreens.ts:useScreens',
  'scripts/verify-viewport.ts:verifyShortStatus',
]

/** Every construct the register's complexity rule counts, one entry each. */
const BRANCH_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
])

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.verify', '.scratch'])

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) files.push(...walk(path.join(dir, entry.name)))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(path.join(dir, entry.name))
    }
  }
  return files
}

function complexityOf(node: ts.Node): number {
  let count = 1
  const visit = (child: ts.Node): void => {
    if (BRANCH_KINDS.has(child.kind)) count += 1
    child.forEachChild(visit)
  }
  node.forEachChild(visit)
  return count
}

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ArrowFunction
  | ts.FunctionExpression
  | ts.ConstructorDeclaration

function isFunction(node: ts.Node): node is FunctionLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isConstructorDeclaration(node)
  )
}

interface Violation {
  key: string
  detail: string
}

function checkFile(file: string): Violation[] {
  const violations: Violation[] = []
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')
  if (lines.length > MAX_FILE_LINES) {
    violations.push({ key: `${file}:file`, detail: `${lines.length} lines` })
  }
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const visit = (node: ts.Node): void => {
    if (isFunction(node)) {
      // Anonymous functions are keyed by line: a closure has no name, and the
      // line makes a moved or fixed entry visibly stale instead of silently
      // matching a different function.
      const rawName = node.name?.getText(source) ?? '(anonymous)'
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line
      const name = rawName === '(anonymous)' ? `${rawName}@${start + 1}` : rawName
      const end = source.getLineAndCharacterOfPosition(node.getEnd()).line
      let nonBlank = 0
      for (let index = start; index <= end; index += 1) {
        if (lines[index]?.trim().length !== 0) nonBlank += 1
      }
      const key = `${file}:${name}`
      if (nonBlank > MAX_FUNCTION_LINES) {
        violations.push({ key, detail: `${nonBlank} non-blank lines` })
      } else {
        const complexity = complexityOf(node)
        if (complexity > MAX_COMPLEXITY) {
          violations.push({ key, detail: `complexity ${complexity}` })
        }
      }
    }
    node.forEachChild(visit)
  }
  source.forEachChild(visit)
  return violations
}

function main(): void {
  const files = [...walk('src'), ...walk('scripts')]
  assert.ok(files.length > 50, `the walk found only ${files.length} files`)
  const found: Violation[] = files.flatMap((file) => checkFile(file))
  const used = new Set<string>()
  const fresh: Violation[] = []
  for (const violation of found) {
    if (BASELINE.includes(violation.key)) used.add(violation.key)
    else fresh.push(violation)
  }
  const stale = BASELINE.filter((entry) => !used.has(entry))
  assert.deepEqual(
    fresh,
    [],
    `code-quality gates violated (raise the code, or the register first):\n${fresh.map((v) => `  ${v.key}: ${v.detail}`).join('\n')}`,
  )
  assert.deepEqual(
    stale,
    [],
    `baseline entries no longer match a violation -- remove them:\n${stale.join('\n')}`,
  )
  process.stdout.write(`Code-quality gates passed over ${files.length} files (${BASELINE.length} baseline exceptions).\n`)
}

main()
