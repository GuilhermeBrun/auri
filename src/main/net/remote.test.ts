import SecretStream from '@hyperswarm/secret-stream'
import createTestnet from 'hyperdht/testnet'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import type { RemoteReach } from '../../shared/api'
import { emptyPatientInput } from '../../shared/schemas'
import { openDatabase, type Db } from '../db/connection'
import { SCHEMA_VERSION } from '../db/migrations'
import { runOperation } from '../operations'
import { createSyncClient, probeServer, type ClientStatus, type Route } from './client'
import { createPairingCodes } from './pairing'
import { createRemoteDialer, createRemoteListener, type Bootstrap } from './remote'
import { createSyncServer } from './server'

// Acesso de fora da clínica numa rede distribuída de teste (nós em 127.0.0.1, sem internet).
// Somente dados fictícios.

function until(condition: () => boolean, ms = 15_000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (condition()) resolve()
      else if (Date.now() - start > ms) reject(new Error('tempo esgotado'))
      else setTimeout(tick, 20)
    }
    tick()
  })
}

describe('acesso de fora da clínica', () => {
  let testnet: Awaited<ReturnType<typeof createTestnet>>
  let bootstrap: Bootstrap
  let db: Db
  let server: ReturnType<typeof createSyncServer>
  let listener: ReturnType<typeof createRemoteListener>
  const reach: RemoteReach[] = []
  const serverKeys = SecretStream.keyPair()
  const clientKeys = SecretStream.keyPair()
  const strangerKeys = SecretStream.keyPair()
  const paired = new Set([clientKeys.publicKey.toString('hex')])
  const dialers: ReturnType<typeof createRemoteDialer>[] = []

  beforeAll(async () => {
    testnet = await createTestnet(3)
    bootstrap = testnet.bootstrap
    db = openDatabase(':memory:')
    server = createSyncServer({
      keyPair: serverKeys,
      name: () => 'Recepção',
      schemaVersion: SCHEMA_VERSION,
      isPaired: (key) => paired.has(key),
      codes: createPairingCodes(),
      onPaired: () => {},
      onPresence: () => {},
      handle: (channel, args) =>
        runOperation(db, channel, args, (topics) => server.broadcast(topics))
    })
    listener = createRemoteListener({
      keyPair: serverKeys,
      isPaired: (key) => paired.has(key),
      attach: server.attach,
      onReach: (r) => reach.push(r),
      bootstrap
    })
    await until(() => reach.length > 0)
  }, 30_000)

  afterAll(async () => {
    for (const dialer of dialers) await dialer.close()
    await listener.close()
    await server.close()
    db.close()
    await testnet.destroy()
  })

  function dialer(keyPair: typeof clientKeys): ReturnType<typeof createRemoteDialer> {
    const d = createRemoteDialer({ keyPair, bootstrap })
    dialers.push(d)
    return d
  }

  it('fica disponível na rede distribuída', () => {
    expect(reach.at(-1)).not.toBe('offline')
  })

  it('o cliente conecta só pela internet e usa os dados', async () => {
    const statuses: ClientStatus[] = []
    const routes: Route[] = []
    const remote = dialer(clientKeys)
    const client = createSyncClient({
      keyPair: clientKeys,
      name: () => 'Consultório',
      schemaVersion: SCHEMA_VERSION,
      serverKey: serverKeys.publicKey.toString('hex'),
      serverName: 'Recepção',
      addresses: async () => [],
      dialRemote: () => remote.dial(serverKeys.publicKey.toString('hex')),
      onStatus: (status) => statuses.push(status),
      onEvent: () => {},
      onConnected: (route) => routes.push(route)
    })
    try {
      await until(() => statuses.includes('connected'))
      expect(client.via()).toBe('internet')
      expect(routes).toEqual([{ via: 'internet' }])
      const created = await client.request('patients:create', [
        { ...emptyPatientInput(), nome: 'Paciente Fictício' }
      ])
      expect(created.ok).toBe(true)
    } finally {
      client.close()
    }
  }, 30_000)

  it('o teste de acesso conecta, se apresenta e mede o tempo', async () => {
    const remote = dialer(clientKeys)
    const result = await probeServer({
      open: () => remote.dial(serverKeys.publicKey.toString('hex')),
      serverKey: serverKeys.publicKey.toString('hex'),
      serverName: 'Recepção',
      name: 'Consultório',
      schemaVersion: SCHEMA_VERSION
    })
    expect(result).toMatchObject({ ok: true })
  }, 30_000)

  it('barra quem não pareou antes de conectar', async () => {
    const remote = dialer(strangerKeys)
    const result = await probeServer({
      open: () => remote.dial(serverKeys.publicKey.toString('hex')),
      serverKey: serverKeys.publicKey.toString('hex'),
      serverName: 'Recepção',
      name: 'Estranho',
      schemaVersion: SCHEMA_VERSION
    })
    expect(result.ok).toBe(false)
  }, 40_000)
})
