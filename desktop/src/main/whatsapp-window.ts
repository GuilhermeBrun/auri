import { readFileSync } from 'node:fs'
import { app, BrowserWindow, screen, session, shell, type Rectangle, type Session } from 'electron'
import { z } from 'zod'
import { writeAtomicJson } from './atomic-file'

const HOST = 'web.whatsapp.com'
const PARTITION = 'persist:whatsapp'
const ALLOWED_PERMISSIONS = new Set(['notifications', 'clipboard-sanitized-write'])
const DEFAULT_SIZE = { width: 1000, height: 760 }

const boundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(400),
  height: z.number().int().min(300)
})

export type WhatsAppWindow = {
  open(phone: string, text: string): void
  owns(window: BrowserWindow): boolean
  close(): void
}

export function whatsAppUrl(phone: string, text: string): string {
  return `https://${HOST}/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`
}

export function isWhatsAppPage(target: string): boolean {
  try {
    const url = new URL(target)
    return url.protocol === 'https:' && url.host === HOST
  } catch {
    return false
  }
}

export function chromeUserAgent(platform: NodeJS.Platform, chrome: string): string {
  const major = chrome.split('.')[0]
  const system =
    platform === 'darwin'
      ? 'Macintosh; Intel Mac OS X 10_15_7'
      : platform === 'win32'
        ? 'Windows NT 10.0; Win64; x64'
        : 'X11; Linux x86_64'
  return `Mozilla/5.0 (${system}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
}

function openOutside(target: string): void {
  try {
    const url = new URL(target)
    if (url.protocol === 'https:' || url.protocol === 'mailto:') void shell.openExternal(url.href)
  } catch {
    return
  }
}

function overlaps(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function savedBounds(file: string): Rectangle | null {
  try {
    const saved = boundsSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    return screen.getAllDisplays().some((display) => overlaps(saved, display.workArea))
      ? saved
      : null
  } catch {
    return null
  }
}

function initialBounds(file: string): Partial<Rectangle> & { width: number; height: number } {
  const saved = savedBounds(file)
  if (saved) return saved
  const area = screen.getPrimaryDisplay().workArea
  return {
    width: Math.min(DEFAULT_SIZE.width, area.width),
    height: Math.min(DEFAULT_SIZE.height, area.height)
  }
}

function prepareSession(target: Session): void {
  target.setUserAgent(chromeUserAgent(process.platform, process.versions.chrome), 'pt-BR,pt')
  target.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(ALLOWED_PERMISSIONS.has(permission))
  )
  target.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission))
}

export function createWhatsAppWindow({ boundsFile }: { boundsFile: string }): WhatsAppWindow {
  let window: BrowserWindow | null = null
  let prepared = false
  let quitting = false
  app.on('before-quit', () => {
    quitting = true
  })

  function saveBounds(target: BrowserWindow): void {
    try {
      writeAtomicJson(boundsFile, target.getNormalBounds())
    } catch (error) {
      console.error('[whatsapp] posição da janela não salva', error)
    }
  }

  function build(): BrowserWindow {
    const target = session.fromPartition(PARTITION)
    if (!prepared) {
      prepareSession(target)
      prepared = true
    }
    const created = new BrowserWindow({
      ...initialBounds(boundsFile),
      minWidth: 640,
      minHeight: 480,
      title: 'WhatsApp',
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        session: target,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false
      }
    })
    const contents = created.webContents
    contents.setWindowOpenHandler(({ url }) => {
      openOutside(url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (isWhatsAppPage(url)) return
      event.preventDefault()
      openOutside(url)
    })
    contents.on('will-redirect', (event, url) => {
      if (!isWhatsAppPage(url)) event.preventDefault()
    })
    contents.on('will-attach-webview', (event) => event.preventDefault())
    created.once('ready-to-show', () => created.show())
    created.on('close', (event) => {
      saveBounds(created)
      if (quitting) return
      event.preventDefault()
      created.hide()
    })
    created.on('closed', () => {
      if (window === created) window = null
    })
    return created
  }

  return {
    open(phone, text) {
      const url = whatsAppUrl(phone, text)
      if (!window || window.isDestroyed()) {
        window = build()
      } else {
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
      }
      window.loadURL(url).catch((error: unknown) => {
        console.error('[whatsapp] conversa não abriu', error)
      })
    },
    owns(target) {
      return window !== null && target === window
    },
    close() {
      if (!window || window.isDestroyed()) return
      saveBounds(window)
      window.destroy()
      window = null
    }
  }
}
