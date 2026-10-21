import { z } from 'zod'
import { isIsoDate } from './dates'
import { CENTAVOS_MAX } from './money'
import type { Categoria } from './tipos'

const text = (max: number): z.ZodString =>
  z.string().trim().max(max, `Use no máximo ${max} caracteres`)

const isoDate = z.string().refine(isIsoDate, 'Data inválida')

const centavos = z
  .number({ error: 'Informe o valor' })
  .int('Valor inválido')
  .min(0, 'Valor inválido')
  .max(CENTAVOS_MAX, 'Valor alto demais')

const positivo = centavos.refine((v) => v > 0, 'Informe o valor')

const ref = z.number().int().positive()

export const FORMAS_COBRANCA = ['particular', 'pacote', 'convenio'] as const
export type FormaCobranca = (typeof FORMAS_COBRANCA)[number]

export const FORMA_COBRANCA_LABELS: Record<FormaCobranca, string> = {
  particular: 'Particular por sessão',
  pacote: 'Pacote',
  convenio: 'Convênio'
}

export const FORMAS_PAGAMENTO = ['pix', 'dinheiro', 'cartao', 'transferencia'] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência'
}

export const MOTIVOS_COBRANCA = ['sessao', 'falta_cobrada', 'pacote', 'avulsa'] as const
export type MotivoCobranca = (typeof MOTIVOS_COBRANCA)[number]

export const serviceInputSchema = z.object({
  nome: text(80).min(1, 'Dê um nome ao serviço'),
  valor_centavos: centavos,
  padrao: z.boolean().optional()
})
export type ServiceInput = z.infer<typeof serviceInputSchema>

export const planInputSchema = z.object({
  nome: text(80).min(1, 'Dê um nome ao pacote'),
  sessoes: z
    .number({ error: 'Informe quantas sessões' })
    .int('Número inválido')
    .min(1, 'Pelo menos 1 sessão')
    .max(100, 'No máximo 100 sessões'),
  valor_centavos: positivo,
  validade_dias: z
    .number()
    .int('Número inválido')
    .min(1, 'Pelo menos 1 dia')
    .max(730, 'No máximo 730 dias')
    .nullable()
})
export type PlanInput = z.infer<typeof planInputSchema>

export const insurerInputSchema = z.object({
  nome: text(80).min(1, 'Dê o nome do convênio'),
  valor_sessao_centavos: centavos
})
export type InsurerInput = z.infer<typeof insurerInputSchema>

export const billingInputSchema = z
  .object({
    forma: z.enum(FORMAS_COBRANCA),
    service_id: ref.nullable(),
    insurer_id: ref.nullable(),
    plan_id: ref.nullable().optional(),
    carteirinha: text(40),
    desde: isoDate
  })
  .superRefine((b, ctx) => {
    if (b.forma === 'pacote' && (b.plan_id ?? null) === null)
      ctx.addIssue({ code: 'custom', path: ['plan_id'], message: 'Escolha o pacote' })
    if (b.forma !== 'convenio' && b.service_id === null)
      ctx.addIssue({ code: 'custom', path: ['service_id'], message: 'Escolha o valor da sessão' })
    if (b.forma === 'convenio' && b.insurer_id === null)
      ctx.addIssue({ code: 'custom', path: ['insurer_id'], message: 'Escolha o convênio' })
  })
export type BillingInput = z.infer<typeof billingInputSchema>

export const packageInputSchema = z.object({ plan_id: ref, inicio: isoDate })
export type PackageInput = z.infer<typeof packageInputSchema>

export const contratarSchema = z.object({ inicio: isoDate }).nullable()
export type Contratar = z.infer<typeof contratarSchema>

export const FORA_DO_PACOTE = ' · fora do pacote'

export const chargeInputSchema = z.object({
  descricao: text(120).min(1, 'Diga o que está sendo cobrado'),
  valor_centavos: positivo,
  data: isoDate
})
export type ChargeInput = z.infer<typeof chargeInputSchema>

export const paymentInputSchema = z.object({
  valor_centavos: positivo,
  data: isoDate,
  forma: z.enum(FORMAS_PAGAMENTO),
  insurer_id: ref.nullable(),
  observacao: text(300)
})
export type PaymentInput = z.infer<typeof paymentInputSchema>

