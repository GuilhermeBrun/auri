import SecretStream from '@hyperswarm/secret-stream'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import type { DataTopic } from '../../shared/api'
import { emptyPatientInput } from '../../shared/schemas'
import { openDatabase, type Db } from '../db/connection'
import { SCHEMA_VERSION } from '../db/migrations'
import { runOperation } from '../operations'
import { createSyncClient, pairWithServer, type ClientStatus } from './client'
import {
  createPairingCodes,
  formatCode,
  MAX_ATTEMPTS,
  normalizeCode,
  pairingProof,
  CODE_TTL_MS
} from './pairing'
import { createSyncServer } from './server'

// Somente dados fictícios. Servidor e cliente no mesmo processo, por TCP local, com a mesma
// criptografia de produção.

function until(condition: () => boolean, ms = 5_000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (condition()) resolve()
      else if (Date.now() - start > ms) reject(new Error('tempo esgotado'))
      else setTimeout(tick, 10)
    }
    tick()
  })
}

describe('código de pareamento', () => {
  it('aceita o código digitado de qualquer jeito', () => {
    expect(formatCode('K7Q29XMP3HTA')).toBe('K7Q2 9XMP 3HTA')
    expect(normalizeCode('k7q2-9xmp 3hta')).toBe('K7Q29XMP3HTA')
    expect(normalizeCode('OIL')).toBe('011')
  })

  it('confere a prova uma vez só', () => {
    const codes = createPairingCodes()
    const { code } = codes.issue()
    const hash = Buffer.alloc(32, 7)
    expect(codes.check(pairingProof(code, 'client', hash), hash)).toEqual({ ok: true, code })
    expect(codes.check(pairingProof(code, 'client', hash), hash)).toEqual({
      ok: false,
      reason: 'none'
    })
  })

  it('recusa prova de outra conexão, do lado errado ou com código errado', () => {
    const codes = createPairingCodes()
    const { code } = codes.issue()
    const hash = Buffer.alloc(32, 7)
    const other = Buffer.alloc(32, 8)
    expect(codes.check(pairingProof(code, 'client', other), hash).ok).toBe(false)
    expect(codes.check(pairingProof(code, 'server', hash), hash).ok).toBe(false)
    expect(codes.check(pairingProof('0000 0000 0000', 'client', hash), hash).ok).toBe(false)
    expect(codes.check(pairingProof(code, 'client', hash), hash).ok).toBe(true)
  })

  it(`descarta o código depois de ${MAX_ATTEMPTS} erros`, () => {
    const codes = createPairingCodes()
    const { code } = codes.issue()
    const hash = Buffer.alloc(32, 7)
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(codes.check(pairingProof('X', 'client', hash), hash)).toEqual({
        ok: false,
        reason: 'wrong'
      })
    }
    expect(codes.check(pairingProof(code, 'client', hash), hash).ok).toBe(false)
  })

  it('vence', () => {
    let now = 0
    const codes = createPairingCodes(() => now)
    const { code } = codes.issue()
    now = CODE_TTL_MS + 1
    const hash = Buffer.alloc(32, 7)
    expect(codes.check(pairingProof(code, 'client', hash), hash)).toEqual({
      ok: false,
      reason: 'expired'
    })
  })
})

