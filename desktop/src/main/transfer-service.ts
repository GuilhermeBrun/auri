import { randomUUID } from 'crypto'
import { app, BrowserWindow, dialog } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { readFile, stat, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import type { AuriTransfer } from '../shared/api'
import type { Clinic, TermModel } from '../shared/schemas'
import type { TipoAtendimento } from '../shared/tipos'
import type { BackupService } from './backup-service'
import type { Connection } from './connection'
import type { PrefsStore } from './prefs'
import {
  buildSettingsFile,
  describeChanges,
  parseSettingsFile,
  SETTINGS_EXTENSION,
  newTermModels,
  newTipos,
  type SettingsFile,
  type SettingsSnapshot
} from './settings-transfer'

const MAX_SIZE = 2 * 1024 * 1024

const UNREACHABLE = 'Não foi possível ler os dados da clínica. Confira a conexão e tente de novo.'

export function createTransferService(options: {
  prefs: PrefsStore
  connection: Connection
  backup: BackupService
}): AuriTransfer {
  const pending = new Map<string, SettingsFile>()

  async function call<T>(channel: string, args: unknown[] = []): Promise<T> {
    const result = await options.connection.call(channel, args)
    if (!result.ok) throw new Error(result.error)
    return result.data as T
  }

  async function clinicData(): Promise<{
    clinic: Clinic
    termModels: TermModel[]
    tipos: TipoAtendimento[]
  }> {
    try {
      const clinic = await call<Clinic>('clinic:get')
      const models = await call<TermModel[]>('terms:models')
      const tipos = await call<TipoAtendimento[]>('tipos:list')
      return {
        clinic,
        termModels: models.filter((model) => !model.arquivado),
        tipos: tipos.filter((tipo) => !tipo.arquivado)
      }
    } catch {
      throw new Error(UNREACHABLE)
    }
  }

  async function snapshot(): Promise<SettingsSnapshot> {
    const c = options.connection.info()
    const b = options.backup.info()
    const { clinic, termModels, tipos } = await clinicData()
    const { updated_at: _, ...clinicFields } = clinic
    return {
      appearance: {
        theme: options.prefs.get().theme,
        sidebarOpen: options.prefs.get().sidebarOpen
      },
      connection: {
        role: c.role,
        name: c.name,
        sharing: c.sharing,
        keepRunning: c.keepRunning,
        openAtLogin: c.openAtLogin,
        remoteAccess: c.remoteAccess,
        notices: c.notices
      },
      backup: {
        kind: b.destination?.kind ?? b.suggested,
        frequency: b.frequency,
        dailyTime: b.dailyTime
      },
      clinic: clinicFields,
      termModels,
      tipos
    }
  }

  const window = (): BrowserWindow | undefined => BrowserWindow.getFocusedWindow() ?? undefined

  return {
    async exportSettings() {
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
      await writeFile(result.filePath, buildSettingsFile(await snapshot()))
      return result.filePath
    },

    async pickSettings() {
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
        changes: describeChanges(await snapshot(), settings)
      }
    },

    async applySettings(token) {
      const settings = pending.get(token)
      if (!settings) throw new Error('Escolha o arquivo de novo.')
      pending.delete(token)
      const { appearance, connection: c, backup: b } = settings
      if (Object.keys(appearance).length > 0) options.prefs.save(appearance)
      if (c.role) await options.connection.setRole(c.role)
      if (c.name) await options.connection.setName(c.name)
      if (c.sharing !== undefined) await options.connection.setSharing(c.sharing)
      if (c.keepRunning !== undefined) await options.connection.setKeepRunning(c.keepRunning)
      if (c.openAtLogin !== undefined) await options.connection.setOpenAtLogin(c.openAtLogin)
      if (c.remoteAccess !== undefined) await options.connection.setRemoteAccess(c.remoteAccess)
      if (c.notices !== undefined) await options.connection.setNotices(c.notices)
      const current = options.backup.info()
      if (b.frequency || b.dailyTime) {
        await options.backup.setFrequency(
          b.frequency ?? current.frequency,
          b.dailyTime ?? current.dailyTime
        )
      }
      if (b.kind && !current.configured) options.backup.suggest(b.kind)
      const { clinic, termModels, tipos } = await clinicData()
      if (Object.keys(settings.clinic).length > 0) {
        const { updated_at: expected, ...fields } = clinic
        await call('clinic:save', [{ ...fields, ...settings.clinic }, expected])
      }
      for (const model of newTermModels(termModels, settings)) {
        await call('terms:saveModel', [null, model])
      }
      for (const tipo of newTipos(tipos, settings)) await call('tipos:save', [null, tipo])
    }
  }
}
