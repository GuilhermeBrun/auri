import {
  app,
  session,
  shell,
  webContents,
  WebContentsView,
  type BrowserWindow,
  type Session
} from 'electron'
import type { WhatsAppBounds } from '../shared/api'

const HOST = 'web.whatsapp.com'
const HOME = `https://${HOST}/`
const PARTITION = 'persist:whatsapp'
const ALLOWED_PERMISSIONS = new Set(['notifications', 'clipboard-sanitized-write'])

export type WhatsAppView = {
  attach(window: BrowserWindow): void
  setEnabled(enabled: boolean): Promise<void>
  setPaused(paused: boolean): void
  open(phone: string, text: string): boolean
  show(bounds: WhatsAppBounds): void
  hide(): void
  unread(): number
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

export function unreadFromTitle(title: string): number {
  const match = /^\((\d+)\)/.exec(title.trim())
  return match ? Number(match[1]) : 0
}

function openOutside(target: string): void {
  try {
    const url = new URL(target)
    if (url.protocol === 'https:' || url.protocol === 'mailto:') void shell.openExternal(url.href)
  } catch {
    return
  }
}

function prepareSession(target: Session): void {
  target.setUserAgent(chromeUserAgent(process.platform, process.versions.chrome), 'pt-BR,pt')
  target.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(ALLOWED_PERMISSIONS.has(permission))
  )
  target.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission))
}

export function orphanWorkers(
  workers: { renderProcessId: number }[],
  pages: number[],
  processes: { pid: number; type: string }[]
): number[] {
  const expected = new Set(workers.map((w) => w.renderProcessId)).size
  if (expected === 0) return []
  const owned = new Set(pages)
  const orphans = processes.filter((p) => p.type === 'Tab' && !owned.has(p.pid)).map((p) => p.pid)
  return orphans.length === expected ? orphans : []
}

function stopWorkers(partition: Session): void {
  const pids = orphanWorkers(
    Object.values(partition.serviceWorkers.getAllRunning()),
    webContents.getAllWebContents().map((contents) => contents.getOSProcessId()),
    app.getAppMetrics()
  )
  for (const pid of pids) {
    try {
      process.kill(pid)
    } catch (error) {
      console.error('[whatsapp] processo em segundo plano não fechou', error)
    }
  }
}

export function createWhatsAppView({
  enabled: initiallyEnabled,
  paused: initiallyPaused = false,
  onUnread,
  onOpen
}: {
  enabled: boolean
  paused?: boolean
  onUnread: (count: number) => void
  onOpen: () => void
}): WhatsAppView {
  let enabled = initiallyEnabled
  let paused = initiallyPaused
  let window: BrowserWindow | null = null
  let view: WebContentsView | null = null
  let prepared = false
  let count = 0

  function setCount(next: number): void {
    if (next === count) return
    count = next
    onUnread(count)
  }

  function build(target: BrowserWindow): WebContentsView {
    const partition = session.fromPartition(PARTITION)
    if (!prepared) {
      prepareSession(partition)
      prepared = true
    }
    const created = new WebContentsView({
      webPreferences: {
        session: partition,
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
    contents.on('page-title-updated', (_event, title) => setCount(unreadFromTitle(title)))
    created.setVisible(false)
    target.contentView.addChildView(created)
    contents.loadURL(HOME).catch((error: unknown) => {
      console.error('[whatsapp] não abriu', error)
    })
    return created
  }

  function teardown(): void {
    if (view) {
      if (window && !window.isDestroyed()) window.contentView.removeChildView(view)
      if (!view.webContents.isDestroyed()) view.webContents.close()
    }
    view = null
    setCount(0)
  }

  function ensure(): WebContentsView | null {
    if (!enabled || paused || !window || window.isDestroyed()) return null
    view ??= build(window)
    return view
  }

  return {
    attach(target) {
      teardown()
      window = target
      target.once('closed', () => {
        if (window !== target) return
        view = null
        window = null
        setCount(0)
      })
      target.webContents.once('did-finish-load', () => {
        if (window === target) ensure()
      })
    },
    async setEnabled(next) {
      if (next === enabled) return
      enabled = next
      if (enabled) {
        ensure()
        return
      }
      teardown()
      const partition = session.fromPartition(PARTITION)
      await partition.clearStorageData()
      await partition.clearCache()
      stopWorkers(partition)
    },
    setPaused(next) {
      if (next === paused) return
      paused = next
      if (!paused) {
        ensure()
        return
      }
      teardown()
      stopWorkers(session.fromPartition(PARTITION))
    },
    open(phone, text) {
      const current = ensure()
      if (!current) return false
      current.webContents.loadURL(whatsAppUrl(phone, text)).catch((error: unknown) => {
        console.error('[whatsapp] conversa não abriu', error)
      })
      onOpen()
      return true
    },
    show(bounds) {
      const current = ensure()
      if (!current) return
      const zoom = window?.webContents.getZoomFactor() ?? 1
      current.setBounds({
        x: Math.round(bounds.x * zoom),
        y: Math.round(bounds.y * zoom),
        width: Math.max(0, Math.round(bounds.width * zoom)),
        height: Math.max(0, Math.round(bounds.height * zoom))
      })
      if (!current.getVisible()) {
        current.setVisible(true)
        current.webContents.focus()
      }
    },
    hide() {
      view?.setVisible(false)
    },
    unread: () => count
  }
}
