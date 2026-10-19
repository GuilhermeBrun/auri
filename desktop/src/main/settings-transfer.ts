import { z } from 'zod'
import type { SettingsChange } from '../shared/api'
import { themeSchema, type UiPrefs } from '../shared/schemas'

/**
 * Arquivo de configurações (`.auriconfig`), separado da cópia dos dados: JSON legível, sem senha,
 * sem dado de paciente e sem segredo (nada de chaves, computadores pareados ou senha da cópia).
 * Ver docs/specs/2026-10-13-copia-de-seguranca-design.md.
 */
export const SETTINGS_EXTENSION = 'auriconfig'

const kindSchema = z.enum(['google', 'onedrive', 'icloud', 'folder'])

const settingsFileSchema = z.object({
  app: z.literal('auri'),
  kind: z.literal('configuracoes'),
  format: z.literal(1),
  exportedAt: z.string(),
  appearance: z.object({ theme: themeSchema, sidebarOpen: z.boolean() }).partial().default({}),
  connection: z
    .object({
      role: z.enum(['server', 'client']),
      name: z.string().trim().min(1).max(60),
      sharing: z.boolean(),
      keepRunning: z.boolean(),
      openAtLogin: z.boolean(),
      remoteAccess: z.boolean()
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
    .default({})
})

export type SettingsFile = z.infer<typeof settingsFileSchema>

/** As configurações deste computador, no formato do arquivo (todos os campos presentes). */
export type SettingsSnapshot = {
  appearance: UiPrefs
  connection: Required<SettingsFile['connection']>
  backup: { kind: z.infer<typeof kindSchema> | null } & Required<
    Omit<SettingsFile['backup'], 'kind'>
  >
}

export function buildSettingsFile(snapshot: SettingsSnapshot, now: Date = new Date()): string {
  const file: SettingsFile = {
    app: 'auri',
    kind: 'configuracoes',
    format: 1,
    exportedAt: now.toISOString(),
    appearance: snapshot.appearance,
    connection: snapshot.connection,
    backup: {
      frequency: snapshot.backup.frequency,
      dailyTime: snapshot.backup.dailyTime,
      ...(snapshot.backup.kind ? { kind: snapshot.backup.kind } : {})
    }
  }
  return JSON.stringify(file, null, 2)
}

/** Lê o arquivo; qualquer coisa que não seja configuração do Auri vira mensagem clara. */
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
    if (app === 'auri' && typeof format === 'number' && format > 1) {
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

/** O que muda se o arquivo for aplicado, em palavras, para confirmar antes. */
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
  const c = current.connection
  add('Este computador', c.role, file.connection.role, (v) => ROLE[v])
  add('Nome deste computador', c.name, file.connection.name, (v) => v)
  add('Compartilhar com outros computadores', c.sharing, file.connection.sharing, yesNo)
  add('Continuar rodando ao fechar a janela', c.keepRunning, file.connection.keepRunning, yesNo)
  add('Abrir ao ligar o computador', c.openAtLogin, file.connection.openAtLogin, yesNo)
  add('Acesso de fora da clínica', c.remoteAccess, file.connection.remoteAccess, yesNo)
  const b = current.backup
  add('Nuvem da cópia de segurança', b.kind, file.backup.kind, (v) => (v ? KIND[v] : 'Nenhuma'))
  add('Quando copiar', b.frequency, file.backup.frequency, (v) => FREQUENCY[v])
  add('Horário da cópia', b.dailyTime, file.backup.dailyTime, (v) => v)
  return changes
}
