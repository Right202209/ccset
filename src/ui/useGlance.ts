import { useEffect, useRef, useState } from 'react'
import { CcsetError } from '../core/errors.js'
import { t } from '../i18n/index.js'
import { executeOperation } from '../operations/index.js'
import type { Finding, KeyedLine } from '../operations/types.js'
import type { Agent, Ctx, MessageTone, StatusLine } from '../types.js'
import { glanceLine } from './preview-safety.js'

export interface GlanceFinding {
  text: string
  tone: Extract<MessageTone, 'error' | 'warn'>
}

export interface GlanceState {
  state: 'loading' | 'ready' | 'failed'
  summary: StatusLine[]
  actions: Record<string, StatusLine[]>
  findings: GlanceFinding[]
}

const EMPTY: GlanceState = { state: 'loading', summary: [], actions: {}, findings: [] }
const STATUS_REQUEST = {
  operation: 'status' as const,
  patch: {},
  unsets: [] as string[],
  replaceInvalid: false,
  dryRun: false,
}

export function useGlance(agent: Agent | null, ctx: Ctx, refreshKey: unknown): GlanceState {
  const [glance, setGlance] = useState<GlanceState>(EMPTY)
  const request = useRef(0)
  const agentId = agent?.id
  useEffect(() => {
    if (agent === null) {
      request.current += 1
      setGlance(EMPTY)
      return
    }
    const current = ++request.current
    setGlance(EMPTY)
    void loadGlance(agent, ctx).then((next) => {
      if (request.current === current) setGlance(next)
    })
    return () => {
      request.current += 1
    }
  }, [agent, agentId, ctx, refreshKey])
  return glance
}

async function loadGlance(agent: Agent, ctx: Ctx): Promise<GlanceState> {
  try {
    const result = await executeOperation(agent, ctx, STATUS_REQUEST)
    const presentation = agent.commands?.operations.find((item) => item.id === 'status')?.presentation
    const glance = presentation?.presentGlance?.(result.data ?? {}) ?? { summary: [], actions: {} }
    return {
      state: 'ready',
      summary: glance.summary.map(glanceLine),
      actions: mapActions(glance.actions),
      findings: findingsOf(result.errors ?? [], result.warnings),
    }
  } catch (err) {
    return {
      state: 'failed',
      summary: [],
      actions: {},
      findings: [err instanceof CcsetError ? errorFinding(err) : { text: t('error.unexpected', { detail: 'status' }), tone: 'error' }],
    }
  }
}

function mapActions(actions: Record<string, KeyedLine[]>): Record<string, StatusLine[]> {
  return Object.fromEntries(Object.entries(actions).map(([id, lines]) => [id, lines.map(glanceLine)]))
}

function findingsOf(errors: Finding[], warnings: Finding[]): GlanceFinding[] {
  return [
    ...errors.map((finding) => ({ text: t(finding.code, finding.params ?? {}), tone: 'error' as const })),
    ...warnings.map((finding) => ({ text: t(finding.code, finding.params ?? {}), tone: 'warn' as const })),
  ]
}

function errorFinding(err: CcsetError): GlanceFinding {
  return { text: t(err.messageKey, err.params), tone: 'error' }
}
