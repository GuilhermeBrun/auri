import type { AuriApi, AuriPrefs } from '../shared/api'

declare global {
  interface Window {
    api: AuriApi
    prefs: AuriPrefs
    platform: string
  }
}
