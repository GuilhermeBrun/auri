import { readFileSync } from 'fs'
import { DEFAULT_UI_PREFS } from '../shared/api'
import { uiPrefsSchema, type UiPrefs } from '../shared/schemas'
import { writeAtomicJson } from './atomic-file'

export type PrefsStore = { get(): UiPrefs; save(value: unknown): void }

export function createPrefsStore(file: string, onChange?: (prefs: UiPrefs) => void): PrefsStore {
  let prefs = DEFAULT_UI_PREFS
  try {
    prefs = {
      ...DEFAULT_UI_PREFS,
      ...uiPrefsSchema.partial().parse(JSON.parse(readFileSync(file, 'utf8')))
    }
  } catch {}
  return {
    get: () => prefs,
    save(value) {
      const next = { ...prefs, ...uiPrefsSchema.partial().parse(value) }
      if (JSON.stringify(next) === JSON.stringify(prefs)) return
      writeAtomicJson(file, next)
      prefs = next
      onChange?.(prefs)
    }
  }
}
