import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  chromeUserAgent,
  createWhatsAppView,
  isWhatsAppPage,
  unreadFromTitle,
  whatsAppUrl
} from './whatsapp-view'

type Listener = (...args: unknown[]) => void

const mocks = vi.hoisted(() => {
  const views: FakeView[] = []
  const openExternal = vi.fn()
  const fakeSession = {
    setUserAgent: vi.fn(),
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    clearStorageData: vi.fn(() => Promise.resolve()),
    clearCache: vi.fn(() => Promise.resolve())
  }
  class FakeView {
    visible = true
    bounds: unknown = null
    listeners = new Map<string, Listener>()
    openHandler: ((details: { url: string }) => { action: string }) | null = null
    closed = false
    webContents = {
      loadURL: vi.fn(() => Promise.resolve()),
      focus: vi.fn(),
      close: vi.fn(() => {
        this.closed = true
      }),
      isDestroyed: () => this.closed,
      setWindowOpenHandler: (fn: (details: { url: string }) => { action: string }) => {
        this.openHandler = fn
      },
      on: (name: string, fn: Listener) => {
        this.listeners.set(name, fn)
      }
    }
    constructor(public options: Record<string, unknown>) {
      views.push(this)
    }
    setVisible(visible: boolean) {
      this.visible = visible
    }
    getVisible() {
      return this.visible
    }
    setBounds(bounds: unknown) {
      this.bounds = bounds
    }
  }
  return { views, openExternal, fakeSession, FakeView }
})

vi.mock('electron', () => ({
  WebContentsView: mocks.FakeView,
  session: { fromPartition: vi.fn(() => mocks.fakeSession) },
  shell: { openExternal: mocks.openExternal }
}))

function fakeWindow() {
  const listeners = new Map<string, Listener>()
  const loads: Listener[] = []
  const children: unknown[] = []
  return {
    children,
    loaded: () => loads.forEach((fn) => fn()),
    close: () => listeners.get('closed')?.(),
    window: {
      isDestroyed: () => false,
      once: (name: string, fn: Listener) => listeners.set(name, fn),
      webContents: { once: (_name: string, fn: Listener) => loads.push(fn) },
      contentView: {
        addChildView: (view: unknown) => children.push(view),
        removeChildView: (view: unknown) => children.splice(children.indexOf(view), 1)
      }
    }
  }
}

function setup(enabled = true) {
  const onUnread = vi.fn()
  const onOpen = vi.fn()
  const whatsapp = createWhatsAppView({ enabled, onUnread, onOpen })
  const main = fakeWindow()
  whatsapp.attach(main.window as never)
  return { whatsapp, main, onUnread, onOpen }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.views.length = 0
})

