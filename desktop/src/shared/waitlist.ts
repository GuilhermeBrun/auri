import { z } from 'zod'
import { differenceInCalendarDays } from 'date-fns'
import { isIsoDate, isIsoLocalDateTime, parseIsoDate } from './dates'
import { PERIODOS, type Intervalo, type Periodo, type Prioridade } from './encaixe'
import { APPOINTMENT_TIPOS, idSchema, type AppointmentTipo } from './schemas'

export const PRIORIDADES = ['normal', 'alta'] as const satisfies readonly Prioridade[]

export const DURACAO_ESPERA_MAX = 240

const duracaoSchema = z
  .number()
  .int()
  .min(15, 'Use pelo menos 15 minutos')
  .max(DURACAO_ESPERA_MAX, `Use no máximo ${DURACAO_ESPERA_MAX} minutos`)
  .multipleOf(15, 'Use múltiplos de 15 minutos')

const diasSchema = z
  .array(z.number().int().min(0).max(6))
  .max(7)
  .transform((dias) => [...new Set(dias)].sort((a, b) => a - b))

const periodosSchema = z
  .array(z.enum(PERIODOS))
  .max(PERIODOS.length)
  .transform((periodos) => PERIODOS.filter((p) => periodos.includes(p)))

export const waitlistInputSchema = z.object({
  tipo: z.enum(APPOINTMENT_TIPOS).default('sessao'),
  duracao: duracaoSchema,
  dias: diasSchema.default([]),
  periodos: periodosSchema.default([]),
  prioridade: z.enum(PRIORIDADES).default('normal'),
  observacao: z.string().trim().max(1000, 'Use no máximo 1000 caracteres').default('')
})

export type WaitlistInput = z.input<typeof waitlistInputSchema>

export const waitlistAddSchema = waitlistInputSchema.extend({ patient_id: idSchema })

export type WaitlistAdd = z.input<typeof waitlistAddSchema>

export type WaitlistEntry = {
  id: number
  patient_id: number
  patient_nome: string
  tipo: AppointmentTipo
  duracao: number
  dias: number[]
  periodos: Periodo[]
  prioridade: Prioridade
  observacao: string
  created_at: string
  updated_at: string
}

export const waitlistCloseSchema = z.discriminatedUnion('motivo', [
  z.object({ motivo: z.literal('removido') }),
  z.object({ motivo: z.literal('agendado'), appointment_id: idSchema })
])

export type WaitlistClose = z.input<typeof waitlistCloseSchema>

export const SUGESTAO_DIAS_MAX = 62

export const sugestaoPedidoSchema = z
  .object({
    patient_id: idSchema,
    duracao: duracaoSchema,
    dias: diasSchema.default([]),
    periodos: periodosSchema.default([]),
    de: z.string().refine(isIsoDate, 'Data inválida'),
    ate: z.string().refine(isIsoDate, 'Data inválida'),
    ignorar_appointment_id: idSchema.optional(),
    margem: z.number().int().min(0).max(240).optional()
  })
  .refine((p) => p.ate >= p.de, 'Intervalo inválido')
  .refine(
    (p) => differenceInCalendarDays(parseIsoDate(p.ate), parseIsoDate(p.de)) < SUGESTAO_DIAS_MAX,
    `Procure em no máximo ${SUGESTAO_DIAS_MAX} dias`
  )

export type SugestaoPedido = z.input<typeof sugestaoPedidoSchema>

const localDateTime = z.string().refine(isIsoLocalDateTime, 'Data/hora inválida')

export const vagaSchema = z
  .object({
    inicio: localDateTime,
    fim: localDateTime,
    margem: z.number().int().min(0).max(240).optional()
  })
  .refine((v) => v.fim > v.inicio, 'Intervalo inválido')

export type Vaga = z.input<typeof vagaSchema>

export type EncaixeNaVaga = Intervalo & { espera: WaitlistEntry; preferida: boolean }
