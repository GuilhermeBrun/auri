import { randomUUID } from 'crypto'
import { app, BrowserWindow, dialog } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { readFile, stat, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import type { AuriTransfer } from '../shared/api'
import type { BackupService } from './backup-service'
import type { Connection } from './connection'
import type { PrefsStore } from './prefs'
import {
  buildSettingsFile,
  describeChanges,
  parseSettingsFile,
  SETTINGS_EXTENSION,
  type SettingsFile,
  type SettingsSnapshot
} from './settings-transfer'

/** Arquivo de configurações maior que isso não é nosso (o de verdade tem ~1 KB). */
const MAX_SIZE = 256 * 1024

/**
 * Exportar e importar as configurações (Configurações / Importar e exportar), sem tocar nos
 * dados. Importar é em dois passos: ler (mostra o que muda) e aplicar (depois de confirmar).
 */
export function createTransferService(options: {
  prefs: PrefsStore
  connection: Connection
  backup: BackupService
}): AuriTransfer {
  /** Arquivos lidos e ainda não aplicados, pela ficha devolvida à tela. */
  const pending = new Map<string, SettingsFile>()

  function snapshot(): SettingsSnapshot {
    const c = options.connection.info()
    const b = options.backup.info()
    return {
      appearance: options.prefs.get(),
      connection: {
        role: c.role,
        name: c.name,
        sharing: c.sharing,
        keepRunning: c.keepRunning,
        openAtLogin: c.openAtLogin,
        remoteAccess: c.remoteAccess
      },
      backup: {
        kind: b.destination?.kind ?? b.suggested,
        frequency: b.frequency,
        dailyTime: b.dailyTime
      }
    }
  }

  const window = (): BrowserWindow | undefined => BrowserWindow.getFocusedWindow() ?? undefined

  return {
    async exportSettings() {
      // na pasta "Auri" da nuvem da cópia, se houver; senão em Documentos
      const preferred = options.backup.preferredFolder()
      if (preferred) mkdirSync(preferred, { recursive: true })
      const dialogOptions = {
        title: 'Exportar configurações',
        buttonLabel: 'Exportar',
        defaultPath: join(
          preferred ?? app.getPath('documents'),
          `Auri - configurações.${SETTINGS_EXTENSION}`
        ),
        filters: [{ name: 'Configurações do Auri', extensions: [SETTINGS_EXTENSION] }]
      }
      const target = window()
      const result = target
        ? await dialog.showSaveDialog(target, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, buildSettingsFile(snapshot()))
      return result.filePath
    },

    async pickSettings() {
      // onde a exportação salva; sem `defaultPath` o Electron abre sempre em Downloads
      const preferred = options.backup.preferredFolder()
      const dialogOptions = {
        title: 'Importar configurações',
        buttonLabel: 'Importar',
        defaultPath: preferred && existsSync(preferred) ? preferred : app.getPath('documents'),
        properties: ['openFile'] as Array<'openFile'>,
        filters: [{ name: 'Configurações do Auri', extensions: [SETTINGS_EXTENSION] }]
      }
      const target = window()
      const result = target
        ? await dialog.showOpenDialog(target, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      const file = result.canceled ? undefined : result.filePaths[0]
      if (!file) return null
      if ((await stat(file)).size > MAX_SIZE) {
        throw new Error('Este arquivo não é de configurações do Auri.')
      }
      const settings = parseSettingsFile(await readFile(file, 'utf8'))
      const token = randomUUID()
      pending.clear()
      pending.set(token, settings)
      return {
        token,
        name: basename(file),
        exportedAt: settings.exportedAt,
        changes: describeChanges(snapshot(), settings)
      }
    },

    async applySettings(token) {
      const settings = pending.get(token)
      if (!settings) throw new Error('Escolha o arquivo de novo.')
      pending.delete(token)
      const { appearance, connection: c, backup: b } = settings
      if (Object.keys(appearance).length > 0) options.prefs.save(appearance)
      // o papel primeiro: trocar de papel fecha e abre o banco ou a conexão
      if (c.role) await options.connection.setRole(c.role)
      if (c.name) await options.connection.setName(c.name)
      if (c.sharing !== undefined) await options.connection.setSharing(c.sharing)
      if (c.keepRunning !== undefined) await options.connection.setKeepRunning(c.keepRunning)
      if (c.openAtLogin !== undefined) await options.connection.setOpenAtLogin(c.openAtLogin)
      if (c.remoteAccess !== undefined) await options.connection.setRemoteAccess(c.remoteAccess)
      const current = options.backup.info()
      if (b.frequency || b.dailyTime) {
        await options.backup.setFrequency(
          b.frequency ?? current.frequency,
          b.dailyTime ?? current.dailyTime
        )
      }
      // a nuvem vira sugestão: a pasta e a senha são deste computador, escolhidas no assistente
      if (b.kind && !current.configured) options.backup.suggest(b.kind)
    }
  }
}
