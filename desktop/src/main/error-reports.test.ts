import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vite-plus/test'
import contract from '../../../web/contrato/relatorio-de-erro.json'
import {
  BATCH,
  cleanError,
  cleanStack,
  createErrorReports,
  FIRST_SEND_MS,
  MAX_REPORTS,
  RETRY_EVERY_MS,
  safeMessage,
  SAVE_DELAY_MS,
  SEND_DELAY_MS
} from './error-reports'

const CONTEXT = {
  version: '1.2.3',
  channel: 'latest',
  platform: 'darwin',
  arch: 'arm64',
  osVersion: '25.0.0',
  electron: '44.9.0'
}

const MAC_STACK = `TypeError: Cannot read properties of undefined (reading 'nome')
    at render (file:///Applications/Auri.app/Contents/Resources/app.asar/out/renderer/assets/index-abc.js:12:345)
    at /Users/maria/Library/Application Support/Auri/x.js:1:2
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)`

const WINDOWS_STACK = `Error: Esse horário já está ocupado: Ana Souza
    at save (C:\\Users\\Maria\\AppData\\Local\\Programs\\auri\\resources\\app.asar\\out\\main\\index.js:7:9)`

function setup(
  options: { endpoint?: string | null; response?: () => Promise<Response>; file?: string } = {}
) {
  const file = options.file ?? join(mkdtempSync(join(tmpdir(), 'auri-erros-')), 'erros.json')
  const scheduled: { fn: () => void; ms: number; kind: string }[] = []
  const fetch = vi.fn<typeof globalThis.fetch>(
    options.response ?? (() => Promise.resolve(new Response(null, { status: 204 })))
  )
  const service = createErrorReports({
    file,
    endpoint: options.endpoint === undefined ? 'https://exemplo.test/api/erros' : options.endpoint,
    home: '/Users/maria',
    context: () => CONTEXT,
    fetch,
    now: () => new Date('2026-10-19T13:00:00.000Z'),
    timers: {
      setTimeout: (fn, ms) => scheduled.push({ fn, ms, kind: 'timeout' }),
      setInterval: (fn, ms) => scheduled.push({ fn, ms, kind: 'interval' }),
      clear: () => {}
    }
  })
  const sent = (index = 0): Record<string, unknown> =>
    JSON.parse(fetch.mock.calls[index]![1]!.body as string) as Record<string, unknown>
  const saved = (): { enabled: boolean; reports: { pending: boolean; count: number }[] } =>
    JSON.parse(readFileSync(file, 'utf8'))
  return { file, service, fetch, scheduled, sent, saved }
}

const crash = (name = 'TypeError', stack = MAC_STACK) => ({ name, message: 'x', stack })

describe('limpeza das falhas', () => {
  it('só guarda a mensagem dos erros do próprio JavaScript e do banco', () => {
    expect(safeMessage('TypeError', "Cannot read properties of undefined (reading 'nome')")).toBe(
      "Cannot read properties of undefined (reading 'nome')"
    )
    expect(safeMessage('SqliteError', 'database is locked')).toBe('database is locked')
    expect(safeMessage('Error', 'Esse horário já está ocupado: Ana Souza')).toBeNull()
    expect(safeMessage('SyntaxError', 'Unexpected token "Ana Souza"')).toBeNull()
    expect(safeMessage('ZodError', 'nome inválido')).toBeNull()
  })

  it('tira textos entre aspas e números longos (CPF, telefone) da mensagem', () => {
    expect(safeMessage('TypeError', 'Cannot use "Ana Souza" with 12345678901')).toBe(
      'Cannot use "…" with #'
    )
  })

  it('tira valores entre aspas simples e números com pontuação, mas deixa o nome da propriedade', () => {
    expect(safeMessage('TypeError', "Cannot create property 'nome' on string 'Ana Souza'")).toBe(
      "Cannot create property 'nome' on string '…'"
    )
    expect(
      safeMessage('TypeError', "Cannot read properties of undefined (reading '123.456.789-00')")
    ).toBe("Cannot read properties of undefined (reading '…')")
    expect(safeMessage('RangeError', 'Invalid date 12/03/1990, phone (65) 99999-1234')).toBe(
      'Invalid date #, phone (65) #'
    )
    expect(safeMessage('RangeError', 'digits argument must be between 0 and 100')).toBe(
      'digits argument must be between 0 and 100'
    )
  })

  it('guarda só as linhas do código, sem a pasta nem o nome do usuário', () => {
    expect(cleanStack(MAC_STACK, '/Users/maria')).toBe(
      [
        'at render (app.asar/out/renderer/assets/index-abc.js:12:345)',
        'at ~/Library/Application Support/Auri/x.js:1:2',
        'at process.processTicksAndRejections (node:internal/process/task_queues:105:5)'
      ].join('\n')
    )
    expect(cleanStack(WINDOWS_STACK, 'C:\\Users\\Outra')).toBe(
      'at save (app.asar\\out\\main\\index.js:7:9)'
    )
    expect(cleanStack('C:\\Users\\Maria\\x.js', '')).toBeNull()
    expect(
      cleanStack(`Error\n${'    at f (x.js:1:1)\n'.repeat(40)}`, '')!.split('\n')
    ).toHaveLength(15)
  })

  it('a mensagem que pode ter dados de paciente não sai, nem na primeira linha da pilha', () => {
    const clean = cleanError(
      Object.assign(new Error('Esse horário já está ocupado: Ana Souza'), {
        stack: WINDOWS_STACK
      }),
      ''
    )
    expect(clean).toEqual({
      name: 'Error',
      message: null,
      stack: 'at save (app.asar\\out\\main\\index.js:7:9)'
    })
    expect(JSON.stringify(clean)).not.toContain('Ana')
  })

  it('aceita qualquer coisa lançada', () => {
    expect(cleanError('Ana Souza', '')).toEqual({ name: 'string', message: null, stack: null })
    expect(cleanError(null, '')).toEqual({ name: 'object', message: null, stack: null })
  })
})

