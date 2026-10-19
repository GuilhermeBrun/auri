import { z } from 'zod'
import { isValidCpf } from './cpf'
import { isIsoDate, isIsoLocalDateTime } from './dates'
import { isValidPhone } from './masks'

const text = (max = 200): z.ZodString =>
  z.string().trim().max(max, `Use no máximo ${max} caracteres`)

const optionalDate = text(10).refine((v) => v === '' || isIsoDate(v), 'Data inválida')
const optionalCpf = text(14).refine((v) => v === '' || isValidCpf(v), 'CPF inválido')
const optionalPhone = text(15).refine((v) => v === '' || isValidPhone(v), 'Telefone inválido')
const optionalEmail = text().refine(
  (v) => v === '' || z.email().safeParse(v).success,
  'E-mail inválido'
)

export const RESPONSAVEL_TIPOS = ['mae', 'pai', 'outro'] as const
export type ResponsavelTipo = (typeof RESPONSAVEL_TIPOS)[number]

export const PARENTESCOS = ['avo_f', 'avo_m', 'tia', 'tio', 'outro'] as const
export type Parentesco = (typeof PARENTESCOS)[number]

export const patientInputSchema = z
  .object({
    nome: text().min(1, 'Informe o nome do paciente'),
    data_nascimento: optionalDate,
    cpf: optionalCpf,
    celular: optionalPhone,
    email: optionalEmail,

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
    pai_cpf: optionalCpf,
    pai_rg: text(30),
    pai_celular: optionalPhone,
    pai_email: optionalEmail,
    pai_profissao: text(),

    resp_tipo: z.enum(['', ...RESPONSAVEL_TIPOS]),
    resp_nome: text(),
    resp_parentesco: z.enum(['', ...PARENTESCOS]),
    resp_parentesco_outro: text(60),
    resp_cpf: optionalCpf,
    resp_rg: text(30),
    resp_celular: optionalPhone,
    resp_email: optionalEmail,

    endereco: text(),
    bairro: text(),
    cidade: text(),

    indicacao: text(),
    pediatra: text(),
    data_entrada: optionalDate,
    observacoes: text(5000)
  })
  .superRefine((p, ctx) => {
    const missing = (path: string, message: string): void => {
      ctx.addIssue({ code: 'custom', path: [path], message })
    }
    if (p.resp_tipo === 'mae' && p.mae_nome === '')
      missing('mae_nome', 'Informe o nome da mãe, que é a responsável')
    if (p.resp_tipo === 'pai' && p.pai_nome === '')
      missing('pai_nome', 'Informe o nome do pai, que é o responsável')
    if (p.resp_tipo !== 'outro') return
    if (p.resp_nome === '') missing('resp_nome', 'Informe o nome do responsável')
    if (p.resp_parentesco === '') missing('resp_parentesco', 'Escolha o parentesco')
    if (p.resp_parentesco === 'outro' && p.resp_parentesco_outro === '')
      missing('resp_parentesco_outro', 'Diga qual é o parentesco')
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

export const APPOINTMENT_TIPOS = ['sessao', 'avaliacao'] as const
export type AppointmentTipo = (typeof APPOINTMENT_TIPOS)[number]

export const PRESENCAS = ['presente', 'falta', 'desmarcou'] as const
export type Presenca = (typeof PRESENCAS)[number]

export const appointmentInputSchema = z
  .object({
    patient_id: idSchema,
    inicio: localDateTime,
    fim: localDateTime,
    observacao: text(1000),
    tipo: z.enum(APPOINTMENT_TIPOS).default('sessao'),
    presenca: z.enum([...PRESENCAS, '']).default(''),
    evolucao: text(10000).default('')
  })
  .refine((a) => a.fim > a.inicio, {
    message: 'O horário de término deve ser depois do início',
    path: ['fim']
  })

export type AppointmentInput = z.input<typeof appointmentInputSchema>

export type Appointment = z.output<typeof appointmentInputSchema> & {
  id: number
  patient_nome: string
  created_at: string
  updated_at: string
}

export const appointmentRangeSchema = z
  .object({ de: localDateTime, ate: localDateTime })
  .refine((r) => r.ate > r.de, 'Intervalo inválido')

export const anamneseInputSchema = z.object({
  data: optionalDate,
  queixa: text(10000),
  gestacao: text(10000),
  alimentacao: text(10000),
  sono: text(10000),
  desenvolvimento: text(10000),
  saude: text(10000),
  rotina: text(10000),
  terapias: text(10000),
  observacoes: text(10000)
})

export type AnamneseInput = z.infer<typeof anamneseInputSchema>

export const ANAMNESE_FIELDS = Object.keys(anamneseInputSchema.shape) as (keyof AnamneseInput)[]

export function emptyAnamneseInput(): AnamneseInput {
  return Object.fromEntries(ANAMNESE_FIELDS.map((f) => [f, ''])) as AnamneseInput
}

export type Anamnese = AnamneseInput & { patient_id: number; updated_at: string | null }

export const themeSchema = z.enum(['system', 'light', 'dark'])

export type Theme = z.infer<typeof themeSchema>

export const uiPrefsSchema = z.object({ sidebarOpen: z.boolean(), theme: themeSchema })

export type UiPrefs = z.infer<typeof uiPrefsSchema>