describe('servidor e cliente', () => {
  let db: Db
  let paired: Map<string, string>
  let presence: string[]
  let codes: ReturnType<typeof createPairingCodes>
  let server: ReturnType<typeof createSyncServer>
  let port: number
  const serverKeys = SecretStream.keyPair()
  const clientKeys = SecretStream.keyPair()
  const closers: (() => void)[] = []

  beforeEach(async () => {
    db = openDatabase(':memory:')
    paired = new Map()
    presence = []
    codes = createPairingCodes()
    server = createSyncServer({
      keyPair: serverKeys,
      name: () => 'Recepção',
      schemaVersion: SCHEMA_VERSION,
      isPaired: (key) => paired.has(key),
      codes,
      onPaired: ({ publicKey, name }) => paired.set(publicKey, name),
      onPresence: (key, online) => presence.push(`${online ? '+' : '-'}${paired.get(key)}`),
      handle: (channel, args) =>
        runOperation(db, channel, args, (topics) => server.broadcast(topics))
    })
    port = await server.listen({ host: '127.0.0.1', port: 0 })
  })

  afterEach(async () => {
    for (const close of closers.splice(0)) close()
    await server.close()
    db.close()
  })

  function pair(code: string, keyPair = clientKeys): Promise<{ publicKey: string; name: string }> {
    return pairWithServer({
      keyPair,
      name: 'Consultório',
      schemaVersion: SCHEMA_VERSION,
      address: { host: '127.0.0.1', port },
      code
    })
  }

  function connect(options: { schemaVersion?: number; keyPair?: typeof clientKeys } = {}): {
    client: ReturnType<typeof createSyncClient>
    statuses: ClientStatus[]
    events: DataTopic[][]
  } {
    const statuses: ClientStatus[] = []
    const events: DataTopic[][] = []
    const client = createSyncClient({
      keyPair: options.keyPair ?? clientKeys,
      name: () => 'Consultório',
      schemaVersion: options.schemaVersion ?? SCHEMA_VERSION,
      serverKey: serverKeys.publicKey.toString('hex'),
      serverName: 'Recepção',
      addresses: async () => [{ host: '127.0.0.1', port }],
      onStatus: (status) => statuses.push(status),
      onEvent: (topics) => events.push(topics)
    })
    closers.push(() => client.close())
    return { client, statuses, events }
  }

  it('pareia com o código e depois usa os dados do servidor', async () => {
    const { code } = codes.issue()
    const result = await pair(formatCode(code).toLowerCase())
    expect(result).toEqual({ publicKey: serverKeys.publicKey.toString('hex'), name: 'Recepção' })
    expect(paired.get(clientKeys.publicKey.toString('hex'))).toBe('Consultório')

    const { client, events } = connect()
    const created = await client.request('patients:create', [
      { ...emptyPatientInput(), nome: 'Paciente Fictício' }
    ])
    expect(created.ok).toBe(true)
    const list = await client.request('patients:list', [undefined])
    expect(list).toMatchObject({ ok: true, data: [{ nome: 'Paciente Fictício' }] })
    await until(() => events.length > 0)
    expect(events[0]).toEqual(['patients'])
    // a conexão do pareamento entra e sai; a de uso fica
    expect(presence.at(-1)).toBe('+Consultório')
  })

  it('recusa código errado e computador não pareado', async () => {
    codes.issue()
    await expect(pair('0000 0000 0000')).rejects.toThrow('Código incorreto')

    const { client, statuses } = connect()
    await until(() => statuses.includes('revoked'))
    expect(await client.request('patients:list', [])).toEqual({
      ok: false,
      error: 'Este computador foi desconectado de Recepção.'
    })
  })

  it('recusa versão diferente antes de qualquer leitura', async () => {
    paired.set(clientKeys.publicKey.toString('hex'), 'Consultório')
    const { client, statuses } = connect({ schemaVersion: SCHEMA_VERSION + 1 })
    await until(() => statuses.includes('version'))
    expect((await client.request('patients:list', [])).ok).toBe(false)
  })

  it('valida e aplica as regras do banco pelo caminho da rede', async () => {
    paired.set(clientKeys.publicKey.toString('hex'), 'Consultório')
    const { client } = connect()
    expect(await client.request('patients:create', [{ nome: '' }])).toEqual({
      ok: false,
      error: 'Informe o nome do paciente'
    })
    expect(await client.request('db:drop', [])).toEqual({
      ok: false,
      error: 'Operação desconhecida'
    })
  })

  it('recusa salvar o que foi alterado em outro computador', async () => {
    paired.set(clientKeys.publicKey.toString('hex'), 'Consultório')
    const { client } = connect()
    const input = { ...emptyPatientInput(), nome: 'Ana Exemplo' }
    const created = await client.request('patients:create', [input])
    const opened = (created as { data: { id: number; updated_at: string } }).data
    await new Promise((r) => setTimeout(r, 5))
    runOperation(db, 'patients:update', [opened.id, { ...input, escola: 'Escola X' }])

    const stale = await client.request('patients:update', [
      opened.id,
      { ...input, escola: 'Escola Y' },
      opened.updated_at
    ])
    expect(stale).toMatchObject({ ok: false, error: expect.stringContaining('outro computador') })
  })

  it('remover derruba a conexão aberta e impede a volta', async () => {
    const key = clientKeys.publicKey.toString('hex')
    paired.set(key, 'Consultório')
    const { client, statuses } = connect()
    await until(() => statuses.includes('connected'))

    paired.delete(key)
    server.disconnect(key)
    await until(() => statuses.includes('revoked'))
    expect((await client.request('patients:list', [])).ok).toBe(false)
  })

  it('conexão caída: o pedido falha, sem repetir, e o cliente se reconecta', async () => {
    paired.set(clientKeys.publicKey.toString('hex'), 'Consultório')
    const { client, statuses } = connect()
    await until(() => statuses.includes('connected'))

    server.disconnect(clientKeys.publicKey.toString('hex'))
    await until(() => statuses.includes('offline'))
    await until(() => statuses.lastIndexOf('connected') > statuses.indexOf('offline'))
    expect((await client.request('patients:list', [])).ok).toBe(true)
  })

  it('não conversa com outro servidor no mesmo endereço', async () => {
    const impostor = SecretStream.keyPair()
    const statuses: ClientStatus[] = []
    const client = createSyncClient({
      keyPair: clientKeys,
      name: () => 'Consultório',
      schemaVersion: SCHEMA_VERSION,
      serverKey: impostor.publicKey.toString('hex'),
      serverName: 'Recepção',
      addresses: async () => [{ host: '127.0.0.1', port }],
      onStatus: (status) => statuses.push(status),
      onEvent: () => {}
    })
    closers.push(() => client.close())
    await until(() => statuses.includes('offline'))
    expect(presence).toEqual([])
  })
})
