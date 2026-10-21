import { z } from 'zod'
import { resumoFuncionamento } from '../shared/agenda'
import { colorsLabel, sameColors, TEXT_SIZE_LABELS } from '../shared/aparencia'
import type { SettingsChange } from '../shared/api'
import {
  CATEGORIA_LABELS,
  COR_ANTIGA,
  mesmoNome,
  tipoInputSchema,
  type TipoInput
} from '../shared/tipos'
import {
  clinicInputSchema,
  termModelInputSchema,
  textSizeSchema,
  themeColorsSchema,
  themeSchema,
  type ClinicInput,
  type TermModelInput,
  type UiPrefs
} from '../shared/schemas'

export const SETTINGS_EXTENSION = 'auriconfig'

const kindSchema = z.enum(['google', 'onedrive', 'icloud', 'folder'])

const corDoArquivo = z.preprocess(
  (cor) => (typeof cor === 'string' ? (COR_ANTIGA[cor] ?? cor) : cor),
  z.string()
)

const tipoDoArquivo = z
  .object({
    nome: z.string(),
    categoria: z.string(),
    cor: corDoArquivo,
    duracao: z.number()
  })
  .pipe(tipoInputSchema)

const tiposDoArquivo = z
  .array(z.looseObject({ categoria: z.unknown() }))
  .max(400)
  .default([])
  .transform((tipos) => tipos.filter((tipo) => tipo.categoria !== 'marca'))
  .pipe(z.array(tipoDoArquivo))

export const SETTINGS_FORMAT = 2

const settingsFileSchema = z.object({
  app: z.literal('auri'),
  kind: z.literal('configuracoes'),
  format: z.union([z.literal(1), z.literal(SETTINGS_FORMAT)]),
  exportedAt: z.string(),
  appearance: z
    .object({
      theme: themeSchema,
      sidebarOpen: z.boolean(),
      textSize: textSizeSchema,
      colors: themeColorsSchema
    })
    .partial()
    .default({}),
  connection: z
    .object({
      role: z.enum(['server', 'client']),
      name: z.string().trim().min(1).max(60),
      sharing: z.boolean(),
      keepRunning: z.boolean(),
      openAtLogin: z.boolean(),
      remoteAccess: z.boolean(),
      notices: z.boolean()
    })
    .partial()
    .default({}),
  backup: z
    .object({
      kind: kindSchema,
      frequency: z.enum(['daily', 'change', 'manual']),
      dailyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    })
    .partial()
    .default({}),
  clinic: clinicInputSchema.partial().default({}),
  termModels: z.array(termModelInputSchema).max(200).default([]),
  tipos: tiposDoArquivo
})

export type SettingsFile = z.output<typeof settingsFileSchema>

export type SettingsSnapshot = {
  appearance: Omit<UiPrefs, 'recepcao' | 'whatsapp'>
  connection: Required<SettingsFile['connection']>
  backup: { kind: z.infer<typeof kindSchema> | null } & Required<
    Omit<SettingsFile['backup'], 'kind'>
  >
  clinic: Required<ClinicInput>
  termModels: TermModelInput[]
  tipos: TipoInput[]
}

export function buildSettingsFile(snapshot: SettingsSnapshot, now: Date = new Date()): string {
  const file: z.input<typeof settingsFileSchema> = {
    app: 'auri',
    kind: 'configuracoes',
    format: SETTINGS_FORMAT,
    exportedAt: now.toISOString(),
    appearance: snapshot.appearance,
    connection: snapshot.connection,
    backup: {
      frequency: snapshot.backup.frequency,
      dailyTime: snapshot.backup.dailyTime,
      ...(snapshot.backup.kind ? { kind: snapshot.backup.kind } : {})
    },
    clinic: Object.fromEntries(Object.entries(snapshot.clinic).filter(([, value]) => value !== '')),
    termModels: snapshot.termModels.map(({ titulo, texto }) => ({ titulo, texto })),
    tipos: snapshot.tipos.map(({ nome, categoria, cor, duracao }) => ({
      nome,
      categoria,
      cor,
      duracao
    }))
  }
  return JSON.stringify(file, null, 2)
}

export function parseSettingsFile(text: string): SettingsFile {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Este arquivo não é de configurações do Auri.')
  }
  const parsed = settingsFileSchema.safeParse(json)
  if (!parsed.success) {
    const app = (json as { app?: unknown; format?: unknown } | null)?.app
    const format = (json as { format?: unknown } | null)?.format
    if (app === 'auri' && typeof format === 'number' && format > SETTINGS_FORMAT) {
      throw new Error('Estas configurações são de uma versão mais nova do Auri. Atualize o Auri.')
    }
    throw new Error('Este arquivo não é de configurações do Auri.')
  }
  return parsed.data
}

