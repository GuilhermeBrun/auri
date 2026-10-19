import { format } from 'date-fns'
import { parseIsoDate } from '@shared/dates'
import type { ChargeEntry, PatientFinance, SituacaoCobranca } from '@shared/finance'
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

export type SessionPay =
  | { kind: 'pacote'; nome: string; numero: number; sessoes: number }
  | {
      kind: 'cobranca'
      motivo: ChargeEntry['motivo']
      valor_centavos: number
      pago_centavos: number
      situacao: SituacaoCobranca
      convenio: string | null
    }
  | { kind: 'nenhum' }

export function sessionPay(finance: PatientFinance, appointmentId: number): SessionPay {
  const use = finance.uses.find((u) => u.appointment_id === appointmentId && !u.estorno)
  if (use)
    return { kind: 'pacote', nome: use.package_nome, numero: use.numero ?? 0, sessoes: use.sessoes }
  const charge = finance.charges.find((c) => c.appointment_id === appointmentId && !c.estorno)
  if (charge)
    return {
      kind: 'cobranca',
      motivo: charge.motivo,
      valor_centavos: charge.valor_centavos,
      pago_centavos: charge.pago_centavos,
      situacao: charge.situacao ?? 'em_aberto',
      convenio: charge.insurer_nome
    }
  return { kind: 'nenhum' }
}

export function sessionPayLabel(pay: SessionPay): string | null {
  if (pay.kind === 'pacote') return `${pay.numero}/${pay.sessoes} do pacote`
  if (pay.kind === 'nenhum') return null
  const falta = pay.motivo === 'falta_cobrada' ? 'Falta cobrada · ' : ''
  if (pay.convenio) return `${falta}${pay.situacao === 'pago' ? 'Pago pelo convênio' : 'Convênio'}`
  return `${falta}${SITUACAO_LABELS[pay.situacao]}`
}
