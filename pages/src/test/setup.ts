import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// findBy* defaults to 1s; the lazy Docs chunk plus a full worker pool can
// exceed that on loaded machines, so give async assertions room to settle.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
})
