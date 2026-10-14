import { readFileSync, writeFileSync } from 'fs'
import { DEFAULT_UI_PREFS } from '../shared/api'
import { uiPrefsSchema, type UiPrefs } from '../shared/schemas'

export type PrefsStore = { get(): UiPrefs; save(value: unknown): void }

/**
 * Preferências da interface num JSON ao lado do banco. Ficam no main, que as entrega prontas a cada
 * janela (`PREFS_ARG`): ler o localStorage na abertura travava a primeira tela por 15 a 35 ms,
 * esperando o disco. Arquivo ausente ou inválido vale como padrão; campos que faltam também.
 * `save` recebe só o que mudou e junta ao resto; `onChange` roda depois de cada gravação que mudou
 * algo (o main usa para aplicar o tema).
 */
export function createPrefsStore(file: string, onChange?: (prefs: UiPrefs) => void): PrefsStore {
  let prefs = DEFAULT_UI_PREFS
  try {
    prefs = {
      ...DEFAULT_UI_PREFS,
      ...uiPrefsSchema.partial().parse(JSON.parse(readFileSync(file, 'utf8')))
    }
  } catch {
    // primeira abertura ou arquivo corrompido: fica o padrão
  }
  return {
    get: () => prefs,
    save(value) {
      const next = { ...prefs, ...uiPrefsSchema.partial().parse(value) }
      if (JSON.stringify(next) === JSON.stringify(prefs)) return
      writeFileSync(file, JSON.stringify(next))
      prefs = next
      onChange?.(prefs)
    }
  }
}
