import { app, shell, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PREFS_ARG } from '../shared/api'
import type { UiPrefs } from '../shared/schemas'
import { openDatabase, type Db } from './db/connection'
import { registerIpc } from './ipc'
import { createPrefsStore } from './prefs'

let db: Db | null = null

function createWindow(prefs: UiPrefs): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    title: 'Auri',
    show: false,
    autoHideMenuBar: true,
    // Fundo branco: o conteúdo é branco até a borda e a barra lateral de grafite é desenhada pela interface.
    backgroundColor: '#ffffff',
    // Mac: barra de título integrada (os botões da janela ficam sobre a barra lateral de grafite).
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.auri.app')

  // Em desenvolvimento o executável ainda é o Electron; a marca também aparece no Dock.
  if (process.platform === 'darwin') app.dock?.setIcon(icon)

  // O Auri só tem tema claro. Sem isto, no Modo Escuro os controles nativos (barras de rolagem,
  // seletor de data) ficariam escuros dentro de uma interface clara.
  nativeTheme.themeSource = 'light'

  // F12 abre o DevTools em desenvolvimento; Ctrl/Cmd+R fica desativado em produção.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const dbFile = join(app.getPath('userData'), 'auri.db')
  db = openDatabase(dbFile)
  console.log(`[db] ${dbFile}`)
  const prefs = createPrefsStore(join(app.getPath('userData'), 'preferencias.json'))
  registerIpc(db, prefs)

  createWindow(prefs.get())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(prefs.get())
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  db?.close()
  db = null
})
