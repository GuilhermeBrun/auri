import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'
import handler, { connect, receive, Rejected, saveTo, type Payload } from '../api/erros.ts'
import contract from '../contrato/relatorio-de-erro.json' with { type: 'json' }
import { loadMigrations, migrate } from '../db/migrar.ts'

const payload: Payload = {
  installId: '0b5c5f2e-8d3f-4a43-9a51-2f1a0f6b8c11',
  version: '1.2.3',
  channel: 'latest',
  platform: 'darwin',
  arch: 'arm64',
  osVersion: '25.0.0',
  electron: '44.9.0',
  reports: [
    {
      id: '6f1d2a8e-3b5c-4e7f-8a9b-0c1d2e3f4a5b',
      at: '2026-10-19T13:00:00.000Z',
      origin: 'renderer',
      name: 'TypeError',
      message: "Cannot read properties of undefined (reading 'nome')",
      stack: 'at render (app.asar/out/renderer/assets/index-abc.js:12:345)',
      count: 2
    }
  ]
}

const post = (body: string, headers: Record<string, string> = {}): Request =>
  new Request('https://erros.auri.dev.br/api/erros', { method: 'POST', body, headers })

const NOW = new Date('2026-10-19T13:05:00.000Z')

describe('/api/erros', () => {
  it('grava o envio conferido, com a hora em que chegou', async () => {
    const save = vi.fn(() => Promise.resolve())
    const response = await receive(post(JSON.stringify(payload)), save, NOW)
    expect(response.status).toBe(204)
    expect(save).toHaveBeenCalledExactlyOnceWith(payload, NOW)
  })

  it('recusa o que não é um relatório do Auri', async () => {
    const save = vi.fn(() => Promise.resolve())
    const cases = [
      'não é json',
      JSON.stringify({ ...payload, reports: [] }),
      JSON.stringify({ ...payload, installId: 'x' }),
      JSON.stringify({ ...payload, reports: Array(21).fill(payload.reports[0]) }),
      JSON.stringify({ ...payload, reports: [{ ...payload.reports[0], stack: 'x'.repeat(5001) }] })
    ]
    for (const body of cases) expect((await receive(post(body), save, NOW)).status).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })

  it('recusa envios grandes e outros métodos', async () => {
    const save = vi.fn(() => Promise.resolve())
    expect((await receive(post('x'.repeat(70_000)), save)).status).toBe(413)
    expect((await receive(post('{}', { 'content-length': '999999' }), save)).status).toBe(413)
    const get = await receive(new Request('https://erros.auri.dev.br/api/erros'), save)
    expect(get.status).toBe(405)
    expect(save).not.toHaveBeenCalled()
  })

  it('aceita no limite do contrato e recusa um acima (web/contrato/relatorio-de-erro.json)', async () => {
    const { lengths } = contract
    const save = vi.fn(() => Promise.resolve())
    const report = payload.reports[0]!
    const atLimit = {
      ...report,
      name: 'n'.repeat(lengths.name),
      message: 'm'.repeat(lengths.message),
      stack: 's'.repeat(lengths.stack),
      count: contract.maxCount
    }
    const send = (value: unknown) => receive(post(JSON.stringify(value)), save, NOW)
    expect((await send({ ...payload, reports: [atLimit] })).status).toBe(204)
    for (const field of ['name', 'message', 'stack'] as const)
      expect(
        (
          await send({
            ...payload,
            reports: [{ ...atLimit, [field]: 'x'.repeat(lengths[field] + 1) }]
          })
        ).status
      ).toBe(400)
    expect(
      (await send({ ...payload, reports: [{ ...atLimit, count: contract.maxCount + 1 }] })).status
    ).toBe(400)
    const many = (n: number) =>
      Array.from({ length: n }, () => ({ ...report, id: crypto.randomUUID() }))
    expect((await send({ ...payload, reports: many(contract.reportsPerSend) })).status).toBe(204)
    expect((await send({ ...payload, reports: many(contract.reportsPerSend + 1) })).status).toBe(
      400
    )
    for (const platform of contract.platforms)
      expect((await send({ ...payload, platform })).status).toBe(204)
    for (const origin of contract.origins)
      expect((await send({ ...payload, reports: [{ ...report, origin }] })).status).toBe(204)
    expect((await send({ ...payload, platform: 'freebsd' })).status).toBe(400)
  })

  it('tira o caractere nulo, que o Postgres não aceita em texto', async () => {
    const save = vi.fn(() => Promise.resolve())
    const report = payload.reports[0]!
    const dirty = { ...payload, reports: [{ ...report, message: 'a\u0000b' }] }
    expect((await receive(post(JSON.stringify(dirty)), save, NOW)).status).toBe(204)
    expect(save).toHaveBeenCalledExactlyOnceWith(
      { ...payload, reports: [{ ...report, message: 'ab' }] },
      NOW
    )
  })

  it('para de ler um corpo grande mesmo sem content-length', async () => {
    const save = vi.fn(() => Promise.resolve())
    const chunk = new TextEncoder().encode('x'.repeat(10_000))
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        if (pulls > 100) controller.close()
        else controller.enqueue(chunk)
      }
    })
    const request = new Request('https://erros.auri.dev.br/api/erros', {
      method: 'POST',
      body,
      duplex: 'half'
    })
    expect((await receive(request, save)).status).toBe(413)
    expect(pulls).toBeLessThan(10)
    expect(save).not.toHaveBeenCalled()
  })

  it('recusado pelo banco por causa do dado, responde 400 para o app não repetir', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const save = vi.fn(() => Promise.reject(new Rejected('invalid byte sequence')))
    expect((await receive(post(JSON.stringify(payload)), save, NOW)).status).toBe(400)
  })

  it('sem banco configurado, ou com endereço inválido, responde 503', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const body = JSON.stringify(payload)
    expect((await handler.fetch(post(body), { DATABASE_URL: '' })).status).toBe(503)
    expect((await handler.fetch(post(body), { DATABASE_URL: 'não é endereço' })).status).toBe(503)
  })

  it('com o banco fora do ar responde 503, para o app tentar de novo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const save = vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED')))
    expect((await receive(post(JSON.stringify(payload)), save, NOW)).status).toBe(503)
  })
})

