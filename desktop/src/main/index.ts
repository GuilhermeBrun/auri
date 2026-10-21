import {
  app,
  autoUpdater,
  shell,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  nativeTheme,
  net,
  Notification,
  powerMonitor,
  screen,
  Tray
} from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import trayIcon from '../../resources/trayTemplate.png?asset'
import { noticeText, type AgendaNotice } from '../shared/agenda-notice'
import {
  DEFAULT_COLORS,
  largestTextSize,
  MIN_WINDOW,
  surfaceColor,
  TEXT_SIZES,
  type TextSize
} from '../shared/aparencia'
import { PREFS_ARG } from '../shared/api'
import type { UiPrefs } from '../shared/schemas'
import { createBackupService, type BackupService } from './backup-service'
import { detectProviders, systemProbe } from './backup/providers'
import { QUIT_BACKUP_MS } from './backup/scheduler'
import { createConnection, type Connection } from './connection'
import { DatabaseTooNewError } from './db/migrations'
import { createErrorReports, type ErrorReportService } from './error-reports'
import { registerIpc } from './ipc'
import { macMenu } from './menu'
import { createLinksCurtos } from './links-curtos'
import { trustRenderer } from './ipc-security'
import { pathToFileURL } from 'node:url'
import { createPrefsStore, type PrefsStore } from './prefs'
import { createReceptionLock } from './reception-lock'
import { createTransferService } from './transfer-service'
import { createWhatsAppView, type WhatsAppView } from './whatsapp-view'
import { tamanhoDaJanela } from './window-size'
import { ESQUEMA, criarCaixa, enderecoNosArgumentos } from './terms/protocol'
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
let whatsapp: WhatsAppView | null = null
let quitConfirmed = false
let quitBackupDone = false
let skipQuitBackup = false

function windowBackground(): string {
  const colors = prefs?.get().colors ?? DEFAULT_COLORS
  return surfaceColor(colors, nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
}

function applyAppearance(next: UiPrefs): void {
  nativeTheme.themeSource = next.theme
  syncWindowBackgrounds()
  for (const window of BrowserWindow.getAllWindows()) applyTextSize(window, next.textSize)
}

function appWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows()
}

function syncWindowBackgrounds(): void {
  for (const window of BrowserWindow.getAllWindows()) window.setBackgroundColor(windowBackground())
}

function applyTextSize(window: BrowserWindow, wanted: TextSize): void {
  const area = screen.getDisplayMatching(window.getBounds()).workArea
  const largest = largestTextSize(area)
  const size = Math.min(wanted, largest)
  const min = {
    width: Math.min(Math.round(MIN_WINDOW.width * size), Math.floor(area.width)),
    height: Math.min(Math.round(MIN_WINDOW.height * size), Math.floor(area.height))
  }
  window.setMinimumSize(min.width, min.height)
  const bounds = window.getBounds()
  if (!window.isFullScreen() && (bounds.width < min.width || bounds.height < min.height)) {
    const width = Math.max(bounds.width, min.width)
    const height = Math.max(bounds.height, min.height)
    window.setBounds({
      width,
      height,
      x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))
    })
  }
  if (window.webContents.getZoomFactor() !== size) window.webContents.setZoomFactor(size)
  if (process.platform === 'darwin') {
    window.setWindowButtonPosition({ x: 22, y: Math.round(24 * size - 7) })
  }
  window.webContents.send('prefs:fit', largest)
}

function refitWindows(): void {
  const size = prefs?.get().textSize
  if (size) for (const window of BrowserWindow.getAllWindows()) applyTextSize(window, size)
}

function stepTextSize(window: BrowserWindow, input: Electron.Input): TextSize | null {
  if (
    input.type !== 'keyDown' ||
    input.alt ||
    !(process.platform === 'darwin' ? input.meta : input.control)
  ) {
    return null
  }
  const largest = largestTextSize(screen.getDisplayMatching(window.getBounds()).workArea)
  const sizes = TEXT_SIZES.filter((size) => size <= largest)
  const index = sizes.indexOf(Math.min(prefs?.get().textSize ?? 1, largest) as TextSize)
  if (input.key === '=' || input.key === '+') return sizes[Math.min(index + 1, sizes.length - 1)]
  if (input.key === '-' || input.key === '_') return sizes[Math.max(index - 1, 0)]
  if (input.key === '0') return sizes[0]
  return null
}

