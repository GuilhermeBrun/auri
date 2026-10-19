import { app, shell, BrowserWindow, dialog, Menu, nativeImage, nativeTheme, Tray } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import trayIcon from '../../resources/trayTemplate.png?asset'
import { PREFS_ARG } from '../shared/api'
import type { Theme, UiPrefs } from '../shared/schemas'
import { createBackupService, type BackupService } from './backup-service'
import { detectProviders, systemProbe } from './backup/providers'
import { createConnection, type Connection } from './connection'
import { createErrorReports, type ErrorReportService } from './error-reports'
import { registerIpc } from './ipc'
import { trustRenderer } from './ipc-security'
import { pathToFileURL } from 'node:url'
import { createPrefsStore, type PrefsStore } from './prefs'
import { createTransferService } from './transfer-service'
import {
  channelFile,
  createUpdateService,
  hasTeamIdentifier,
  type UpdateService,
  type Updater
} from './updates'
import { existsSync } from 'node:fs'
import { release } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

let connection: Connection | null = null
let backup: BackupService | null = null
let prefs: PrefsStore | null = null
let tray: Tray | null = null
let updates: UpdateService | null = null
let reports: ErrorReportService | null = null
let quitConfirmed = false

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#17171c' : '#ffffff'
}

function applyTheme(theme: Theme): void {
  nativeTheme.themeSource = theme
  syncWindowBackgrounds()
}

function syncWindowBackgrounds(): void {
  for (const window of BrowserWindow.getAllWindows()) window.setBackgroundColor(windowBackground())
}