describe('relatórios de erro', () => {
  it('guarda no arquivo e envia sozinho, com a versão e o sistema', async () => {
    const { service, fetch, scheduled, sent, saved } = setup()
    expect(scheduled.map(({ ms, kind }) => ({ ms, kind }))).toEqual([
      { ms: RETRY_EVERY_MS, kind: 'interval' },
      { ms: FIRST_SEND_MS, kind: 'timeout' }
    ])
    service.capture('renderer', crash())
    expect(saved().reports).toMatchObject([{ pending: true, count: 1 }])
    expect(scheduled.at(-1)!.ms).toBe(SEND_DELAY_MS)
    scheduled.at(-1)!.fn()
    await vi.waitFor(() => expect(saved().reports[0]!.pending).toBe(false))
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0]![0]).toBe('https://exemplo.test/api/erros')
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'POST', redirect: 'error' })
    const body = sent()
    expect(body).toMatchObject({ ...CONTEXT, installId: expect.any(String) })
    expect(body.reports).toEqual([
      {
        id: expect.any(String),
        at: '2026-10-19T13:00:00.000Z',
        origin: 'renderer',
        name: 'TypeError',
        message: 'x',
        stack: expect.stringContaining('at render (app.asar/out/renderer'),
        count: 1
      }
    ])
    expect(service.info()).toEqual({ enabled: true, count: 1 })
  })

  it('a mesma falha repetida vira uma só, com a contagem', async () => {
    const { service, fetch, sent } = setup()
    for (let i = 0; i < 5; i++) service.capture('main', crash())
    service.capture('main', crash('RangeError'))
    await service.flush()
    expect(fetch).toHaveBeenCalledOnce()
    expect(
      (sent().reports as { name: string; count: number }[]).map((r) => [r.name, r.count])
    ).toEqual([
      ['TypeError', 5],
      ['RangeError', 1]
    ])
    service.capture('main', crash())
    await service.flush()
    expect((sent(1).reports as { count: number }[])[0]!.count).toBe(1)
  })

  it('a falha que se repete não adia o envio e grava a contagem depois', () => {
    const { service, scheduled, saved } = setup()
    service.capture('main', crash())
    for (let i = 0; i < 10; i++) service.capture('main', crash())
    expect(scheduled.filter(({ ms }) => ms === SEND_DELAY_MS)).toHaveLength(1)
    expect(saved().reports[0]!.count).toBe(1)
    const later = scheduled.filter(({ ms }) => ms === SAVE_DELAY_MS)
    expect(later).toHaveLength(1)
    later[0]!.fn()
    expect(saved().reports[0]!.count).toBe(11)
  })

  it('o que se repete durante um envio sai no envio seguinte', async () => {
    let answer: (response: Response) => void = () => {}
    let response = (): Promise<Response> =>
      new Promise((resolve) => {
        answer = resolve
      })
    const { service, sent, saved } = setup({ response: () => response() })
    service.capture('main', crash())
    const sending = service.flush()
    service.capture('main', crash())
    service.capture('main', crash())
    answer(new Response(null, { status: 204 }))
    await sending
    expect(saved().reports).toMatchObject([
      { count: 1, pending: false },
      { count: 2, pending: true }
    ])
    response = () => Promise.resolve(new Response(null, { status: 204 }))
    await service.flush()
    const [first, second] = [sent(0), sent(1)].map(
      (body) => (body.reports as { id: string; count: number }[])[0]!
    )
    expect(first!.count).toBe(1)
    expect(second!.count).toBe(2)
    expect(second!.id).not.toBe(first!.id)
  })

  it('das falhas tratadas, guarda só as que parecem defeito do código', () => {
    const { service } = setup()
    service.captureUnexpected(new Error('Paciente não encontrado'))
    service.captureUnexpected(
      Object.assign(new Error('Senha incorreta.'), { name: 'WrongSecretError' })
    )
    service.captureUnexpected(Object.assign(new Error('nome inválido'), { name: 'ZodError' }))
    service.captureUnexpected(new TypeError('x is not a function'))
    service.captureUnexpected(
      Object.assign(new Error('database disk image is malformed'), {
        name: 'SqliteError',
        code: 'SQLITE_CORRUPT'
      })
    )
    service.captureUnexpected(Object.assign(new Error('no space left'), { code: 'ENOSPC' }))
    expect(service.text()).not.toContain('Paciente')
    expect(service.info().count).toBe(3)
  })

  it('sem internet ou com o servidor fora, fica na fila; recusado, não tenta de novo', async () => {
    let response = (): Promise<Response> => Promise.reject(new TypeError('fetch failed'))
    const { service, fetch, saved } = setup({ response: () => response() })
    service.capture('main', crash())
    await service.flush()
    expect(saved().reports[0]!.pending).toBe(true)
    response = () => Promise.resolve(new Response(null, { status: 503 }))
    await service.flush()
    expect(saved().reports[0]!.pending).toBe(true)
    response = () => Promise.resolve(new Response(null, { status: 400 }))
    await service.flush()
    expect(saved().reports[0]!.pending).toBe(false)
    await service.flush()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('o que não saiu antes de fechar sai na próxima abertura, com o mesmo ID', async () => {
    const first = setup({ response: () => Promise.reject(new TypeError('fetch failed')) })
    first.service.capture('main', crash())
    await first.service.flush()
    first.service.close()
    const second = setup({ file: first.file })
    await second.service.flush()
    expect(second.sent().reports).toHaveLength(1)
    expect(second.sent().installId).toBe(first.sent().installId)
  })

  it(`manda no máximo ${BATCH} por vez e guarda só as ${MAX_REPORTS} mais recentes`, async () => {
    const { service, fetch, sent, saved, scheduled } = setup()
    for (let i = 0; i < MAX_REPORTS + 5; i++) service.capture('main', crash(`Erro${i}`))
    expect(saved().reports).toHaveLength(MAX_REPORTS)
    await service.flush()
    expect(sent().reports).toHaveLength(BATCH)
    expect((sent().reports as { name: string }[])[0]!.name).toBe('Erro5')
    expect(scheduled.at(-1)!.ms).toBe(SEND_DELAY_MS)
    await service.flush()
    await service.flush()
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(saved().reports.every((report) => !report.pending)).toBe(true)
  })

  it('desligado, guarda só no computador e nada sai, nem depois de ligar de novo', async () => {
    const { service, fetch, saved, sent } = setup()
    service.capture('main', crash('TypeError'))
    expect(service.setEnabled(false)).toEqual({ enabled: false, count: 1 })
    service.capture('main', crash('RangeError'))
    await service.flush()
    expect(fetch).not.toHaveBeenCalled()
    expect(saved()).toMatchObject({
      enabled: false,
      reports: [{ pending: false }, { pending: false }]
    })
    service.setEnabled(true)
    await service.flush()
    expect(fetch).not.toHaveBeenCalled()
    service.capture('main', crash('ReferenceError'))
    await service.flush()
    expect((sent().reports as { name: string }[]).map((r) => r.name)).toEqual(['ReferenceError'])
  })

  it('desligado, a mesma falha repetida não toma o lugar das outras', () => {
    const { service, saved } = setup()
    service.setEnabled(false)
    service.capture('main', crash('RangeError'))
    for (let i = 0; i < MAX_REPORTS + 5; i++) service.capture('main', crash())
    service.close()
    expect(saved().reports.map((report) => report.count)).toEqual([1, MAX_REPORTS + 5])
  })

  it('sem endereço (desenvolvimento) nada sai e nada é agendado', async () => {
    const { service, fetch, scheduled, saved } = setup({ endpoint: null })
    service.capture('main', crash())
    await service.flush()
    expect(fetch).not.toHaveBeenCalled()
    expect(scheduled).toEqual([])
    expect(saved().reports).toHaveLength(1)
  })

  it('arquivo corrompido vale como vazio, com o envio ligado', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'auri-erros-')), 'erros.json')
    writeFileSync(file, '{')
    expect(setup({ file }).service.info()).toEqual({ enabled: true, count: 0 })
  })

  it('o texto para o suporte traz a versão e as falhas, da mais nova para a mais antiga', () => {
    const { service } = setup()
    service.capture('main', crash('TypeError'))
    service.capture('main', crash('TypeError'))
    service.record('process', { name: 'render-process-gone', message: 'crashed (5)', stack: null })
    expect(service.text()).toBe(
      [
        'Auri 1.2.3 (latest) · darwin arm64 25.0.0',
        '2026-10-19T13:00:00.000Z · process · render-process-gone\ncrashed (5)',
        `2026-10-19T13:00:00.000Z · main · TypeError (2x)\nx\n${cleanStack(MAC_STACK, '/Users/maria')}`
      ].join('\n\n')
    )
  })
})

