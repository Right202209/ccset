/**
 * Landing section header. The index is a CSS counter drawn on an aria-hidden
 * span, so sections number themselves in document order and the h2 keeps
 * its plain accessible name.
 */
export function SectionHeading({ title }: { title: string }) {
  return (
    <div className="section-head">
      <span className="section-index" aria-hidden="true" />
      <h2 className="landing-heading">{title}</h2>
    </div>
  )
}
