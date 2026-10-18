import type {
  AuriApi,
  AuriBackup,
  AuriConnection,
  AuriPrefs,
  AuriTransfer,
  AuriUpdates
} from '../shared/api'

declare global {
  interface Window {
    api: AuriApi
    prefs: AuriPrefs
    connection: AuriConnection
    backup: AuriBackup
    transfer: AuriTransfer
    updates: AuriUpdates
    platform: string
  }
}
