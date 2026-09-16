import { lexer, type Tokens } from 'marked'
import { createSlugger, headingText } from './slug.js'

export interface Heading {
  depth: 2 | 3
  text: string
  id: string
}

/** h2/h3 outline of a Markdown document, with the same ids the renderer emits. */
export function extractHeadings(markdown: string): Heading[] {
  const slugger = createSlugger()
  const headings: Heading[] = []
  for (const token of lexer(markdown)) {
    if (token.type !== 'heading') continue
    const heading = token as Tokens.Heading
    if (heading.depth !== 2 && heading.depth !== 3) continue
    const text = headingText(heading.text)
    headings.push({ depth: heading.depth, text, id: slugger(text) })
  }
  return headings
}