export const LANCAMENTOS = ['charge', 'payment', 'package', 'use'] as const
export type Lancamento = (typeof LANCAMENTOS)[number]

export const lancamentoSchema = z.enum(LANCAMENTOS)

export const estornoMotivoSchema = text(300).min(1, 'Diga por que está estornando')

export const financeRangeSchema = z
  .object({ de: isoDate, ate: isoDate })
  .refine((r) => r.ate >= r.de, 'Intervalo inválido')

export type Estorno = { em: string; motivo: string; computador: string } | null

export type FinanceService = Omit<ServiceInput, 'padrao'> & {
  id: number
  arquivado: boolean
  padrao: boolean
}
export type FinancePlan = PlanInput & { id: number; arquivado: boolean }
export type FinanceInsurer = InsurerInput & { id: number; arquivado: boolean }

export type FinanceCatalog = {
  services: FinanceService[]
  plans: FinancePlan[]
  insurers: FinanceInsurer[]
}

export type Billing = Omit<BillingInput, 'plan_id'> & {
  plan_id: number | null
  plan: { nome: string; sessoes: number; valor_centavos: number } | null
  service: { nome: string; valor_centavos: number } | null
  insurer: { nome: string; valor_sessao_centavos: number } | null
  padrao: boolean
  updated_at: string
}

export type PatientPackage = {
  id: number
  nome: string
  sessoes: number
  usadas: number
  valor_centavos: number
  inicio: string
  validade: string | null
  em_vigor: boolean
  estorno: Estorno
}

export type SituacaoCobranca = 'pago' | 'parcial' | 'em_aberto'

export type ChargeEntry = {
  id: number
  data: string
  descricao: string
  valor_centavos: number
  motivo: MotivoCobranca
  appointment_id: number | null
  package_id: number | null
  insurer_id: number | null
  insurer_nome: string | null
  computador: string
  created_at: string
  estorno: Estorno
  situacao: SituacaoCobranca | null
  pago_centavos: number
}

export type PaymentEntry = {
  id: number
  data: string
  valor_centavos: number
  forma: FormaPagamento
  insurer_id: number | null
  insurer_nome: string | null
  observacao: string
  computador: string
  created_at: string
  estorno: Estorno
}

export type PackageUseEntry = {
  id: number
  package_id: number
  package_nome: string
  appointment_id: number
  inicio: string
  numero: number | null
  sessoes: number
  computador: string
  created_at: string
  estorno: Estorno
}

export type PendingSession = {
  appointment_id: number
  inicio: string
  tipo_nome: string
  categoria: Categoria
}

export type SituacaoRenovacao = 'acabando' | 'acabou' | 'venceu'

export type Renovacao = {
  plan_id: number
  nome: string
  valor_centavos: number
  situacao: SituacaoRenovacao
  restantes: number
}

export type SaldoConvenio = { insurer_id: number; nome: string; saldo_centavos: number }

export type PatientFinance = {
  patient_id: number
  billing: Billing | null
  saldo_centavos: number
  convenios: SaldoConvenio[]
  packages: PatientPackage[]
  charges: ChargeEntry[]
  payments: PaymentEntry[]
  uses: PackageUseEntry[]
  pendentes: PendingSession[]
  renovacao: Renovacao | null
}

export type SessionPayStatus =
  | { appointment_id: number; situacao: 'sem_lancamento' }
  | {
      appointment_id: number
      situacao: 'pacote'
      package_id: number
      numero: number
      sessoes: number
    }
  | {
      appointment_id: number
      situacao: SituacaoCobranca
      charge_id: number
      valor_centavos: number
      insurer_nome: string | null
    }

export type FinanceOverview = {
  de: string
  ate: string
  abertos: { patient_id: number; nome: string; saldo_centavos: number; desde: string }[]
  convenios: SaldoConvenio[]
  renovar: (Renovacao & { patient_id: number; patient_nome: string })[]
  recebimentos: (PaymentEntry & { patient_id: number; patient_nome: string })[]
  total_centavos: number
  por_forma: Record<FormaPagamento, number>
}
