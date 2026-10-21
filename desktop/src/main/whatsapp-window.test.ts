import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  chromeUserAgent,
  createWhatsAppWindow,
  isWhatsAppPage,
  whatsAppUrl
} from './whatsapp-window'

type Listener = (...args: unknown[]) => void

const mocks = vi.hoisted(() => {
  const windows: FakeWindow[] = []
  const appListeners = new Map<string, () => void>()
  const openExternal = vi.fn()
  const fakeSession = {
    setUserAgent: vi.fn(),
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn()
  }
  class FakeWindow {
    listeners = new Map<string, Listener[]>()
    contentsListeners = new Map<string, Listener>()
    openHandler: ((details: { url: string }) => { action: string }) | null = null
    destroyed = false
    visible = false
    minimized = false
    loadURL = vi.fn(() => Promise.resolve())
    show = vi.fn(() => {
      this.visible = true
    })
    hide = vi.fn(() => {
      this.visible = false
    })
    focus = vi.fn()
    restore = vi.fn()
    webContents = {
      setWindowOpenHandler: (fn: (details: { url: string }) => { action: string }) => {
        this.openHandler = fn
      },
      on: (name: string, fn: Listener) => {
        this.contentsListeners.set(name, fn)
      }
    }
    constructor(public options: Record<string, unknown>) {
      windows.push(this)
    }
    on(name: string, fn: Listener) {
      this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn])
    }
    once(name: string, fn: Listener) {
      this.on(name, fn)
    }
    emit(name: string, ...args: unknown[]) {
      for (const fn of this.listeners.get(name) ?? []) fn(...args)
    }
    isDestroyed() {
      return this.destroyed
    }
    isMinimized() {
      return this.minimized
    }
    getNormalBounds() {
      return { x: 40, y: 50, width: 900, height: 700 }
    }
    destroy() {
      this.destroyed = true
      this.emit('closed')
    }
  }
  return { windows, appListeners, openExternal, fakeSession, FakeWindow }
})

vi.mock('electron', () => ({
  app: { on: (name: string, fn: () => void) => mocks.appListeners.set(name, fn) },
  BrowserWindow: mocks.FakeWindow,
  session: { fromPartition: vi.fn(() => mocks.fakeSession) },
  shell: { openExternal: mocks.openExternal },
  screen: {
    getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1093, height: 614 } }],
    getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1093, height: 614 } })
  }
}))

let boundsFile: string
beforeEach(() => {
  vi.clearAllMocks()
  mocks.windows.length = 0
  boundsFile = join(mkdtempSync(join(tmpdir(), 'auri-whatsapp-')), 'janela.json')
})

