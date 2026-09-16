import { useLanguage } from '../../i18n/index.js'
import { CopyButton } from '../CopyButton.js'

/** Install and first commands, straight from the README's quick start. */
export function QuickStart() {
  const { t } = useLanguage()
  return (
    <section className="landing-section" id="quick-start">
      <div className="container">
        <h2 className="landing-heading">{t('quickStart.title')}</h2>
        <ol className="quickstart-steps">
          <Step
            title={t('quickStart.run.title')}
            body={t('quickStart.run.body')}
            command="npx @droite/ccset"
          />
          <Step
            title={t('quickStart.install.title')}
            body={t('quickStart.install.body')}
            command={'npm install -g @droite/ccset\nccset --agent claude-code'}
          />
          <Step
            title={t('quickStart.cli.title')}
            body={t('quickStart.cli.body')}
            command={
              'ccset --agent claude-code status --json\nccset --agent opencode global set --model example/model --dry-run'
            }
          />
        </ol>
      </div>
    </section>
  )
}

function Step({ title, body, command }: { title: string; body: string; command: string }) {
  return (
    <li className="quickstart-step">
      <div className="quickstart-copy">
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <div className="code-pill">
        <pre>
          <code>{command}</code>
        </pre>
        <CopyButton text={command} />
      </div>
    </li>
  )
}
