import { app, shell, BrowserWindow, dialog, Menu, nativeImage, nativeTheme, Tray } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import trayIcon from '../../resources/trayTemplate.png?asset'
import { PREFS_ARG } from '../shared/api'
import type { Theme, UiPrefs } from '../shared/schemas'
import { createConnection, type Connection } from './connection'
import { registerIpc } from './ipc'
import { createPrefsStore, type PrefsStore } from './prefs'

let connection: Connection | null = null
let prefs: PrefsStore | null = null
let tray: Tray | null = null
/** O usuário já confirmou sair mesmo com outro computador conectado. */
let quitConfirmed = false

/**
 * Fundo da janela antes da interface desenhar (abrir, redimensionar): o mesmo `--color-surface` do
 * tema em uso, para não piscar branco no escuro nem preto no claro.
 */
function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#17171c' : '#ffffff'
}

/**
 * O tema vale para o app todo: o `themeSource` decide o `prefers-color-scheme` que o CSS lê (ver
 * main.css) e os controles nativos. Em "system" ele acompanha o sistema, inclusive quando o sistema
 * troca sozinho ao anoitecer.
 */
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
    // O conteúdo vai até a borda; a barra lateral é desenhada pela interface.
    backgroundColor: windowBackground(),
    // Mac: barra de título integrada (os botões da janela ficam sobre a barra lateral).
    // O y centraliza os botões (14px) na altura do cabeçalho da página (48px).
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 22, y: 17 } }
      : {}),
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // preferências da interface prontas para o preload, sem a janela esperar o disco
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
    if (details.url.startsWith('https://')) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR do renderer em desenvolvimento; arquivo local em produção.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Manda um aviso do main para todas as janelas abertas. */
function sendToWindows(channel: string, value: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, value)
}

/** Mostra a janela que já existe ou abre uma nova (bandeja, segunda abertura do app). */
function showWindow(): void {
  const [window] = BrowserWindow.getAllWindows()
  if (!window) return createWindow(prefs!.get())
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

/**
 * Ícone na bandeja (Windows) ou na barra de menus (Mac) enquanto este computador compartilha os
 * dados e continua rodando ao fechar a janela: é por ele que se abre de novo ou se sai de vez.
 */
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
  // Windows: clique no ícone abre a janela (no Mac o clique abre o menu)
  tray.on('click', () => {
    if (process.platform !== 'darwin') showWindow()
  })
}

// Uma instância só: duas abririam o mesmo banco e disputariam a porta da rede. Abrir de novo
// (atalho, ou o app já rodando na bandeja) só mostra a janela.
const isFirstInstance = app.requestSingleInstanceLock()
if (!isFirstInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (app.isReady()) showWindow()
  })
}

app.whenReady().then(async () => {
  // a segunda instância só existe para acordar a primeira (`second-instance`) e sair
  if (!isFirstInstance) return

  electronApp.setAppUserModelId('com.auri.app')

  // Em desenvolvimento o executável ainda é o Electron; a marca também aparece no Dock.
  if (process.platform === 'darwin') app.dock?.setIcon(icon)

  // F12 abre o DevTools em desenvolvimento; Ctrl/Cmd+R fica desativado em produção.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  connection = createConnection({
    userData: app.getPath('userData'),
    onDataChanged: (topics) => sendToWindows('data:changed', topics),
    onInfoChanged: (info) => {
      sendToWindows('connection:changed', info)
      syncTray()
    }
  })
  await connection.start()
  syncTray()
  prefs = createPrefsStore(join(app.getPath('userData'), 'preferencias.json'), (next) =>
    applyTheme(next.theme)
  )
  registerIpc(connection, prefs)
  applyTheme(prefs.get().theme)
  // o sistema trocou de tema (com "system" escolhido)
  nativeTheme.on('updated', syncWindowBackgrounds)

  createWindow(prefs.get())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(prefs!.get())
  })
})

app.on('window-all-closed', () => {
  // compartilhando: continua rodando na bandeja para o outro computador não perder o acesso
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
  connection?.close()
  connection = null
})
