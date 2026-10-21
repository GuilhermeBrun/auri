import type {
  AuriApi,
  AuriBackup,
  AuriConnection,
  AuriPrefs,
  AuriReports,
  AuriTransfer,
  AuriUpdates,
  AuriWhatsApp
} from '../shared/api'

declare global {
  interface Window {
    api: AuriApi
    prefs: AuriPrefs
    connection: AuriConnection
    backup: AuriBackup
    transfer: AuriTransfer
    updates: AuriUpdates
    reports: AuriReports
    whatsapp: AuriWhatsApp
    platform: string
  }
}
