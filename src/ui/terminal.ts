/**
 * Terminal capability: what the terminal in front of the core user can render.
 * One glyph set and one color set, chosen here and nowhere else.
 *
 * Before this module the focus color was spelled out in six files and the focus
 * marker in three, so changing how focus reads was a scattered edit. It is a
 * one-file edit now, which is the point: the visual work this precedes should
 * not have to visit every View to land.
 *
 * Monochrome is deliberately absent. Ink's color layer already honours NO_COLOR,
 * and a second switch here would only be a way to disagree with it.
 */
import { createContext, useContext } from 'react'
import type { MessageTone } from '../types.js'

/**
 * Decorative glyphs, plus the character the secret editor masks with. `MASK_CHAR`
 * in `core/constants.ts` still owns what `maskSecret()` produces, because that
 * output is Status *data* an agent assembles and the agent layer knows nothing
 * about the terminal. `fold` is what reconciles the two at paint time.
 */
export interface GlyphSet {
  /** Marks the row Enter acts on. Exactly one row of a paint carries it. */
  focus: string
  /** Marks a field whose value differs from what is on disk. */
  changed: string
  /** The selected and unselected states of a choice field. */
  radioOn: string
  radioOff: string
  mask: string
  /** Separates Frame titles in the header's navigation path. */
  pathSeparator: string
}

export interface ColorSet {
  /** The focused row of a list, a form, or a Status item. */
  focus: string
  /** The application title and a Status section title. */
  heading: string
  tone: Record<MessageTone, string>
}

export interface Terminal {
  glyphs: GlyphSet
  colors: ColorSet
  busyFrames: readonly string[]
  fold: (text: string) => string
}

export const UNICODE_GLYPHS: GlyphSet = {
  focus: '❯',
  changed: '*',
  radioOn: '(•)',
  radioOff: '( )',
  mask: '•',
  pathSeparator: '›',
}

/**
 * The changed marker is already ASCII and `form.help` names it literally, so
 * both sets spell it the same way rather than letting the legend go stale.
 */
export const ASCII_GLYPHS: GlyphSet = {
  focus: '>',
  changed: '*',
  radioOn: '(*)',
  radioOff: '( )',
  mask: '*',
  pathSeparator: '>',
}

export const UNICODE_BUSY_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const
export const ASCII_BUSY_FRAMES = ['-', '\\', '|', '/'] as const

/**
 * The non-ASCII characters `src/i18n/en.ts` actually uses, each mapped to what a
 * seven-bit terminal can draw. Only these are mapped: a catalog in another
 * language has to pass through untouched rather than be transliterated.
 */
const ASCII_FOLDS: Record<string, string> = {
  '↑': '^',
  '↓': 'v',
  '←': '<',
  '→': '>',
  '·': '.',
  '—': '--',
  '…': '...',
  '•': '*',
}

/**
 * Built from the keys so adding a fold cannot forget to widen the pattern. Every
 * key is non-ASCII, so none of them can be a character class metacharacter.
 */
const FOLDABLE = new RegExp(`[${Object.keys(ASCII_FOLDS).join('')}]`, 'g')

function foldAscii(text: string): string {
  return text.replace(FOLDABLE, (character) => ASCII_FOLDS[character] ?? character)
}

/** The Unicode terminal draws the catalog as written. */
const identity = (text: string): string => text

/**
 * One color set, shared by both glyph sets: what the terminal can *draw* and what
 * it can *color* are independent, and only the glyphs vary here.
 */
export const COLORS: ColorSet = {
  focus: 'cyan',
  heading: 'cyan',
  tone: {
    success: 'green',
    error: 'red',
    warn: 'yellow',
    info: 'cyan',
  },
}

export const UNICODE_TERMINAL: Terminal = {
  glyphs: UNICODE_GLYPHS,
  colors: COLORS,
  busyFrames: UNICODE_BUSY_FRAMES,
  fold: identity,
}
export const ASCII_TERMINAL: Terminal = {
  glyphs: ASCII_GLYPHS,
  colors: COLORS,
  busyFrames: ASCII_BUSY_FRAMES,
  fold: foldAscii,
}

/**
 * CCSET_ASCII=1 for a terminal that cannot draw the Unicode set, following the
 * precedent CCSET_HOME set: an environment override, read once at the boundary.
 * A capability is a property of the environment, not a user preference, so there
 * is no setting for it.
 */
const ASCII_ENV = 'CCSET_ASCII'
const ASCII_ON = '1'

/** Read only by `cli.tsx`; every other caller is handed a Terminal explicitly. */
export function resolveTerminal(env: NodeJS.ProcessEnv = process.env): Terminal {
  return env[ASCII_ENV] === ASCII_ON ? ASCII_TERMINAL : UNICODE_TERMINAL
}

/**
 * Unicode is the default a component falls back to, so a View rendered outside
 * a provider still draws something legible rather than nothing.
 */
export const TerminalContext = createContext<Terminal>(UNICODE_TERMINAL)

export function useTerminal(): Terminal {
  return useContext(TerminalContext)
}

/** undefined leaves the text at the terminal's own foreground color. */
export function toneColor(colors: ColorSet, tone?: MessageTone): string | undefined {
  return tone === undefined ? undefined : colors.tone[tone]
}

/**
 * The gutter a marked row reserves. The unmarked row pads to the same width, so
 * gaining or losing a marker never shifts the text beside it.
 */
export function markerGutter(marker: string, shown: boolean): string {
  return shown ? `${marker} ` : ' '.repeat(marker.length + 1)
}

export function focusGutter(glyphs: GlyphSet, focused: boolean): string {
  return markerGutter(glyphs.focus, focused)
}
