/** Fixed-position confirmation bubble; null hides it. */
export function Toast({ message }: { message: string | null }) {
  if (message === null) return null
  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