function createWindow(initial: UiPrefs): void {
  const mainWindow = new BrowserWindow({
    ...tamanhoDaJanela(screen.getPrimaryDisplay().workAreaSize),
    title: 'Auri',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: windowBackground(),
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 22, y: Math.round(24 * initial.textSize - 7) }
        }
      : {}),
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      zoomFactor: initial.textSize,
      additionalArguments: [`${PREFS_ARG}${JSON.stringify(initial)}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  applyTextSize(mainWindow, initial.textSize)
  mainWindow.webContents.on('did-finish-load', () => {
    applyTextSize(mainWindow, prefs?.get().textSize ?? initial.textSize)
  })
  mainWindow.on('moved', refitWindows)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const size = stepTextSize(mainWindow, input)
    if (size === null) return
    event.preventDefault()
    prefs?.save({ textSize: size })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devUrl = (is.dev && process.env['ELECTRON_RENDERER_URL']) || null
  const file = join(__dirname, '../renderer/index.html')
  const url = devUrl ?? pathToFileURL(file).href
  trustRenderer(mainWindow.webContents, url)
  whatsapp?.attach(mainWindow)
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (target !== url) event.preventDefault()
  })
  void (devUrl ? mainWindow.loadURL(devUrl) : mainWindow.loadFile(file))
}

function sendToWindows(channel: string, value: unknown): void {
  for (const window of appWindows()) window.webContents.send(channel, value)
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

function appVersion(): string {
  return app.isPackaged || !__AURI_LOCAL_VERSION__ ? app.getVersion() : __AURI_LOCAL_VERSION__
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
      version: appVersion(),
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
  const [window] = appWindows()
  if (!window) return createWindow(prefs!.get())
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function openSettings(): void {
  const existed = BrowserWindow.getAllWindows().length > 0
  showWindow()
  const [window] = BrowserWindow.getAllWindows()
  if (!window) return
  const send = (): void => window.webContents.send('settings:open', undefined)
  if (existed && !window.webContents.isLoading()) send()
  else window.webContents.once('did-finish-load', send)
}

function openAgendaAt(inicio: string): void {
  const existed = BrowserWindow.getAllWindows().length > 0
  showWindow()
  const [window] = BrowserWindow.getAllWindows()
  if (!window) return
  const send = (): void => window.webContents.send('agenda:open', inicio)
  if (existed && !window.webContents.isLoading()) send()
  else window.webContents.once('did-finish-load', send)
}

const shownNotices = new Set<Notification>()

function showNotice(notice: AgendaNotice): void {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused) return focused.webContents.send('agenda:notice', notice)
  if (!Notification.isSupported()) return
  const shown = new Notification({ ...noticeText(notice), silent: false })
  shownNotices.add(shown)
  const forget = (): boolean => shownNotices.delete(shown)
  shown.on('click', () => {
    forget()
    openAgendaAt(notice.inicio)
  })
  shown.on('close', forget)
  shown.on('failed', forget)
  shown.show()
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

const PRAZOS_MS = 60_000

function verificarPrazos(): void {
  if (!connection?.database()) return
  void connection.call('confirmacoes:prazos', [connection.info().name || 'Este computador'])
}

const inbox = criarCaixa((tipo) => {
  sendToWindows(tipo === 'termo' ? 'terms:incoming' : 'confirmacoes:incoming', null)
  if (app.isReady()) showWindow()
})

const isFirstInstance = app.requestSingleInstanceLock()
if (!isFirstInstance) {
  app.quit()
} else {
  app.on('will-finish-launching', () => {
    app.on('open-url', (event, url) => {
      event.preventDefault()
      inbox.receber(url)
    })
  })
  app.on('second-instance', (_event, argv) => {
    const endereco = enderecoNosArgumentos(argv)
    if (endereco) inbox.receber(endereco)
    if (app.isReady()) showWindow()
  })
  const inicial = enderecoNosArgumentos(process.argv)
  if (inicial) inbox.receber(inicial)
  reports = startErrorReports()
  watchFailures()
}

void app.whenReady().then(async () => {
  if (!isFirstInstance) return

  electronApp.setAppUserModelId('com.auri.app')
  if (app.isPackaged && process.platform === 'win32') app.setAsDefaultProtocolClient(ESQUEMA)

  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
    Menu.setApplicationMenu(Menu.buildFromTemplate(macMenu(app.name, openSettings)))
  }

  const skipBackup = (): void => {
    skipQuitBackup = true
  }
  powerMonitor.on('shutdown', skipBackup)
  autoUpdater.on('before-quit-for-update', skipBackup)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  connection = createConnection({
    userData: app.getPath('userData'),
    onDataChanged: (topics) => sendToWindows('data:changed', topics),
    onNotice: showNotice,
    onInfoChanged: (info) => {
      sendToWindows('connection:changed', info)
      syncTray()
      backup?.refresh()
    },
    onWrite: () => backup?.dataWritten(),
    onFailure: (error) => reports?.captureUnexpected(error)
  })
  try {
    await connection.start()
  } catch (error) {
    if (!(error instanceof DatabaseTooNewError)) throw error
    reports?.capture('main', error)
    dialog.showMessageBoxSync({
      type: 'error',
      buttons: ['Sair'],
      message: 'Os dados vieram de uma versão mais nova do Auri.',
      detail:
        'Instale a versão mais nova do Auri para abrir os pacientes e a agenda. Nada foi apagado.'
    })
    quitConfirmed = true
    app.quit()
    return
  }
  backup = createBackupService({
    userData: app.getPath('userData'),
    connection,
    onInfoChanged: (info) => sendToWindows('backup:changed', info),
    providers: () => detectProviders(systemProbe()),
    onInstallProgress: (progress) => sendToWindows('backup:installProgress', progress)
  })
  syncTray()
  prefs = createPrefsStore(join(app.getPath('userData'), 'preferencias.json'), (next) => {
    applyAppearance(next)
    void whatsapp?.setEnabled(next.whatsapp)
    sendToWindows('prefs:changed', next)
  })
  const channel = channelFile(join(app.getPath('userData'), 'atualizacoes.json'))
  updates = createUpdateService({
    version: appVersion(),
    updater: await loadUpdater(),
    channel: channel.read(),
    onChange: (state) => sendToWindows('updates:changed', state),
    onChannelChange: (next) => channel.save(next)
  })
  whatsapp = createWhatsAppView({
    enabled: prefs.get().whatsapp,
    onUnread: (count) => sendToWindows('whatsapp:unread', count),
    onOpen: () => sendToWindows('whatsapp:open', undefined)
  })
  registerIpc({
    connection,
    prefs,
    backup,
    transfer: createTransferService({ prefs, connection, backup }),
    updates,
    reports: reports!,
    inbox,
    whatsapp,
    receptionLock: createReceptionLock(prefs, backup),
    links: createLinksCurtos({
      buscar: (endereco, opcoes) => net.fetch(endereco, opcoes),
      origem: process.env.AURI_SITE_URL || undefined
    })
  })
  applyAppearance(prefs.get())
  nativeTheme.on('updated', syncWindowBackgrounds)
  screen.on('display-metrics-changed', refitWindows)
  screen.on('display-removed', refitWindows)

  createWindow(prefs.get())
  verificarPrazos()
  setInterval(verificarPrazos, PRAZOS_MS)

  app.on('activate', function () {
    if (appWindows().length === 0) createWindow(prefs!.get())
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !connection?.keepsRunning()) {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  const online = connection?.onlineDevices() ?? []
  if (!quitConfirmed && online.length > 0) {
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
    return
  }
  if (quitBackupDone || skipQuitBackup || !backup?.pendingOnQuit()) return
  event.preventDefault()
  quitBackupDone = true
  void backup.backupBeforeQuit(QUIT_BACKUP_MS).finally(() => app.quit())
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
