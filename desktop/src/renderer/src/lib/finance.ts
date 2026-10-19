import { format } from 'date-fns'
import { parseIsoDate } from '@shared/dates'
import type { SituacaoCobranca } from '@shared/finance'
import { useConnection } from '@renderer/lib/connection'

export function useComputador(): string {
  return useConnection().info?.name || 'Este computador'
}

export const FINANCE_CRUMB = { label: 'Financeiro', to: '/financeiro' }

export const formatDay = (iso: string): string => format(parseIsoDate(iso), 'dd/MM/yyyy')

export const formatShortDay = (iso: string): string => format(parseIsoDate(iso), 'dd/MM')

export const SITUACAO_LABELS: Record<SituacaoCobranca, string> = {
  pago: 'Pago',
  parcial: 'Parcial',
  em_aberto: 'Em aberto'
}

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}
