/**
 * Human line and column for an offset, matching the JSON reader's wording.
 * Both format codecs name where a syntax problem sits with this one shape.
 */
export function describePosition(text: string, offset: number): string {
  const before = text.slice(0, offset)
  const line = before.split('\n').length
  const column = offset - before.lastIndexOf('\n')
  return `line ${line}, column ${column}`
}
