import { EventEmitter } from 'node:events'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi, type Mock } from 'vite-plus/test'
import type { UpdateState } from '../shared/api'
import {
  channelFile,
  CHECK_EVERY_MS,
  createUpdateService,
  FIRST_CHECK_MS,
  hasTeamIdentifier,
  type Updater
} from './updates'

/** `autoUpdater` falso: os eventos são disparados pelo teste. */
function fakeUpdater(): Updater & EventEmitter & { check: Mock<() => Promise<unknown>> } {
  const check = vi.fn<() => Promise<unknown>>(() => Promise.resolve(null))
  return Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    channel: null,
    allowPrerelease: false,
    allowDowngrade: false,
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

  it('o canal vem da versão instalada ou da escolha e muda as versões procuradas', () => {
    const stable = fakeUpdater()
    const timers = fakeTimers().timers
    createUpdateService({ version: '1.1.0', updater: stable, onChange: vi.fn(), timers })
    expect(stable).toMatchObject({
      channel: 'latest',
      allowPrerelease: false,
      allowDowngrade: false
    })

    const beta = fakeUpdater()
    const saved = vi.fn()
    const service = createUpdateService({
      version: '1.1.1-beta.20261016.1',
      updater: beta,
      onChange: vi.fn(),
      onChannelChange: saved,
      timers
    })
    expect(service.info().channel).toBe('beta')
    expect(beta).toMatchObject({ channel: 'beta', allowPrerelease: true })

    // voltar para a estável com um beta instalado aceita descer de versão
    expect(service.setChannel('latest').channel).toBe('latest')
    expect(beta).toMatchObject({ channel: 'latest', allowPrerelease: false, allowDowngrade: true })
    expect(saved).toHaveBeenCalledExactlyOnceWith('latest')
    expect(beta.check).toHaveBeenCalledOnce()
    service.setChannel('latest')
    expect(saved).toHaveBeenCalledOnce()
  })

  it('não troca de canal com uma versão baixando ou pronta', () => {
    const updater = fakeUpdater()
    const service = createUpdateService({
      version: '1.1.0',
      updater,
      channel: 'beta',
      onChange: vi.fn(),
      timers: fakeTimers().timers
    })
    expect(updater.channel).toBe('beta')
    updater.emit('update-available', { version: '1.1.1-beta.20261016.1' })
    expect(() => service.setChannel('latest')).toThrow('Espere a versão nova')
    expect(service.info().channel).toBe('beta')
  })

  it('guarda o canal escolhido e ignora arquivo ausente ou inválido', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'auri-canal-')), 'atualizacoes.json')
    const store = channelFile(file)
    expect(store.read()).toBeUndefined()
    store.save('beta')
    expect(store.read()).toBe('beta')
    writeFileSync(file, '{"channel":"nightly"}')
    expect(store.read()).toBeUndefined()
    writeFileSync(file, 'quebrado')
    expect(store.read()).toBeUndefined()
  })
})

describe('assinatura do Mac', () => {
  const codesign = (team: string): string =>
    [
      'Executable=/Applications/Auri.app/Contents/MacOS/Auri',
      'Identifier=com.auri.app',
      'Format=app bundle with Mach-O thin (arm64)',
      'CodeDirectory v=20500 size=1234 flags=0x10000(runtime) hashes=27+7 location=embedded',
      'Signature size=9000',
      `TeamIdentifier=${team}`,
      'Sealed Resources version=2 rules=13 files=40'
    ].join('\n')

  it('troca o app sozinho só com Developer ID (Team ID)', () => {
    expect(hasTeamIdentifier(codesign('A1B2C3D4E5'))).toBe(true)
    expect(hasTeamIdentifier(codesign('not set'))).toBe(false)
    expect(hasTeamIdentifier('code object is not signed at all')).toBe(false)
  })
})
