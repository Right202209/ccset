import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageProvider } from '../../i18n/index.js'
import { TerminalDemo } from './TerminalDemo.js'

function renderDemo(stepMs = 1): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <LanguageProvider>
        <TerminalDemo stepMs={stepMs} />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  localStorage.clear()
})

describe('TerminalDemo', () => {
  it('starts with the install command and replays to the activation line', async () => {
    renderDemo()
    expect(screen.getByText('npx @droite/ccset')).toBeInTheDocument()
    expect(screen.queryByText(/claude --settings/)).not.toBeInTheDocument()
    expect(await screen.findByText(/claude --settings/, {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByText('Provider saved')).toBeInTheDocument()
    expect(screen.getByText(/sk-••••••••/)).toBeInTheDocument()
  })

  it('replays localized catalog strings for zh-Hans readers', async () => {
    localStorage.setItem('ccset-lang', 'zh-Hans')
    renderDemo()
    expect(await screen.findByText('提供商已保存', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(await screen.findByText(/启用命令/, {}, { timeout: 2000 })).toBeInTheDocument()
  })
})
