import type { AuriApi, AuriConnection, AuriPrefs } from '../shared/api'

declare global {
  interface Window {
    api: AuriApi
    prefs: AuriPrefs
    connection: AuriConnection
    platform: string
  }
}
