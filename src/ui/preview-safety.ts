import { t } from '../i18n/index.js'
import type { KeyedLine } from '../operations/types.js'
import type { StatusLine } from '../types.js'

const SENSITIVE_LABEL = /token|secret|password|passwd|api.?key|credential|authorization|密钥|令牌|密码|凭证|口令|授权/i
const ABSENT_KEYS = ['status.no', 'status.unset', 'status.absent']
const URL_PREFIX = /^[a-z][a-z\d+.-]*:/i

export function glanceLine(line: KeyedLine): StatusLine {
  const label = t(line.labelKey)
  const value = line.value ?? (line.valueKey === undefined ? '' : t(line.valueKey))
  const safeValue = safeLineValue(line.labelKey, value, line.valueKey)
  return { label, value: safeValue, tone: line.tone }
}

export function previewLine(line: StatusLine): StatusLine {
  const value = safeLineValue(line.label, line.value)
  return { ...line, value }
}

export function safeDisplayValue(value: string): string {
  if (!URL_PREFIX.test(value) && !value.startsWith('//')) return value
  return safeUrlValue(value)
}

function safeLineValue(label: string, value: string, valueKey?: string): string {
  if (isSensitiveLabel(label)) return t(isAbsent(valueKey, value) ? 'status.no' : 'status.yes')
  if (isBaseUrlLabel(label)) return safeUrlValue(value)
  return safeDisplayValue(value)
}

function safeUrlValue(value: string): string {
  if (value.length === 0 || ABSENT_KEYS.some((key) => value === t(key))) return value
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return t('side.urlOmitted')
    return url.pathname === '/' ? url.origin : `${url.origin}/…`
  } catch {
    return t('side.urlOmitted')
  }
}

function isSensitiveLabel(label: string): boolean {
  return SENSITIVE_LABEL.test(label)
}

function isBaseUrlLabel(label: string): boolean {
  return label === 'field.baseUrl' || label === t('field.baseUrl')
}

function isAbsent(valueKey: string | undefined, value: string): boolean {
  return ABSENT_KEYS.includes(valueKey ?? '') || value.length === 0 || ABSENT_KEYS.some((key) => value === t(key))
}