describe('janela do WhatsApp', () => {
  it('monta a conversa no WhatsApp Web com o texto codificado', () => {
    expect(whatsAppUrl('5565900000000', 'Olá, Ana & cia?\nSessão #2')).toBe(
      'https://web.whatsapp.com/send?phone=5565900000000&text=Ol%C3%A1%2C%20Ana%20%26%20cia%3F%0ASess%C3%A3o%20%232'
    )
  })

  it('aceita só páginas https de web.whatsapp.com', () => {
    expect(isWhatsAppPage('https://web.whatsapp.com/send?phone=1')).toBe(true)
    for (const url of [
      'http://web.whatsapp.com/',
      'https://web.whatsapp.com.evil.com/',
      'https://evil.com/?https://web.whatsapp.com',
      'https://faq.whatsapp.com/',
      'file:///etc/passwd',
      'nada'
    ])
      expect(isWhatsAppPage(url)).toBe(false)
  })

  it('apresenta-se como o Chrome da mesma versão do Electron, sem citar o Electron', () => {
    const agent = chromeUserAgent('win32', '146.0.7680.65')
    expect(agent).toContain('Windows NT 10.0; Win64; x64')
    expect(agent).toContain('Chrome/146.0.0.0 Safari/537.36')
    expect(agent).not.toContain('Electron')
  })

  it('cria uma janela isolada e reaproveita a mesma no envio seguinte', () => {
    const whatsapp = createWhatsAppWindow({ boundsFile })
    whatsapp.open('5565900000000', 'Primeira')
    expect(mocks.windows).toHaveLength(1)
    const [window] = mocks.windows
    expect(window.options).toMatchObject({
      title: 'WhatsApp',
      width: 1000,
      height: 614,
      webPreferences: {
        session: mocks.fakeSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false
      }
    })
    expect(window.options.webPreferences).not.toHaveProperty('preload')
    expect(window.loadURL).toHaveBeenLastCalledWith(whatsAppUrl('5565900000000', 'Primeira'))
    expect(whatsapp.owns(window as never)).toBe(true)

    window.minimized = true
    whatsapp.open('5565911111111', 'Segunda')
    expect(mocks.windows).toHaveLength(1)
    expect(window.restore).toHaveBeenCalled()
    expect(window.focus).toHaveBeenCalled()
    expect(window.loadURL).toHaveBeenLastCalledWith(whatsAppUrl('5565911111111', 'Segunda'))
  })

  it('libera só notificações e cópia; o resto é negado', () => {
    createWhatsAppWindow({ boundsFile }).open('5565900000000', 'Oi')
    expect(mocks.fakeSession.setUserAgent).toHaveBeenCalledWith(
      expect.stringContaining('Chrome/'),
      'pt-BR,pt'
    )
    const request = mocks.fakeSession.setPermissionRequestHandler.mock.calls[0][0] as (
      contents: unknown,
      permission: string,
      callback: (allowed: boolean) => void
    ) => void
    const check = mocks.fakeSession.setPermissionCheckHandler.mock.calls[0][0] as (
      contents: unknown,
      permission: string
    ) => boolean
    for (const [permission, allowed] of [
      ['notifications', true],
      ['clipboard-sanitized-write', true],
      ['media', false],
      ['geolocation', false],
      ['clipboard-read', false],
      ['openExternal', false]
    ] as const) {
      const callback = vi.fn()
      request(null, permission, callback)
      expect(callback).toHaveBeenCalledWith(allowed)
      expect(check(null, permission)).toBe(allowed)
    }
  })

  it('bloqueia navegação fora do WhatsApp Web e manda links externos ao navegador', () => {
    createWhatsAppWindow({ boundsFile }).open('5565900000000', 'Oi')
    const [window] = mocks.windows
    const navigate = window.contentsListeners.get('will-navigate')!
    const inside = { preventDefault: vi.fn() }
    navigate(inside, 'https://web.whatsapp.com/')
    expect(inside.preventDefault).not.toHaveBeenCalled()
    const outside = { preventDefault: vi.fn() }
    navigate(outside, 'https://example.com/artigo')
    expect(outside.preventDefault).toHaveBeenCalled()
    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com/artigo')
    const file = { preventDefault: vi.fn() }
    navigate(file, 'file:///etc/passwd')
    expect(file.preventDefault).toHaveBeenCalled()
    expect(mocks.openExternal).toHaveBeenCalledTimes(1)
    const redirect = { preventDefault: vi.fn() }
    window.contentsListeners.get('will-redirect')!(redirect, 'https://evil.example/')
    expect(redirect.preventDefault).toHaveBeenCalled()
    expect(window.openHandler!({ url: 'https://example.com/novo' })).toEqual({ action: 'deny' })
    expect(mocks.openExternal).toHaveBeenLastCalledWith('https://example.com/novo')
    expect(window.openHandler!({ url: 'javascript:alert(1)' })).toEqual({ action: 'deny' })
    expect(mocks.openExternal).toHaveBeenCalledTimes(2)
  })

  it('fechar esconde e guarda a posição; ao sair do app a janela fecha de verdade', () => {
    writeFileSync(boundsFile, JSON.stringify({ x: 10, y: 20, width: 800, height: 600 }))
    const whatsapp = createWhatsAppWindow({ boundsFile })
    whatsapp.open('5565900000000', 'Oi')
    const [window] = mocks.windows
    expect(window.options).toMatchObject({ x: 10, y: 20, width: 800, height: 600 })
    const close = { preventDefault: vi.fn() }
    window.emit('close', close)
    expect(close.preventDefault).toHaveBeenCalled()
    expect(window.hide).toHaveBeenCalled()
    expect(JSON.parse(readFileSync(boundsFile, 'utf8'))).toEqual(window.getNormalBounds())
    mocks.appListeners.get('before-quit')!()
    const quit = { preventDefault: vi.fn() }
    window.emit('close', quit)
    expect(quit.preventDefault).not.toHaveBeenCalled()
  })

  it('ignora posição salva fora das telas e recria a janela depois de fechada pelo app', () => {
    writeFileSync(boundsFile, JSON.stringify({ x: 5000, y: 5000, width: 800, height: 600 }))
    const whatsapp = createWhatsAppWindow({ boundsFile })
    whatsapp.open('5565900000000', 'Oi')
    expect(mocks.windows[0].options).not.toHaveProperty('x')
    whatsapp.close()
    expect(mocks.windows[0].destroyed).toBe(true)
    expect(whatsapp.owns(mocks.windows[0] as never)).toBe(false)
    whatsapp.open('5565900000000', 'De novo')
    expect(mocks.windows).toHaveLength(2)
  })
})
