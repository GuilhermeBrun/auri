import SecretStream from '@hyperswarm/secret-stream'
import createTestnet from 'hyperdht/testnet'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test'
import type { DeviceGrant, IpcResult } from '../../shared/api'
import { emptyPatientInput } from '../../shared/schemas'
import { openDatabase, type Db } from '../db/connection'
import { SCHEMA_VERSION } from '../db/migrations'
import { createPatient } from '../db/patients'
import { runOperation } from '../operations'
import {
  API_ATUAL,
  callAsDevice,
  NOT_ON_PHONE,
  PHONE_RECEPTION_BLOCKED,
  type DeviceRecord
} from './celular'
import { createSyncClient, pairWithServer, PairingError, type ClientStatus } from './client'
import { escreverConvite, lerConvite } from './convite'
import { createPairingCodes } from './pairing'
import type { HelloVersion } from './protocol'
import { createRemoteDialer, createRemoteListener, type Bootstrap } from './remote'
import { createSyncServer, type KeyPair } from './server'

function until(condition: () => boolean, ms = 20_000): Promise<void> {
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

describe('pareamento pela internet com código preso a tipo e nível', () => {
  let testnet: Awaited<ReturnType<typeof createTestnet>>
  let bootstrap: Bootstrap
  let db: Db
  let patientId: number
  let server: ReturnType<typeof createSyncServer>
  let listener: ReturnType<typeof createRemoteListener>
  const serverKeys = SecretStream.keyPair()
  const serverKey = serverKeys.publicKey.toString('hex')
  const devices = new Map<string, DeviceRecord>()
  const codes = createPairingCodes()
  const dialers: ReturnType<typeof createRemoteDialer>[] = []
  const closers: (() => void)[] = []

  beforeAll(async () => {
    testnet = await createTestnet(3)
    bootstrap = testnet.bootstrap
    db = openDatabase(':memory:')
    patientId = createPatient(db, {
      ...emptyPatientInput(),
      nome: 'Paciente Fictício',
      cpf: '000.000.000-00'
    }).id
    runOperation(db, 'appointments:create', [
      {
        patient_id: patientId,
        inicio: '2025-09-08T14:00',
        fim: '2025-09-08T14:45',
        observacao: '',
        evolucao: 'Evolução fictícia'
      }
    ])
    server = createSyncServer({
      keyPair: serverKeys,
      name: () => 'Recepção',
      schemaVersion: SCHEMA_VERSION,
      api: { min: API_ATUAL, max: API_ATUAL },
      device: (key) => devices.get(key) ?? null,
      codes,
      onPaired: ({ publicKey, name, ...grant }) =>
        devices.set(publicKey, {
          name,
          tipo: grant.tipo,
          nivel: grant.tipo === 'celular' ? grant.nivel : null
        }),
      onPresence: () => {},
      handle: (channel, args, peer) =>
        callAsDevice(
          (c, a): IpcResult<unknown> => runOperation(db, c, a),
          devices.get(peer.publicKey),
          peer,
          channel,
          args
        )
    })
    let alcance = ''
    listener = createRemoteListener({
      keyPair: serverKeys,
      isPaired: (key) => devices.has(key),
      codes,
      attach: server.attach,
      onReach: (reach) => (alcance = reach),
      bootstrap
    })
    await until(() => alcance !== '' && alcance !== 'starting', 30_000)
  }, 40_000)

  beforeEach(() => codes.cancel())

  afterAll(async () => {
    for (const close of closers.splice(0)) close()
    for (const dialer of dialers) await dialer.close()
    await listener.close()
    await server.close()
    db.close()
    await testnet.destroy()
  })

  function aparelho(): { keys: KeyPair; key: string; dial: () => SecretStream } {
    const keys = SecretStream.keyPair()
    const dialer = createRemoteDialer({ keyPair: keys, bootstrap })
    dialers.push(dialer)
    return { keys, key: keys.publicKey.toString('hex'), dial: () => dialer.dial(serverKey) }
  }

  function parear(
    quem: ReturnType<typeof aparelho>,
    version: HelloVersion,
    code: string
  ): Promise<{ publicKey: string; name: string }> {
    return pairWithServer({
      keyPair: quem.keys,
      name: 'iPhone da Recepção',
      version,
      code,
      open: quem.dial,
      serverKey,
      unreachable: 'Não foi possível conectar pela internet.'
    })
  }

  async function falha(promessa: Promise<unknown>): Promise<PairingError> {
    const erro = await promessa.then(
      () => null,
      (error: unknown) => error
    )
    expect(erro).toBeInstanceOf(PairingError)
    return erro as PairingError
  }

  function emitir(grant: DeviceGrant): string {
    const { code } = codes.issue(grant)
    const convite = lerConvite(escreverConvite({ chave: serverKey, codigo: code, enderecos: [] }))
    expect(convite).toEqual({ chave: serverKey, codigo: code, enderecos: [] })
    return code
  }

  it('sem código ativo, a rede distribuída barra quem não pareou', async () => {
    const estranho = aparelho()
    const erro = await falha(parear(estranho, { api: API_ATUAL }, 'ZZZZZZZZZZZZ'))
    expect(erro.reason).toBe('unreachable')
    expect(devices.has(estranho.key)).toBe(false)
  }, 30_000)

  it('código de computador recusa o celular, sem gastar o código', async () => {
    const telefone = aparelho()
    const code = emitir({ tipo: 'computador' })
    const erro = await falha(parear(telefone, { api: API_ATUAL }, code))
    expect(erro.reason).toBe('version')
    expect(erro.accepted).toBeNull()
    expect(codes.active()).toEqual({ tipo: 'computador' })
    expect(devices.has(telefone.key)).toBe(false)
  }, 30_000)

  it('código de celular recusa o computador', async () => {
    const consultorio = aparelho()
    const code = emitir({ tipo: 'celular', nivel: 'fono' })
    const erro = await falha(parear(consultorio, { schema: SCHEMA_VERSION }, code))
    expect(erro.reason).toBe('version')
    expect(devices.has(consultorio.key)).toBe(false)
  }, 30_000)

  it('app de outra versão é recusado com a faixa aceita, sem gastar o código', async () => {
    const telefone = aparelho()
    const code = emitir({ tipo: 'celular', nivel: 'fono' })
    const erro = await falha(parear(telefone, { api: API_ATUAL + 1 }, code))
    expect(erro.reason).toBe('version')
    expect(erro.accepted).toEqual({ min: API_ATUAL, max: API_ATUAL })
    expect(codes.active()).not.toBeNull()
  }, 30_000)

  it('o celular pareia pela internet e fica com o tipo e o nível do código', async () => {
    const telefone = aparelho()
    const code = emitir({ tipo: 'celular', nivel: 'recepcao' })
    expect(await parear(telefone, { api: API_ATUAL }, code)).toEqual({
      publicKey: serverKey,
      name: 'Recepção'
    })
    expect(devices.get(telefone.key)).toEqual({
      name: 'iPhone da Recepção',
      tipo: 'celular',
      nivel: 'recepcao'
    })
    expect(codes.active()).toBeNull()

    const statuses: ClientStatus[] = []
    const client = createSyncClient({
      keyPair: telefone.keys,
      name: () => 'iPhone da Recepção',
      version: { api: API_ATUAL },
      serverKey,
      serverName: 'Recepção',
      addresses: async () => [],
      dialRemote: telefone.dial,
      onStatus: (status) => statuses.push(status),
      onEvent: () => {}
    })
    closers.push(() => client.close())
    await until(() => statuses.includes('connected'))

    const pacientes = await client.request('patients:list', [])
    expect(pacientes).toMatchObject({ ok: true, data: [{ nome: 'Paciente Fictício' }] })
    expect((pacientes as { data: object[] }).data[0]).not.toHaveProperty('cpf')
    expect(await client.request('anamneses:get', [patientId])).toEqual({
      ok: false,
      error: PHONE_RECEPTION_BLOCKED
    })
    expect(await client.request('patients:create', [{ nome: 'Outro' }])).toEqual({
      ok: false,
      error: NOT_ON_PHONE
    })
    const sessoes = await client.request('appointments:listByPatient', [patientId])
    expect(sessoes).toMatchObject({ ok: true, data: [{ evolucao: '' }] })
  }, 40_000)

  it('o celular pareado não vira computador nem conecta com outra versão', async () => {
    const telefone = aparelho()
    devices.set(telefone.key, { name: 'iPhone', tipo: 'celular', nivel: 'fono' })

    for (const version of [{ schema: SCHEMA_VERSION }, { api: API_ATUAL + 1 }]) {
      const statuses: ClientStatus[] = []
      const client = createSyncClient({
        keyPair: telefone.keys,
        name: () => 'iPhone',
        version,
        serverKey,
        serverName: 'Recepção',
        addresses: async () => [],
        dialRemote: telefone.dial,
        onStatus: (status) => statuses.push(status),
        onEvent: () => {}
      })
      closers.push(() => client.close())
      await until(() => statuses.includes('version'))
      expect(client.accepted()).toEqual({ min: API_ATUAL, max: API_ATUAL })
      client.close()
    }
  }, 60_000)
})
