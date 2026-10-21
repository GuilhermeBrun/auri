import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  chromeUserAgent,
  createWhatsAppView,
  isWhatsAppPage,
  orphanWorkers,
  unreadFromTitle,
  whatsAppUrl
} from './whatsapp-view'

type Listener = (...args: unknown[]) => void

const mocks = vi.hoisted(() => {
  const views: FakeView[] = []
  const openExternal = vi.fn()
  const clipboardText = { value: '' }
  const writeText = vi.fn((text: string) => {
    clipboardText.value = text
    return Promise.resolve()
  })
  const running: Record<number, { renderProcessId: number }> = {}
  const kill = vi.fn()
  const fakeSession = {
    serviceWorkers: { getAllRunning: () => running },
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
      executeJavaScript: vi.fn(() => Promise.resolve(true)),
      paste: vi.fn(),
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
  return { views, openExternal, writeText, clipboardText, fakeSession, FakeView, running, kill }
})

vi.mock('electron', () => ({
  app: {
    getAppMetrics: () => [
      { pid: 10, type: 'Browser' },
      { pid: 11, type: 'Tab' },
      { pid: 12, type: 'Tab' }
    ]
  },
  webContents: { getAllWebContents: () => [{ getOSProcessId: () => 11 }] },
  WebContentsView: mocks.FakeView,
  session: { fromPartition: vi.fn(() => mocks.fakeSession) },
  shell: { openExternal: mocks.openExternal },
  clipboard: {
    writeText: mocks.writeText,
    readText: () => Promise.resolve(mocks.clipboardText.value),
    clear: () => {
      mocks.clipboardText.value = ''
    }
  }
}))

const zoom = { value: 1 }

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
      webContents: {
        once: (_name: string, fn: Listener) => loads.push(fn),
        getZoomFactor: () => zoom.value
      },
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
  for (const key of Object.keys(mocks.running)) delete mocks.running[Number(key)]
  vi.spyOn(process, 'kill').mockImplementation(mocks.kill as never)
})

