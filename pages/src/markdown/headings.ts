import { lexer, type Token, type Tokens } from 'marked'
import { createSlugger, headingText } from './slug.js'

export interface Heading {
  depth: 2 | 3
  text: string
  id: string
}

/**
 * h2/h3 outline of a Markdown document. Every heading token in the tree is
 * slugged in document order — top-level or nested, any depth — which is
 * exactly what the renderer does, so TOC ids stay the rendered ids even when
 * heading texts repeat across levels.
 */
export function extractHeadings(markdown: string): Heading[] {
  const slugger = createSlugger()
  const headings: Heading[] = []
  collect(lexer(markdown), slugger, headings)
  return headings
}

function collect(tokens: Token[], slug: (text: string) => string, out: Heading[]): void {
  for (const token of tokens) {
    if (token.type === 'heading') {
      const heading = token as Tokens.Heading
      const text = headingText(heading.text)
      const id = slug(text)
      if (heading.depth === 2 || heading.depth === 3) out.push({ depth: heading.depth, text, id })
    }
    const nested = (token as { tokens?: Token[] }).tokens
    if (nested !== undefined) collect(nested, slug, out)
  }
}