function createWindow(prefs: UiPrefs): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    title: 'Auri',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: windowBackground(),
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 22, y: 17 } }
      : {}),
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      additionalArguments: [`${PREFS_ARG}${JSON.stringify(prefs)}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devUrl = (is.dev && process.env['ELECTRON_RENDERER_URL']) || null
  const file = join(__dirname, '../renderer/index.html')
  const url = devUrl ?? pathToFileURL(file).href
  trustRenderer(mainWindow.webContents, url)
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (target !== url) event.preventDefault()
  })
  void (devUrl ? mainWindow.loadURL(devUrl) : mainWindow.loadFile(file))
}

function sendToWindows(channel: string, value: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, value)
}

async function signedByDeveloper(): Promise<boolean> {
  const bundle = resolve(process.execPath, '../../..')
  try {
    const { stderr } = await promisify(execFile)('codesign', ['-dv', bundle])
    return hasTeamIdentifier(stderr)
  } catch {
    return false
  }
}

async function loadUpdater(): Promise<Updater | null> {
  if (!app.isPackaged || !['win32', 'darwin'].includes(process.platform)) return null
  if (!existsSync(join(process.resourcesPath, 'app-update.yml'))) return null
  if (process.platform === 'darwin' && !(await signedByDeveloper())) return null
  const { autoUpdater } = await import('electron-updater')
  return autoUpdater as unknown as Updater
}

function reportsEndpoint(): string | null {
  const custom = process.env['AURI_ERROS_URL']
  if (custom !== undefined) return custom || null
  return app.isPackaged ? 'https://erros.auri.dev.br/api/erros' : null
}

function startErrorReports(): ErrorReportService {
  return createErrorReports({
    file: join(app.getPath('userData'), 'relatorios-de-erro.json'),
    endpoint: reportsEndpoint(),
    home: app.getPath('home'),
    context: () => ({
      version: app.getVersion(),
      channel: updates?.info().channel ?? 'latest',
      platform: process.platform,
      arch: process.arch,
      osVersion: release(),
      electron: process.versions.electron
    })
  })
}

function watchFailures(): void {
  process.on('uncaughtExceptionMonitor', (error) => reports?.capture('main', error))
  process.on('unhandledRejection', (reason) => {
    console.error('[main] promessa rejeitada sem tratamento', reason)
    reports?.capture('main', reason)
  })
  app.on('render-process-gone', (_event, _contents, details) => {
    if (details.reason === 'clean-exit') return
    reports?.record('process', {
      name: 'render-process-gone',
      message: `${details.reason} (${details.exitCode})`,
      stack: null
    })
  })
  app.on('child-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return
    reports?.record('process', {
      name: `child-process-gone: ${details.type}`,
      message: `${details.reason} (${details.exitCode})`,
      stack: null
    })
  })
}

function showWindow(): void {
  const [window] = BrowserWindow.getAllWindows()
  if (!window) return createWindow(prefs!.get())
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function syncTray(): void {
  const wanted = connection?.keepsRunning() ?? false
  if (!wanted) {
    tray?.destroy()
    tray = null
    return
  }
  if (tray) return
  const image =
    process.platform === 'darwin'
      ? nativeImage.createFromPath(trayIcon)
      : nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  if (process.platform === 'darwin') image.setTemplateImage(true)
  tray = new Tray(image)
  tray.setToolTip('Auri: compartilhando os dados nesta rede')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir o Auri', click: showWindow },
      { type: 'separator' },
      { label: 'Sair do Auri', click: () => app.quit() }
    ])
  )
  tray.on('click', () => {
    if (process.platform !== 'darwin') showWindow()
  })
}

const isFirstInstance = app.requestSingleInstanceLock()
if (!isFirstInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (app.isReady()) showWindow()
  })
  reports = startErrorReports()
  watchFailures()
}

void app.whenReady().then(async () => {
  if (!isFirstInstance) return

  electronApp.setAppUserModelId('com.auri.app')

  if (process.platform === 'darwin') app.dock?.setIcon(icon)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  connection = createConnection({
    userData: app.getPath('userData'),
    onDataChanged: (topics) => sendToWindows('data:changed', topics),
    onInfoChanged: (info) => {
      sendToWindows('connection:changed', info)
      syncTray()
      backup?.refresh()
    },
    onWrite: () => backup?.dataWritten(),
    onFailure: (error) => reports?.captureUnexpected(error)
  })
  await connection.start()
  backup = createBackupService({
    userData: app.getPath('userData'),
    connection,
    onInfoChanged: (info) => sendToWindows('backup:changed', info),
    providers: () => detectProviders(systemProbe()),
    onInstallProgress: (progress) => sendToWindows('backup:installProgress', progress)
  })
  syncTray()
  prefs = createPrefsStore(join(app.getPath('userData'), 'preferencias.json'), (next) => {
    applyTheme(next.theme)
    sendToWindows('prefs:changed', next)
  })
  const channel = channelFile(join(app.getPath('userData'), 'atualizacoes.json'))
  updates = createUpdateService({
    version: app.getVersion(),
    updater: await loadUpdater(),
    channel: channel.read(),
    onChange: (state) => sendToWindows('updates:changed', state),
    onChannelChange: (next) => channel.save(next)
  })
  registerIpc({
    connection,
    prefs,
    backup,
    transfer: createTransferService({ prefs, connection, backup }),
    updates,
    reports: reports!
  })
  applyTheme(prefs.get().theme)
  nativeTheme.on('updated', syncWindowBackgrounds)

  createWindow(prefs.get())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(prefs!.get())
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !connection?.keepsRunning()) {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  const online = connection?.onlineDevices() ?? []
  if (quitConfirmed || online.length === 0) return
  event.preventDefault()
  const names = online.join(' e ')
  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Sair mesmo assim', 'Cancelar'],
    defaultId: 1,
    cancelId: 1,
    message: `${names} ${online.length === 1 ? 'está conectado' : 'estão conectados'} e vai perder o acesso aos dados.`,
    detail:
      'Enquanto o Auri estiver fechado aqui, os outros computadores não conseguem ver nem salvar nada.'
  })
  if (choice === 0) {
    quitConfirmed = true
    app.quit()
  }
})

app.on('will-quit', () => {
  reports?.close()
  reports = null
  updates?.close()
  updates = null
  backup?.close()
  backup = null
  connection?.close()
  connection = null
})
