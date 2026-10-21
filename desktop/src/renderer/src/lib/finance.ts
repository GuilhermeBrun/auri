import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { format } from 'date-fns'
import { parseIsoDate } from '@shared/dates'
import {
  FORA_DO_PACOTE,
  type ChargeEntry,
  type PatientFinance,
  type Renovacao,
  type SituacaoCobranca,
  type SituacaoRenovacao
} from '@shared/finance'
import { formatBRL } from '@shared/money'
import { shortName } from '@shared/names'
import { useConnection } from '@renderer/lib/connection'
import { useToast } from '@renderer/lib/toast'

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

export const RENOVACAO_TITLES: Record<SituacaoRenovacao, string> = {
  acabando: 'Resta 1 sessão do pacote',
  acabou: 'O pacote acabou',
  venceu: 'O pacote venceu'
}

export const RENOVACAO_LABELS: Record<SituacaoRenovacao, string> = {
  acabando: 'Resta 1',
  acabou: 'Acabou',
  venceu: 'Venceu'
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
      fora: boolean
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
      convenio: charge.insurer_nome,
      fora: charge.descricao.endsWith(FORA_DO_PACOTE)
    }
  return { kind: 'nenhum' }
}

export function sessionPayLabel(pay: SessionPay): string | null {
  if (pay.kind === 'pacote') return `${pay.numero}/${pay.sessoes} do pacote`
  if (pay.kind === 'nenhum') return null
  if (pay.convenio) return pay.situacao === 'pago' ? 'Pago pelo convênio' : 'Convênio'
  return SITUACAO_LABELS[pay.situacao]
}

export function useRenewPackage(patient: {
  id: number
  nome: string
}): UseMutationResult<number, Error, Renovacao> {
  const toast = useToast()
  const computador = useComputador()
  return useMutation({
    mutationFn: (_: Renovacao) => window.api.finance.renewPackage(patient.id, computador),
    onSuccess: (_, renovacao) =>
      toast({
        title: 'Pacote renovado',
        description: `${shortName(patient.nome)} · ${renovacao.nome} · ${formatBRL(renovacao.valor_centavos)}`
      })
  })
}
