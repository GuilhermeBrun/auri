import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'
import { Rejected } from '../api/erros.ts'
import handler, { atender, linksEm, type Links } from '../api/links.ts'
import contrato from '../contrato/link-curto.json' with { type: 'json' }
import { loadMigrations, migrate } from '../db/migrar.ts'

const ID = 'a'.repeat(contrato.tamanhoDoId)
const AGORA = new Date('2026-10-21T13:00:00.000Z')
const AGORA_S = AGORA.getTime() / 1000
const DADOS = '1.AAAAAAAAAAAAAAAAAAAAAA.cifrado_em-base64url'

const endereco = (id = ID): string => `https://auri.dev.br/api/links?id=${id}`

const put = (corpo: unknown, id = ID): Request =>
  new Request(endereco(id), {
    method: 'PUT',
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' }
  })

function memoria(): Links & { guardados: Map<string, { dados: string; expira: Date }> } {
  const guardados = new Map<string, { dados: string; expira: Date }>()
  return {
    guardados,
    guardar: vi.fn(async (id: string, dados: string, expira: Date) => {
      if (!guardados.has(id)) guardados.set(id, { dados, expira })
    }),
    buscar: vi.fn(async (id: string, agora: Date) => {
      const guardado = guardados.get(id)
      return guardado && guardado.expira > agora ? guardado.dados : null
    })
  }
}