describe('WhatsApp dentro do Auri', () => {
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
      'file:///etc/passwd',
      'nada'
    ])
      expect(isWhatsAppPage(url)).toBe(false)
  })

  it('apresenta-se como o Chrome da mesma versão do Electron', () => {
    const agent = chromeUserAgent('win32', '146.0.7680.65')
    expect(agent).toContain('Windows NT 10.0; Win64; x64')
    expect(agent).toContain('Chrome/146.0.0.0 Safari/537.36')
    expect(agent).not.toContain('Electron')
  })

  it('lê as não lidas do título da página', () => {
    expect(unreadFromTitle('(3) WhatsApp')).toBe(3)
    expect(unreadFromTitle('WhatsApp')).toBe(0)
  })

  it('carrega escondido depois da janela principal, isolado e sem preload', () => {
    const { main } = setup()
    expect(mocks.views).toHaveLength(0)
    main.loaded()
    expect(mocks.views).toHaveLength(1)
    const [view] = mocks.views
    expect(view.options).toMatchObject({
      webPreferences: {
        session: mocks.fakeSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false
      }
    })
    expect(view.options.webPreferences).not.toHaveProperty('preload')
    expect(view.visible).toBe(false)
    expect(main.children).toEqual([view])
    expect(view.webContents.loadURL).toHaveBeenCalledWith('https://web.whatsapp.com/')
  })

  it('mostra na área da tela, esconde ao sair e reaproveita a mesma vista na conversa', () => {
    const { whatsapp, main, onOpen } = setup()
    main.loaded()
    const [view] = mocks.views
    whatsapp.show({ x: 216.4, y: 48, width: 800.6, height: 600 })
    expect(view.bounds).toEqual({ x: 216, y: 48, width: 801, height: 600 })
    expect(view.visible).toBe(true)
    whatsapp.hide()
    expect(view.visible).toBe(false)
    expect(whatsapp.open('5565900000000', 'Oi')).toBe(true)
    expect(mocks.views).toHaveLength(1)
    expect(view.webContents.loadURL).toHaveBeenLastCalledWith(whatsAppUrl('5565900000000', 'Oi'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('avisa as não lidas só quando mudam', () => {
    const { main, onUnread } = setup()
    main.loaded()
    const title = mocks.views[0].listeners.get('page-title-updated')!
    title({}, '(2) WhatsApp')
    title({}, '(2) WhatsApp')
    title({}, 'WhatsApp')
    expect(onUnread.mock.calls).toEqual([[2], [0]])
  })

  it('desligado não carrega nada e o envio fica para fora do Auri', () => {
    const { whatsapp, main } = setup(false)
    main.loaded()
    expect(mocks.views).toHaveLength(0)
    expect(whatsapp.open('5565900000000', 'Oi')).toBe(false)
    whatsapp.show({ x: 0, y: 0, width: 10, height: 10 })
    expect(mocks.views).toHaveLength(0)
  })

  it('desligar fecha a vista e sai da conta; religar carrega de novo', async () => {
    const { whatsapp, main } = setup()
    main.loaded()
    const [view] = mocks.views
    await whatsapp.setEnabled(false)
    expect(view.closed).toBe(true)
    expect(main.children).toEqual([])
    expect(mocks.fakeSession.clearStorageData).toHaveBeenCalled()
    expect(whatsapp.unread()).toBe(0)
    await whatsapp.setEnabled(true)
    expect(mocks.views).toHaveLength(2)
  })

  it('libera só notificações e cópia; bloqueia navegação fora do WhatsApp Web', () => {
    const { main } = setup()
    main.loaded()
    const request = mocks.fakeSession.setPermissionRequestHandler.mock.calls[0][0] as (
      contents: unknown,
      permission: string,
      callback: (allowed: boolean) => void
    ) => void
    for (const [permission, allowed] of [
      ['notifications', true],
      ['clipboard-sanitized-write', true],
      ['media', false],
      ['geolocation', false]
    ] as const) {
      const callback = vi.fn()
      request(null, permission, callback)
      expect(callback).toHaveBeenCalledWith(allowed)
    }
    const [view] = mocks.views
    const outside = { preventDefault: vi.fn() }
    view.listeners.get('will-navigate')!(outside, 'https://example.com/artigo')
    expect(outside.preventDefault).toHaveBeenCalled()
    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com/artigo')
    const inside = { preventDefault: vi.fn() }
    view.listeners.get('will-navigate')!(inside, 'https://web.whatsapp.com/')
    expect(inside.preventDefault).not.toHaveBeenCalled()
    expect(view.openHandler!({ url: 'javascript:alert(1)' })).toEqual({ action: 'deny' })
    expect(mocks.openExternal).toHaveBeenCalledTimes(1)
  })

  it('a vista morre com a janela e volta quando outra janela abre', () => {
    const { whatsapp, main } = setup()
    main.loaded()
    main.close()
    expect(whatsapp.open('5565900000000', 'Oi')).toBe(false)
    const other = fakeWindow()
    whatsapp.attach(other.window as never)
    other.loaded()
    expect(mocks.views).toHaveLength(2)
  })
})
