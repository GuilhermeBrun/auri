import { readFileSync, writeFileSync } from 'fs'
import { uiPrefsSchema, type UiPrefs } from '../shared/schemas'

const DEFAULT_PREFS: UiPrefs = { sidebarOpen: true }

export type PrefsStore = { get(): UiPrefs; save(value: unknown): void }

/**
 * Preferências da interface num JSON ao lado do banco. Ficam no main, que as entrega prontas a cada
 * janela (`PREFS_ARG`): ler o localStorage na abertura travava a primeira tela por 15 a 35 ms,
 * esperando o disco. Arquivo ausente ou inválido vale como padrão; campos que faltam também.
 */
export function createPrefsStore(file: string): PrefsStore {
  let prefs = DEFAULT_PREFS
  try {
    prefs = {
      ...DEFAULT_PREFS,
      ...uiPrefsSchema.partial().parse(JSON.parse(readFileSync(file, 'utf8')))
    }
  } catch {
    // primeira abertura ou arquivo corrompido: fica o padrão
  }
  return {
    get: () => prefs,
    save(value) {
      const next = uiPrefsSchema.parse(value)
      if (JSON.stringify(next) === JSON.stringify(prefs)) return
      prefs = next
      writeFileSync(file, JSON.stringify(prefs))
    }
  }
}