describe('/api/links', () => {
  it('guarda o que está cifrado e devolve igual, sem cache', async () => {
    const links = memoria()
    const gravou = await atender(put({ dados: DADOS, expira: AGORA_S + 3600 }), links, AGORA)
    expect(gravou.status).toBe(204)
    const lido = await atender(new Request(endereco()), links, AGORA)
    expect(lido.status).toBe(200)
    expect(lido.headers.get('cache-control')).toBe('no-store')
    expect(await lido.text()).toBe(DADOS)
  })

  it('o primeiro a gravar fica; vencido ou inexistente responde 404', async () => {
    const links = memoria()
    await atender(put({ dados: DADOS, expira: AGORA_S + 60 }), links, AGORA)
    await atender(put({ dados: 'outro', expira: AGORA_S + 60 }), links, AGORA)
    expect(await (await atender(new Request(endereco()), links, AGORA)).text()).toBe(DADOS)
    const depois = new Date(AGORA.getTime() + 61_000)
    expect((await atender(new Request(endereco()), links, depois)).status).toBe(404)
    const outro = 'b'.repeat(contrato.tamanhoDoId)
    expect((await atender(new Request(endereco(outro)), links, AGORA)).status).toBe(404)
  })

  it('recusa id, dados e prazos fora do contrato', async () => {
    const links = memoria()
    const casos: Request[] = [
      put({ dados: DADOS, expira: AGORA_S + 60 }, 'curto'),
      put({ dados: DADOS, expira: AGORA_S + 60 }, `${'a'.repeat(42)}!`),
      put('não é json'),
      put({ dados: 'com espaço', expira: AGORA_S + 60 }),
      put({ dados: '', expira: AGORA_S + 60 }),
      put({ dados: 'x'.repeat(contrato.maximoGuardado + 1), expira: AGORA_S + 60 }),
      put({ dados: DADOS, expira: AGORA_S }),
      put({ dados: DADOS, expira: AGORA_S + contrato.vidaMaximaS + 1 }),
      put({ dados: DADOS, expira: 1.5 }),
      new Request(endereco('x'))
    ]
    for (const pedido of casos) {
      const resposta = await atender(pedido, links, AGORA)
      expect([400, 413]).toContain(resposta.status)
    }
    expect(links.guardar).not.toHaveBeenCalled()
  })

  it('aceita no limite do contrato', async () => {
    const links = memoria()
    const dados = 'x'.repeat(contrato.maximoGuardado)
    const expira = AGORA_S + contrato.vidaMaximaS
    expect((await atender(put({ dados, expira }), links, AGORA)).status).toBe(204)
  })

  it('recusa outros métodos e corpos grandes', async () => {
    const links = memoria()
    const post = new Request(endereco(), { method: 'POST', body: '{}' })
    const resposta = await atender(post, links, AGORA)
    expect(resposta.status).toBe(405)
    expect(resposta.headers.get('allow')).toBe('GET, PUT')
    const grande = new Request(endereco(), { method: 'PUT', body: 'x'.repeat(10_000) })
    expect((await atender(grande, links, AGORA)).status).toBe(413)
  })

  it('banco fora do ar responde 503; dado recusado pelo banco, 400', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fora: Links = {
      guardar: () => Promise.reject(new Error('connect ECONNREFUSED')),
      buscar: () => Promise.reject(new Error('connect ECONNREFUSED'))
    }
    expect((await atender(put({ dados: DADOS, expira: AGORA_S + 60 }), fora, AGORA)).status).toBe(
      503
    )
    expect((await atender(new Request(endereco()), fora, AGORA)).status).toBe(503)
    const recusa: Links = { ...fora, guardar: () => Promise.reject(new Rejected('check')) }
    expect((await atender(put({ dados: DADOS, expira: AGORA_S + 60 }), recusa, AGORA)).status).toBe(
      400
    )
  })

  it('sem banco configurado responde 503', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await handler.fetch(new Request(endereco()), { DATABASE_URL: '' })).status).toBe(503)
  })
})

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('tabela links', () => {
  const admin = postgres(url ?? '', { max: 1, onnotice: () => {} })
  const alvo = new URL(url ?? 'postgres://localhost')
  alvo.username = 'links_teste'
  alvo.password = 'teste'
  const funcao = postgres(alvo.toString(), { max: 1 })

  beforeAll(async () => {
    await admin`DROP TABLE IF EXISTS links`
    await admin`DROP TABLE IF EXISTS error_reports`
    await admin`DROP TABLE IF EXISTS schema_migrations`
    expect(await migrate(admin)).toEqual(loadMigrations().map((m) => m.version))
    await admin.unsafe('DROP ROLE IF EXISTS links_teste')
    await admin.unsafe("CREATE ROLE links_teste LOGIN PASSWORD 'teste' IN ROLE erros_gravacao")
  })
  afterAll(async () => {
    await funcao.end()
    await admin`DROP TABLE IF EXISTS links`
    await admin`DROP TABLE IF EXISTS error_reports`
    await admin`DROP TABLE IF EXISTS schema_migrations`
    await admin.unsafe('DROP ROLE IF EXISTS links_teste')
    await admin.end()
  })

  it('o usuário da função grava e lê, mas não apaga nem lê outras tabelas', async () => {
    const links = linksEm(funcao)
    const agora = new Date()
    await links.guardar(ID, DADOS, new Date(agora.getTime() + 60_000))
    await links.guardar(ID, 'outro', new Date(agora.getTime() + 60_000))
    expect(await links.buscar(ID, agora)).toBe(DADOS)
    await expect(funcao`DELETE FROM links`).rejects.toThrow(/permission denied/)
    await expect(funcao`SELECT * FROM error_reports`).rejects.toThrow(/permission denied/)
  })

  it('o banco recusa dados fora do formato e apaga os vencidos ao gravar', async () => {
    const links = linksEm(funcao)
    const agora = new Date()
    await expect(
      links.guardar(
        'c'.repeat(contrato.tamanhoDoId),
        'com espaço',
        new Date(agora.getTime() + 1000)
      )
    ).rejects.toBeInstanceOf(Rejected)
    await admin`
      INSERT INTO links (id, dados, expira_em, criado_em)
      VALUES (${'d'.repeat(contrato.tamanhoDoId)}, 'velho', now() - interval '1 minute',
        now() - interval '2 days')
    `
    await links.guardar('e'.repeat(contrato.tamanhoDoId), DADOS, new Date(agora.getTime() + 1000))
    const [{ n }] = await admin<{ n: number }[]>`
      SELECT count(*)::int AS n FROM links WHERE id = ${'d'.repeat(contrato.tamanhoDoId)}
    `
    expect(n).toBe(0)
  })
})
