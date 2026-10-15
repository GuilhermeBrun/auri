import { EventEmitter } from 'node:events'
import { describe, expect, it, vi, type Mock } from 'vite-plus/test'
import type { UpdateState } from '../shared/api'
import { CHECK_EVERY_MS, createUpdateService, FIRST_CHECK_MS, type Updater } from './updates'

/** `autoUpdater` falso: os eventos são disparados pelo teste. */
function fakeUpdater(): Updater & EventEmitter & { check: Mock<() => Promise<unknown>> } {
  const check = vi.fn<() => Promise<unknown>>(() => Promise.resolve(null))
  return Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: check,
    quitAndInstall: vi.fn(),
    check
  })
}

function fakeTimers(): {
  timers: Parameters<typeof createUpdateService>[0]['timers']
  scheduled: { ms: number; fn: () => void; kind: string }[]
  cleared: unknown[]
} {
  const scheduled: { ms: number; fn: () => void; kind: string }[] = []
  const cleared: unknown[] = []
  return {
    scheduled,
    cleared,
    timers: {
      setTimeout: (fn, ms) => scheduled.push({ fn, ms, kind: 'timeout' }),
      setInterval: (fn, ms) => scheduled.push({ fn, ms, kind: 'interval' }),
      clear: (handle) => cleared.push(handle)
    }
  }
}

const NOW = new Date('2026-10-15T13:00:00.000Z')

describe('atualização automática', () => {
  it('sem atualizador fica indisponível e não procura nem instala', () => {
    const onChange = vi.fn()
    const { timers, scheduled } = fakeTimers()
    const service = createUpdateService({ version: '1.0.0', updater: null, onChange, timers })
    expect(service.info()).toMatchObject({ version: '1.0.0', status: 'unavailable' })
    expect(service.check().status).toBe('unavailable')
    expect(() => service.install()).toThrow('Nenhuma versão nova pronta.')
    expect(scheduled).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('procura logo depois de abrir e a cada 4 horas; ao fechar, para', () => {
    const updater = fakeUpdater()
    const { timers, scheduled, cleared } = fakeTimers()
    const service = createUpdateService({ version: '1.0.0', updater, onChange: vi.fn(), timers })
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(scheduled.map(({ kind, ms }) => [kind, ms])).toEqual([
      ['timeout', FIRST_CHECK_MS],
      ['interval', CHECK_EVERY_MS]
    ])
    scheduled[0].fn()
    expect(updater.check).toHaveBeenCalledOnce()
    service.close()
    expect(cleared).toHaveLength(2)
  })

  it('com os relógios de verdade, agenda as procuras sem segurar o app aberto e cancela ao fechar', () => {
    const updater = fakeUpdater()
    const service = createUpdateService({ version: '1.0.0', updater, onChange: vi.fn() })
    service.close()
    expect(updater.check).not.toHaveBeenCalled()
  })

  it('acompanha procura, download e versão pronta, e instala só quando pronta', () => {
    const updater = fakeUpdater()
    const states: UpdateState[] = []
    const service = createUpdateService({
      version: '1.0.0',
      updater,
      onChange: (state) => states.push(state),
      now: () => NOW,
      timers: fakeTimers().timers
    })
    expect(service.info().status).toBe('idle')
    service.check()
    expect(updater.check).toHaveBeenCalledOnce()
    updater.emit('checking-for-update')
    expect(service.info().status).toBe('checking')
    // já procurando: não procura de novo
    service.check()
    expect(updater.check).toHaveBeenCalledOnce()
    updater.emit('update-available', { version: '1.1.0' })
    expect(service.info()).toMatchObject({
      status: 'downloading',
      next: '1.1.0',
      progress: 0,
      checkedAt: NOW.toISOString()
    })
    updater.emit('download-progress', { percent: 41.6 })
    expect(service.info().progress).toBe(42)
    expect(() => service.install()).toThrow('Nenhuma versão nova pronta.')
    updater.emit('update-downloaded', { version: '1.1.0' })
    expect(service.info()).toMatchObject({ status: 'ready', next: '1.1.0', progress: null })
    // uma procura que falha depois não esconde a versão pronta
    updater.emit('error', new Error('rede'))
    expect(service.info().status).toBe('ready')
    service.install()
    expect(updater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(true, true)
    expect(states.map(({ status }) => status)).toEqual([
      'checking',
      'downloading',
      'downloading',
      'ready'
    ])
  })

  it('sem versão nova registra a procura; falha mostra o motivo e permite tentar de novo', async () => {
    const updater = fakeUpdater()
    updater.check.mockImplementation(() => Promise.reject(new Error('offline')))
    const service = createUpdateService({
      version: '1.0.0',
      updater,
      onChange: vi.fn(),
      now: () => NOW,
      timers: fakeTimers().timers
    })
    updater.emit('update-not-available')
    expect(service.info()).toMatchObject({ status: 'idle', checkedAt: NOW.toISOString() })
    service.check()
    await Promise.resolve()
    updater.emit('error', new Error('offline'))
    expect(service.info()).toMatchObject({
      status: 'error',
      error: expect.stringContaining('internet')
    })
    service.check()
    expect(updater.check).toHaveBeenCalledTimes(2)
  })
})