describe('contrato com a função (web/contrato/relatorio-de-erro.json)', () => {
  const { lengths } = contract

  function expectWithinContract(body: Record<string, unknown>, raw: string): void {
    expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(contract.maxBytes)
    expect(contract.platforms).toContain(body.platform)
    for (const key of ['version', 'channel', 'arch', 'osVersion', 'electron'] as const)
      expect((body[key] as string).length).toBeLessThanOrEqual(lengths[key])
    const reports = body.reports as Record<string, unknown>[]
    expect(reports.length).toBeGreaterThan(0)
    expect(reports.length).toBeLessThanOrEqual(contract.reportsPerSend)
    for (const report of reports) {
      expect(contract.origins).toContain(report.origin)
      expect((report.name as string).length).toBeLessThanOrEqual(lengths.name)
      expect(((report.message as string | null) ?? '').length).toBeLessThanOrEqual(lengths.message)
      expect(((report.stack as string | null) ?? '').length).toBeLessThanOrEqual(lengths.stack)
      expect(report.count).toBeGreaterThanOrEqual(1)
      expect(report.count).toBeLessThanOrEqual(contract.maxCount)
    }
  }

  it('o pior caso cabe no que a função aceita, dividido em mais envios', async () => {
    const { service, fetch, saved } = setup()
    const stack = `Error\n${`    at ${'f'.repeat(1000)} (x.js:1:1)\n`.repeat(40)}`
    for (let i = 0; i < 25; i++) {
      service.capture('renderer', {
        name: `TypeError${i}${'x'.repeat(500)}`,
        message: 'y'.repeat(1000),
        stack
      })
      service.record('process', {
        name: `child-process-gone ${i}: ${'z'.repeat(500)}`,
        message: 'w'.repeat(1000),
        stack: 's'.repeat(10_000)
      })
    }
    expect(saved().reports).toHaveLength(MAX_REPORTS)
    for (let i = 0; i < 10 && saved().reports.some((report) => report.pending); i++)
      await service.flush()
    expect(saved().reports.every((report) => !report.pending)).toBe(true)
    expect(fetch.mock.calls.length).toBeGreaterThan(Math.ceil(MAX_REPORTS / BATCH))
    for (const [, init] of fetch.mock.calls) {
      const raw = init!.body as string
      expectWithinContract(JSON.parse(raw) as Record<string, unknown>, raw)
    }
  })

  it(`a contagem para em ${contract.maxCount}, para a falha mais repetida não ser recusada`, async () => {
    const first = setup({ response: () => Promise.reject(new TypeError('fetch failed')) })
    first.service.capture('main', crash())
    const stored = JSON.parse(readFileSync(first.file, 'utf8'))
    stored.reports[0].count = contract.maxCount
    writeFileSync(first.file, JSON.stringify(stored))
    const second = setup({ file: first.file })
    second.service.capture('main', crash())
    await second.service.flush()
    const raw = second.fetch.mock.calls[0]![1]!.body as string
    expect((JSON.parse(raw).reports as { count: number }[])[0]!.count).toBe(contract.maxCount)
    expectWithinContract(JSON.parse(raw) as Record<string, unknown>, raw)
  })
})