const THEME = { system: 'Sistema', light: 'Claro', dark: 'Escuro' } as const
const ROLE = { server: 'Guarda os dados', client: 'Usa os dados de outro computador' } as const
const KIND = {
  google: 'Google Drive',
  onedrive: 'OneDrive',
  icloud: 'iCloud Drive',
  folder: 'Outra pasta'
} as const
const FREQUENCY = {
  daily: 'Todo dia',
  change: 'A cada alteração',
  manual: 'Só quando pedir'
} as const
const yesNo = (on: boolean): string => (on ? 'Ligado' : 'Desligado')
const CLINIC = {
  nome: 'Nome da clínica',
  documento: 'CNPJ ou CPF da clínica',
  endereco: 'Endereço da clínica',
  telefone: 'Telefone da clínica',
  whatsapp: 'WhatsApp da clínica',
  profissional: 'Profissional responsável',
  registro: 'Registro do profissional'
} as const
const filled = (value: string): string => value || 'Vazio'

const sameTitle = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')

export function newTermModels(current: TermModelInput[], file: SettingsFile): TermModelInput[] {
  return file.termModels.filter(
    (model, index) =>
      !current.some((existing) => sameTitle(existing.titulo, model.titulo)) &&
      file.termModels.findIndex((other) => sameTitle(other.titulo, model.titulo)) === index
  )
}

function novos<T extends { nome: string }>(atuais: T[], doArquivo: T[]): T[] {
  return doArquivo.filter(
    (item, index) =>
      !atuais.some((atual) => mesmoNome(atual.nome, item.nome)) &&
      doArquivo.findIndex((outro) => mesmoNome(outro.nome, item.nome)) === index
  )
}

export function newTipos(current: TipoInput[], file: SettingsFile): TipoInput[] {
  return novos(current, file.tipos)
}

export function describeChanges(current: SettingsSnapshot, file: SettingsFile): SettingsChange[] {
  const changes: SettingsChange[] = []
  const add = <T>(label: string, from: T, to: T | undefined, show: (v: T) => string): void => {
    if (to === undefined || to === from) return
    changes.push({ label, from: show(from), to: show(to) })
  }
  const a = current.appearance
  add('Tema', a.theme, file.appearance.theme, (v) => THEME[v])
  add('Barra lateral', a.sidebarOpen, file.appearance.sidebarOpen, (v) =>
    v ? 'Aberta' : 'Recolhida'
  )
  add('Tamanho do texto', a.textSize, file.appearance.textSize, (v) => TEXT_SIZE_LABELS[v])
  const colors = file.appearance.colors
  if (colors && !sameColors(colors, a.colors)) {
    changes.push({ label: 'Cores', from: colorsLabel(a.colors), to: colorsLabel(colors) })
  }
  const c = current.connection
  add('Este computador', c.role, file.connection.role, (v) => ROLE[v])
  add('Nome deste computador', c.name, file.connection.name, (v) => v)
  add('Compartilhar com outros computadores', c.sharing, file.connection.sharing, yesNo)
  add('Continuar rodando ao fechar a janela', c.keepRunning, file.connection.keepRunning, yesNo)
  add('Abrir ao ligar o computador', c.openAtLogin, file.connection.openAtLogin, yesNo)
  add('Acesso de fora da clínica', c.remoteAccess, file.connection.remoteAccess, yesNo)
  add('Avisos da agenda', c.notices, file.connection.notices, yesNo)
  const b = current.backup
  add('Nuvem da cópia de segurança', b.kind, file.backup.kind, (v) => (v ? KIND[v] : 'Nenhuma'))
  add('Quando copiar', b.frequency, file.backup.frequency, (v) => FREQUENCY[v])
  add('Horário da cópia', b.dailyTime, file.backup.dailyTime, (v) => v)
  for (const field of Object.keys(CLINIC) as (keyof typeof CLINIC)[]) {
    add(CLINIC[field], current.clinic[field], file.clinic[field], filled)
  }
  add(
    'Horário de funcionamento',
    resumoFuncionamento(current.clinic.funcionamento),
    file.clinic.funcionamento && resumoFuncionamento(file.clinic.funcionamento),
    (v) => v
  )
  const logo = file.clinic.logo
  if (logo && logo !== current.clinic.logo) {
    changes.push({
      label: 'Logo da clínica',
      from: current.clinic.logo ? 'O atual' : 'Sem logo',
      to: 'O do arquivo'
    })
  }
  for (const model of newTermModels(current.termModels, file)) {
    changes.push({ label: `Modelo de termo “${model.titulo}”`, from: 'Não tem', to: 'Novo' })
  }
  for (const tipo of newTipos(current.tipos, file)) {
    const detalhe = [CATEGORIA_LABELS[tipo.categoria], tipo.duracao && `${tipo.duracao} min`]
    changes.push({
      label: `Etiqueta “${tipo.nome}”`,
      from: 'Não tem',
      to: `Nova (${detalhe.filter(Boolean).join(', ')})`
    })
  }
  return changes
}
