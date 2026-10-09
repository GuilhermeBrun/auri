import { z } from 'zod'
import { isValidCpf } from './cpf'
import { isIsoDate, isIsoLocalDateTime } from './dates'
import { isValidPhone } from './masks'

// Campos opcionais chegam como '' quando vazios (é o que os inputs produzem).
const text = (max = 200): z.ZodString =>
  z.string().trim().max(max, `Use no máximo ${max} caracteres`)

const optionalDate = text(10).refine((v) => v === '' || isIsoDate(v), 'Data inválida')
const optionalCpf = text(14).refine((v) => v === '' || isValidCpf(v), 'CPF inválido')
const optionalPhone = text(15).refine((v) => v === '' || isValidPhone(v), 'Telefone inválido')
const optionalEmail = text().refine(
  (v) => v === '' || z.email().safeParse(v).success,
  'E-mail inválido'
)

export const patientInputSchema = z.object({
  nome: text().min(1, 'Informe o nome do paciente'),
  data_nascimento: optionalDate,
  cpf: optionalCpf,

  escola: text(),
  serie: text(),
  professora: text(),

  mae_nome: text(),
  mae_cpf: optionalCpf,
  mae_rg: text(30),
  mae_celular: optionalPhone,
  mae_email: optionalEmail,
  mae_profissao: text(),

  pai_nome: text(),
  pai_profissao: text(),

  endereco: text(),
  bairro: text(),
  cidade: text(),

  indicacao: text(),
  pediatra: text(),
  data_entrada: optionalDate,
  observacoes: text(5000)
})

export type PatientInput = z.infer<typeof patientInputSchema>

export const PATIENT_FIELDS = Object.keys(patientInputSchema.shape) as (keyof PatientInput)[]

export function emptyPatientInput(): PatientInput {
  return Object.fromEntries(PATIENT_FIELDS.map((f) => [f, ''])) as PatientInput
}

export type Patient = PatientInput & {
  id: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export const patientFilterSchema = z.object({
  busca: z.string().trim().max(200).default(''),
  incluirInativos: z.boolean().default(false)
})

export type PatientFilter = z.input<typeof patientFilterSchema>

export const idSchema = z.number().int().positive()

const localDateTime = z.string().refine(isIsoLocalDateTime, 'Data/hora inválida')

export const appointmentInputSchema = z
  .object({
    patient_id: idSchema,
    inicio: localDateTime,
    fim: localDateTime,
    observacao: text(1000)
  })
  .refine((a) => a.fim > a.inicio, {
    message: 'O horário de término deve ser depois do início',
    path: ['fim']
  })

export type AppointmentInput = z.infer<typeof appointmentInputSchema>

export type Appointment = AppointmentInput & {
  id: number
  patient_nome: string
  created_at: string
  updated_at: string
}

export const appointmentRangeSchema = z
  .object({ de: localDateTime, ate: localDateTime })
  .refine((r) => r.ate > r.de, 'Intervalo inválido')

/** Tema: o do sistema (muda junto com ele) ou um fixo. */
export const themeSchema = z.enum(['system', 'light', 'dark'])

export type Theme = z.infer<typeof themeSchema>

/** Preferências da interface (não são dados da clínica). */
export const uiPrefsSchema = z.object({ sidebarOpen: z.boolean(), theme: themeSchema })

export type UiPrefs = z.infer<typeof uiPrefsSchema>
