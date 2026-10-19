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

export type ArrivalSignature = {
  id: number
  signer_nome: string
  signer_parentesco: string
  assinado_em: string
}

export type Appointment = z.output<typeof appointmentInputSchema> & {
  id: number
  patient_nome: string
  assinatura: ArrivalSignature | null
  created_at: string
  updated_at: string
}

export const SIGNER_PAPEIS = ['paciente', 'mae', 'pai', 'outro'] as const
export type SignerPapel = (typeof SIGNER_PAPEIS)[number]

export const TRACO_MAX_BASE64 = 16_000

export const arrivalSignInputSchema = z.object({
  signer_nome: text(120).min(1, 'Informe quem está assinando'),
  signer_papel: z.enum(SIGNER_PAPEIS),
  signer_parentesco: text(60).min(1, 'Informe o parentesco'),
  traco: z
    .string()
    .min(1, 'Assine no quadro')
    .max(TRACO_MAX_BASE64, 'Assinatura longa demais. Limpe e assine de novo.')
    .regex(/^[\w-]+$/, 'Assinatura inválida')
})

export type ArrivalSignInput = z.input<typeof arrivalSignInputSchema>

export const computadorSchema = text(60).min(1)

export const voidMotivoSchema = text(300).min(1, 'Diga por que a assinatura está sendo anulada')

export type AttendanceRecord = {
  id: number
  appointment_id: number
  inicio: string
  fim: string
  tipo: AppointmentTipo
  signer_nome: string
  signer_papel: SignerPapel
  signer_parentesco: string
  traco: string
  assinado_em: string
  fuso_minutos: number
  computador: string
  registro_sha256: string
  anulada: { motivo: string; anulado_em: string; computador: string } | null
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

export const LOGO_MAX_BASE64 = 400_000

export const clinicInputSchema = z.object({
  nome: text(120),
  documento: text(30),
  endereco: text(200),
  telefone: optionalPhone,
  whatsapp: optionalPhone,
  profissional: text(120),
  registro: text(40),
  logo: z
    .string()
    .max(LOGO_MAX_BASE64, 'Logo grande demais')
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Logo inválido')
})

export type ClinicInput = z.input<typeof clinicInputSchema>

export type Clinic = z.output<typeof clinicInputSchema> & { updated_at: string }

export const reportRangeSchema = z
  .object({
    de: z.string().refine(isIsoDate, 'Data inválida'),
    ate: z.string().refine(isIsoDate, 'Data inválida')
  })
  .refine((r) => r.ate >= r.de, 'Intervalo inválido')

export type AttendanceReport = {
  clinic: Clinic
  patient: { id: number; nome: string; data_nascimento: string }
  de: string
  ate: string
  sessions: (Appointment & { records: AttendanceRecord[] })[]
}

export const TERM_TEXTO_MAX = 16_000

export const termModelInputSchema = z.object({
  titulo: text(120).min(1, 'Dê um título ao termo'),
  texto: z
    .string()
    .max(TERM_TEXTO_MAX, `Use no máximo ${TERM_TEXTO_MAX} caracteres`)
    .refine((v) => v.trim() !== '', 'Escreva o texto do termo')
})

export type TermModelInput = z.infer<typeof termModelInputSchema>

export type TermModel = TermModelInput & {
  id: number
  versao: number
  arquivado: boolean
  atualizado_em: string
}

export const TERM_PRAZOS = [3, 7, 15] as const

export const termSendInputSchema = z.object({
  model_id: idSchema,
  destino: z.object({
    papel: z.enum(SIGNER_PAPEIS),
    nome: text(120).min(1, 'Informe para quem vai o termo'),
    parentesco: text(60).min(1, 'Informe o parentesco'),
    cpf: optionalCpf,
    celular: text(15).refine(isValidPhone, 'Celular inválido')
  }),
  dias: z
    .number()
    .int()
    .refine((d) => (TERM_PRAZOS as readonly number[]).includes(d), 'Prazo inválido')
})

export type TermSendInput = z.infer<typeof termSendInputSchema>

export type TermEstado = 'aguardando' | 'vencido' | 'cancelado' | 'trocado' | 'assinado'

export type SignedTermSummary = {
  id: number
  nome: string
  parentesco: string
  assinado_em: number
  fuso_minutos: number
  recebido_em: string
}

export type TermRequest = {
  id: number
  patient_id: number
  model_id: number
  titulo: string
  versao: number
  versao_atual: number
  destino_nome: string
  destino_papel: SignerPapel
  destino_parentesco: string
  destino_numero: string
  prazo: string
  created_at: string
  estado: TermEstado
  estado_em: string | null
  assinado: SignedTermSummary | null
}

export type TermLink = { link: string; mensagem: string; numero: string }

export type TermSendResult = TermLink & { request: TermRequest }

export type TermCheck =
  | { ok: false; erro: string; guardado: number | null }
  | {
      ok: true
      request: TermRequest
      patient_nome: string
      resposta: {
        nome: string
        cpf: string
        papel: SignerPapel
        parentesco: string
        assinado_em: number
        fuso_minutos: number
      }
      traco: string
      avisos: string[]
    }

export type SignedTermRecord = {
  id: number
  envio: string
  titulo: string
  versao: number
  texto: string
  texto_sha256: string
  clinica: string
  profissional: { nome: string; registro: string }
  paciente: { nome: string; nascimento: string }
  nome: string
  cpf: string
  parentesco: string
  traco: string
  assinado_em: number
  fuso_minutos: number
  recebido_em: string
  enviado_em: string
  destino_numero: string
  registro_sha256: string
  logo: string
}
