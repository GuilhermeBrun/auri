import type { AuriApi, AuriBackup, AuriConnection, AuriPrefs } from '../shared/api'

declare global {
  interface Window {
    api: AuriApi
    prefs: AuriPrefs
    connection: AuriConnection
    backup: AuriBackup
    platform: string
  }
}