describe('WhatsApp dentro do Auri', () => {
  it('abre a conversa no WhatsApp Web só com o número, sem a mensagem na URL', () => {
    expect(whatsAppUrl('5565900000000')).toBe('https://web.whatsapp.com/send?phone=5565900000000')
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

  it('mostra na área da tela, esconde ao sair e reaproveita a mesma vista na conversa', async () => {
    const { whatsapp, main, onOpen } = setup()
    main.loaded()
    const [view] = mocks.views
    whatsapp.show({ x: 216.4, y: 48, width: 800.6, height: 600 })
    expect(view.bounds).toEqual({ x: 216, y: 48, width: 801, height: 600 })
    expect(view.visible).toBe(true)
    whatsapp.hide()
    expect(view.visible).toBe(false)
    expect(await whatsapp.open('5565900000000', 'Oi')).toBe('copiada')
    expect(mocks.views).toHaveLength(1)
    expect(onOpen).toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(view.webContents.loadURL).toHaveBeenLastCalledWith(
        'https://web.whatsapp.com/send?phone=5565900000000'
      )
    )
  })

  it('a mensagem vai pela área de transferência e é colada quando o campo da conversa aparece', async () => {
    vi.useFakeTimers()
    try {
      const { whatsapp, main } = setup()
      main.loaded()
      const [view] = mocks.views
      const message =
        'Olá, Maria! "Termo", de Ana.\nhttps://auri.dev.br/assinar#k8Zt3mN2pL5vB7xC9dF1gQ'
      view.webContents.executeJavaScript
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
      void whatsapp.open('5565900000000', message)
      expect(mocks.writeText).toHaveBeenCalledExactlyOnceWith(message)
      await vi.advanceTimersByTimeAsync(0)
      expect(view.webContents.loadURL).toHaveBeenLastCalledWith(
        'https://web.whatsapp.com/send?phone=5565900000000'
      )
      expect(JSON.stringify(view.webContents.loadURL.mock.calls)).not.toMatch(/k8Zt|Maria|text=/)
      expect(view.webContents.paste).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1000)
      expect(view.webContents.executeJavaScript).toHaveBeenCalledTimes(3)
      expect(JSON.stringify(view.webContents.executeJavaScript.mock.calls)).not.toContain('k8Zt')
      expect(view.webContents.paste).toHaveBeenCalledTimes(1)
      expect(mocks.clipboardText.value).toBe(message)
      await vi.advanceTimersByTimeAsync(500)
      expect(mocks.clipboardText.value).toBe('')
      view.webContents.executeJavaScript.mockResolvedValue(true)
      void whatsapp.open('5565900000000', message)
      await vi.advanceTimersByTimeAsync(0)
      mocks.clipboardText.value = 'a pessoa copiou outra coisa depois'
      await vi.advanceTimersByTimeAsync(500)
      expect(mocks.clipboardText.value).toBe('a pessoa copiou outra coisa depois')
    } finally {
      vi.useRealTimers()
    }
  })

  it('sem conseguir copiar, abre a conversa, não tenta colar e avisa que não copiou', async () => {
    const { whatsapp, main } = setup()
    main.loaded()
    const [view] = mocks.views
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.writeText.mockRejectedValueOnce(new Error('área ocupada'))
    expect(await whatsapp.open('5565900000000', 'Oi')).toBe('sem-copia')
    await vi.waitFor(() =>
      expect(view.webContents.loadURL).toHaveBeenLastCalledWith(
        'https://web.whatsapp.com/send?phone=5565900000000'
      )
    )
    expect(view.webContents.executeJavaScript).not.toHaveBeenCalled()
    expect(view.webContents.paste).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('não cola a mensagem antiga se outra conversa foi aberta, e desiste se o campo não aparece', async () => {
    vi.useFakeTimers()
    try {
      const { whatsapp, main } = setup()
      main.loaded()
      const [view] = mocks.views
      view.webContents.executeJavaScript.mockResolvedValue(false)
      void whatsapp.open('5565900000000', 'Primeira')
      await vi.advanceTimersByTimeAsync(500)
      void whatsapp.open('5565911111111', 'Segunda')
      view.webContents.executeJavaScript.mockResolvedValue(true)
      await vi.advanceTimersByTimeAsync(0)
      expect(view.webContents.paste).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(5000)
      expect(view.webContents.paste).toHaveBeenCalledTimes(1)
      view.webContents.executeJavaScript.mockClear()
      view.webContents.executeJavaScript.mockResolvedValue(false)
      void whatsapp.open('5565900000000', 'Terceira')
      await vi.advanceTimersByTimeAsync(60_000)
      expect(view.webContents.executeJavaScript).toHaveBeenCalledTimes(60)
      expect(view.webContents.paste).toHaveBeenCalledTimes(1)
      void whatsapp.open('5565900000000', 'Quarta')
      mocks.clipboardText.value = 'outra coisa que a pessoa copiou'
      view.webContents.executeJavaScript.mockResolvedValue(true)
      await vi.advanceTimersByTimeAsync(1000)
      expect(view.webContents.paste).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('acompanha o zoom do texto maior', () => {
    const { whatsapp, main } = setup()
    main.loaded()
    zoom.value = 1.2
    whatsapp.show({ x: 216, y: 48, width: 800, height: 600 })
    expect(mocks.views[0].bounds).toEqual({ x: 259, y: 58, width: 960, height: 720 })
    zoom.value = 1
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

  it('desligado não carrega nada e o envio fica para fora do Auri', async () => {
    const { whatsapp, main } = setup(false)
    main.loaded()
    expect(mocks.views).toHaveLength(0)
    expect(await whatsapp.open('5565900000000', 'Oi')).toBeNull()
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

  it('escondido na barra lateral fica parado sem sair da conta; mostrar carrega de novo', async () => {
    const { whatsapp, main } = setup()
    main.loaded()
    const [view] = mocks.views
    mocks.running[1] = { renderProcessId: 7 }
    whatsapp.setPaused(true)
    expect(view.closed).toBe(true)
    expect(main.children).toEqual([])
    expect(mocks.kill).toHaveBeenCalledWith(12)
    expect(mocks.fakeSession.clearStorageData).not.toHaveBeenCalled()
    expect(await whatsapp.open('5565900000000', 'Oi')).toBeNull()
    whatsapp.show({ x: 0, y: 0, width: 10, height: 10 })
    expect(mocks.views).toHaveLength(1)
    whatsapp.setPaused(false)
    expect(mocks.views).toHaveLength(2)
  })

  it('abre parado quando já estava escondido', () => {
    const whatsapp = createWhatsAppView({
      enabled: true,
      paused: true,
      onUnread: vi.fn(),
      onOpen: vi.fn()
    })
    const main = fakeWindow()
    whatsapp.attach(main.window as never)
    main.loaded()
    expect(mocks.views).toHaveLength(0)
  })

  it('acha o processo em segundo plano do WhatsApp só quando a conta bate', () => {
    const processes = [
      { pid: 1, type: 'Browser' },
      { pid: 2, type: 'Tab' },
      { pid: 3, type: 'Tab' },
      { pid: 4, type: 'GPU' }
    ]
    expect(orphanWorkers([{ renderProcessId: 9 }], [2], processes)).toEqual([3])
    expect(orphanWorkers([], [2], processes)).toEqual([])
    expect(orphanWorkers([{ renderProcessId: 9 }], [], processes)).toEqual([])
    expect(orphanWorkers([{ renderProcessId: 9 }, { renderProcessId: 9 }], [2], processes)).toEqual(
      [3]
    )
  })

  it('desligar encerra o processo do WhatsApp que ficou em segundo plano', async () => {
    const { whatsapp, main } = setup()
    main.loaded()
    mocks.running[1] = { renderProcessId: 7 }
    await whatsapp.setEnabled(false)
    expect(mocks.kill).toHaveBeenCalledWith(12)
    expect(mocks.kill).toHaveBeenCalledTimes(1)
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

  it('a vista morre com a janela e volta quando outra janela abre', async () => {
    const { whatsapp, main } = setup()
    main.loaded()
    main.close()
    expect(await whatsapp.open('5565900000000', 'Oi')).toBeNull()
    const other = fakeWindow()
    whatsapp.attach(other.window as never)
    other.loaded()
    expect(mocks.views).toHaveLength(2)
  })
})