const url = process.env.TEST_DATABASE_URL
describe('migrações', () => {
  it('vêm em ordem, numeradas, a partir da 001', () => {
    const versions = loadMigrations().map((m) => m.version)
    expect(versions[0]).toBe('001_relatorios_de_erro')
    expect(versions).toEqual(versions.toSorted())
    for (const [index, version] of versions.entries())
      expect(version.slice(0, 3)).toBe(String(index + 1).padStart(3, '0'))
  })
})

describe('conexão com o banco', () => {
  it('aceita o endereço do Neon com channel_binding e sempre confere o certificado', async () => {
    const sql = connect(
      'postgres://dono:senha@ep-x-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
    )
    expect(sql.options.connection).not.toHaveProperty('channel_binding')
    expect(sql.options.ssl).toBe('verify-full')
    await sql.end()
  })
})

describe.skipIf(!url)('tabela error_reports', () => {
  const admin = postgres(url ?? '', { max: 1, onnotice: () => {} })
  const target = new URL(url ?? 'postgres://localhost')
  target.username = 'erros_teste'
  target.password = 'teste'
  const writer = postgres(target.toString(), { max: 1 })

  beforeAll(async () => {
    await admin`DROP TABLE IF EXISTS error_reports`
    await admin`DROP TABLE IF EXISTS schema_migrations`
    expect(await migrate(admin)).toEqual(loadMigrations().map((m) => m.version))
    expect(await migrate(admin)).toEqual([])
    await admin.unsafe('DROP ROLE IF EXISTS erros_teste')
    await admin.unsafe("CREATE ROLE erros_teste LOGIN PASSWORD 'teste' IN ROLE erros_gravacao")
    await admin`CREATE TABLE IF NOT EXISTS segredo (valor text)`
  })
  afterAll(async () => {
    await writer.end()
    await admin`DROP TABLE IF EXISTS error_reports`
    await admin`DROP TABLE IF EXISTS segredo`
    await admin`DROP TABLE IF EXISTS schema_migrations`
    await admin.unsafe('DROP ROLE IF EXISTS erros_teste')
    await admin.end()
  })

  it('registra cada migração uma vez e recusa uma migração editada depois de aplicada', async () => {
    const versions = await admin`SELECT version FROM schema_migrations ORDER BY version`
    expect(versions.map((row) => row.version)).toEqual(loadMigrations().map((m) => m.version))
    const [first] = loadMigrations()
    await expect(migrate(admin, [{ ...first!, sql: `${first!.sql}\nSELECT 1;` }])).rejects.toThrow(
      /mudou depois de aplicada/
    )
    await expect(
      migrate(admin, [
        ...loadMigrations(),
        { version: '999_quebrada', sql: 'SELECT * FROM nao_existe' }
      ])
    ).rejects.toThrow()
    expect(
      await admin`SELECT 1 FROM schema_migrations WHERE version = '999_quebrada'`
    ).toHaveLength(0)
  })

  it('grava uma linha por falha e ignora o mesmo envio repetido', async () => {
    const save = saveTo(writer)
    const second = { ...payload.reports[0]!, id: '7a2e3b9f-4c6d-4f80-9bac-1d2e3f4a5b6c', count: 1 }
    const received = new Date()
    await save({ ...payload, reports: [payload.reports[0]!, second] }, received)
    await save(payload, new Date(received.getTime() + 60_000))
    const rows = await admin`SELECT * FROM error_reports ORDER BY count DESC`
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: payload.reports[0]!.id,
      install_id: payload.installId,
      happened_at: new Date(payload.reports[0]!.at),
      received_at: received,
      origin: 'renderer',
      name: 'TypeError',
      message: payload.reports[0]!.message,
      count: 2,
      version: '1.2.3',
      os_version: '25.0.0'
    })
  })

  const fresh = () => ({ ...payload.reports[0]!, id: crypto.randomUUID() })

  const oldRows = (count: number, age: string) => admin`
    INSERT INTO error_reports
      (id, install_id, happened_at, received_at, origin, name, count,
       version, channel, platform, arch, os_version, electron)
    SELECT gen_random_uuid(), gen_random_uuid(), now(), now() - ${age}::interval,
      'main', 'TypeError', 1, '1.0.0', 'latest', 'darwin', 'arm64', '25.0.0', '44.0.0'
    FROM generate_series(1, ${count})`

  it('apaga sozinho o que chegou há mais de 90 dias', async () => {
    await admin`DELETE FROM error_reports`
    await oldRows(3, '100 days')
    await oldRows(1, '80 days')
    await saveTo(writer)({ ...payload, reports: [fresh()] }, new Date())
    const [{ total }] = await admin`SELECT count(*)::int AS total FROM error_reports`
    expect(total).toBe(2)
  })

  it('para de gravar depois de 1000 falhas no dia, e o app guarda para depois', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await admin`DELETE FROM error_reports`
    await oldRows(1000, '1 hour')
    const save = saveTo(writer)
    await expect(save({ ...payload, reports: [fresh()] }, new Date())).rejects.toMatchObject({
      code: '53400'
    })
    const body = JSON.stringify({ ...payload, reports: [fresh()] })
    expect((await receive(post(body), save)).status).toBe(503)
  })

  it('o que o banco recusa pelo conteúdo vira Rejected', async () => {
    await admin`DELETE FROM error_reports`
    const report = { ...fresh(), message: 'a\u0000b' }
    await expect(
      saveTo(writer)({ ...payload, reports: [report] }, new Date())
    ).rejects.toBeInstanceOf(Rejected)
  })

  it('o usuário da função não lê, não muda, não apaga e não vê outras tabelas', async () => {
    const denied = /permission denied/
    await expect(writer`SELECT * FROM error_reports`).rejects.toThrow(denied)
    await expect(writer`UPDATE error_reports SET count = 0`).rejects.toThrow(denied)
    await expect(writer`DELETE FROM error_reports`).rejects.toThrow(denied)
    await expect(writer`SELECT * FROM segredo`).rejects.toThrow(denied)
    await expect(writer`DROP TABLE error_reports`).rejects.toThrow(/must be owner/)
    await expect(writer`CREATE TABLE outra (x int)`).rejects.toThrow(denied)
  })
})
