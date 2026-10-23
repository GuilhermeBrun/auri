import SecretStream from '@hyperswarm/secret-stream'
import { app, powerSaveBlocker, safeStorage } from 'electron'
import type { AgendaNotice, AgendaNoticeDraft } from '../shared/agenda-notice'
import { hostname } from 'os'
import { join } from 'path'
import {
  DATA_TOPICS,
  type ConnectionInfo,
  type ConnectionRole,
  type DataTopic,
  type DeviceGrant,
  type FoundServer,
  type IpcResult,
  type LinkStatus,
  type PairingCode,
  type RemoteProbe,
  type RemoteReach
} from '../shared/api'
import { createConnectionStore, type ConnectionStore } from './connection-store'
import { openDatabase, type Db } from './db/connection'
import { SCHEMA_VERSION } from './db/migrations'
import { restoreDatabase } from './db/recovery'
import { API_ATUAL, API_MINIMA, callAsDevice } from './net/celular'
import { createSyncClient, pairWithServer, probeServer, type Address } from './net/client'
import { escreverConvite } from './net/convite'
import { createDiscovery, localAddresses } from './net/discovery'
import { createPairingCodes, formatCode } from './net/pairing'
import { DEFAULT_PORT } from './net/protocol'
import { createRemoteDialer, createRemoteListener } from './net/remote'
import { createSyncServer, type KeyPair } from './net/server'
import { runOperation } from './operations'

const FIND_MS = 2_000

export type Connection = {
  start(): Promise<void>
  call(channel: string, args: unknown[]): Promise<IpcResult<unknown>>
  info(): ConnectionInfo
  keepsRunning(): boolean
  onlineDevices(): string[]
  setRole(role: ConnectionRole): Promise<ConnectionInfo>
  setName(name: string): Promise<ConnectionInfo>
  setSharing(on: boolean): Promise<ConnectionInfo>
  setKeepRunning(on: boolean): Promise<ConnectionInfo>
  setOpenAtLogin(on: boolean): Promise<ConnectionInfo>
  setRemoteAccess(on: boolean): Promise<ConnectionInfo>
  setNotices(on: boolean): Promise<ConnectionInfo>
  testRemote(): Promise<RemoteProbe>
  createCode(grant: DeviceGrant): Promise<PairingCode>
  cancelCode(): Promise<void>
  removeDevice(publicKey: string): Promise<ConnectionInfo>
  discover(): Promise<FoundServer[]>
  pair(address: string, code: string): Promise<ConnectionInfo>
  forget(): Promise<ConnectionInfo>
  retry(): Promise<void>
  database(): Db | null
  replaceDatabase(source: string): void
  close(): void
}

function systemName(): string {
  return (
    hostname()
      .replace(/\.local$/i, '')
      .slice(0, 60) || 'Computador'
  )
}

export function parseAddress(value: string): Address | null {
  const match = /^\s*([\w.-]+)(?::(\d{1,5}))?\s*$/.exec(value)
  if (!match) return null
  const port = match[2] ? Number(match[2]) : DEFAULT_PORT
  return port > 0 && port < 65536 ? { host: match[1], port } : null
}

export function createConnection(options: {
  userData: string
  onDataChanged: (topics: DataTopic[]) => void
  onNotice?: (notice: AgendaNotice) => void
  onInfoChanged: (info: ConnectionInfo) => void
  onWrite?: () => void
  onFailure?: (error: unknown) => void
}): Connection {
  const store = createConnectionStore(join(options.userData, 'conexao.json'))
  const dbFile = join(options.userData, 'auri.db')
  const codes = createPairingCodes()
  const discovery = createDiscovery()

  let db: Db | null = null
  let server: ReturnType<typeof createSyncServer> | null = null
  let port: number | null = null
  let sharingError: string | null = null
  let remote: ReturnType<typeof createRemoteListener> | null = null
  let remoteReach: RemoteReach | null = null
  let client: ReturnType<typeof createSyncClient> | null = null
  let dialer: ReturnType<typeof createRemoteDialer> | null = null
  let clientStatus: LinkStatus = 'unpaired'
  let blocker: number | null = null

  const name = (): string => store.get().name || systemName()
  const deviceOf = (publicKey: string): ConnectionStore['devices'][number] | undefined =>
    store.get().devices.find((d) => d.publicKey === publicKey)
  const isPaired = (publicKey: string): boolean => deviceOf(publicKey) !== undefined

  function keyPair(): KeyPair {
    const saved = store.get().keys
    if (saved) {
      const secret = saved.encrypted
        ? safeStorage.decryptString(Buffer.from(saved.secretKey, 'base64'))
        : saved.secretKey
      return {
        publicKey: Buffer.from(saved.publicKey, 'hex'),
        secretKey: Buffer.from(secret, 'hex')
      }
    }
    const keys = SecretStream.keyPair()
    const secretHex = keys.secretKey.toString('hex')
    const encrypted = safeStorage.isEncryptionAvailable()
    store.update({
      keys: {
        publicKey: keys.publicKey.toString('hex'),
        secretKey: encrypted ? safeStorage.encryptString(secretHex).toString('base64') : secretHex,
        encrypted
      }
    })
    return keys
  }

  let keys: KeyPair | null = null
  const getKeys = (): KeyPair => (keys ??= keyPair())

  function info(): ConnectionInfo {
    const s = store.get()
    const online = server?.online() ?? new Set<string>()
    return {
      role: s.role,
      name: name(),
      status: s.role === 'server' ? 'local' : clientStatus,
      sharing: s.sharing,
      sharingError,
      keepRunning: s.keepRunning,
      openAtLogin: s.openAtLogin,
      remoteAccess: s.remoteAccess,
      notices: s.notices,
      remoteReach: s.role === 'server' && server ? remoteReach : null,
      addresses:
        s.role === 'server' && s.sharing && port !== null
          ? localAddresses().map((address) =>
              port === DEFAULT_PORT ? address : `${address}:${port}`
            )
          : [],
      devices: s.devices.map((device) => ({
        ...device,
        online: online.has(device.publicKey)
      })),
      server: s.server,
      via: s.role === 'client' ? (client?.via() ?? null) : null
    }
  }

  const changed = (): void => options.onInfoChanged(info())

  function updateDevice(
    publicKey: string,
    change: Partial<ConnectionStore['devices'][number]>
  ): void {
    store.update({
      devices: store.get().devices.map((d) => (d.publicKey === publicKey ? { ...d, ...change } : d))
    })
  }

  function syncPowerBlocker(): void {
    const busy = (server?.online().size ?? 0) > 0
    if (busy && blocker === null) blocker = powerSaveBlocker.start('prevent-app-suspension')
    if (!busy && blocker !== null) {
      powerSaveBlocker.stop(blocker)
      blocker = null
    }
  }

  function syncLoginItem(): void {
    if (!app.isPackaged) return
    const s = store.get()
    app.setLoginItemSettings({ openAtLogin: s.role === 'server' && s.sharing && s.openAtLogin })
  }

  function notify(notice: AgendaNotice | undefined): void {
    if (notice && store.get().notices) options.onNotice?.(notice)
  }

  function dataChanged(topics: DataTopic[], draft: AgendaNoticeDraft | null, peer?: string): void {
    const author = peer ? store.get().devices.find((d) => d.publicKey === peer)?.name : name()
    const notice = draft && author ? { ...draft, autor: author.slice(0, 60) } : undefined
    server?.broadcast(topics, notice, peer)
    options.onDataChanged(topics)
    options.onWrite?.()
    if (peer) notify(notice)
  }

  function startRemote(): void {
    if (remote || !server || !store.get().remoteAccess) return
    remoteReach = 'starting'
    remote = createRemoteListener({
      keyPair: getKeys(),
      isPaired,
      codes,
      attach: server.attach,
      onReach: (reach) => {
        remoteReach = reach
        changed()
      }
    })
  }

  async function stopRemote(): Promise<void> {
    const closing = remote
    remote = null
    remoteReach = null
    await closing?.close()
  }

  async function startSharing(): Promise<void> {
    if (server || !db) return
    const next = createSyncServer({
      keyPair: getKeys(),
      name,
      schemaVersion: SCHEMA_VERSION,
      api: { min: API_MINIMA, max: API_ATUAL },
      device: (key) => deviceOf(key) ?? null,
      codes,
      onPaired: ({ publicKey, name: deviceName, ...grant }) => {
        const others = store.get().devices.filter((d) => d.publicKey !== publicKey)
        const nivel = grant.tipo === 'celular' ? grant.nivel : null
        store.update({
          devices: [
            ...others,
            { publicKey, name: deviceName, tipo: grant.tipo, nivel, lastSeen: null }
          ]
        })
        changed()
      },
      onPresence: (publicKey, online) => {
        updateDevice(publicKey, { lastSeen: new Date().toISOString() })
        syncPowerBlocker()
        changed()
        if (online) console.log(`[conexão] ${deviceOf(publicKey)?.tipo ?? 'aparelho'} conectado`)
      },
      handle: (channel, args, peer) => {
        const current = db
        if (!current) {
          return {
            ok: false,
            error: 'Os dados estão sendo restaurados. Tente de novo em instantes.'
          }
        }
        const run = (c: string, a: unknown[]): IpcResult<unknown> =>
          runOperation(
            current,
            c,
            a,
            (topics, draft) => dataChanged(topics, draft, peer.publicKey),
            options.onFailure
          )
        return callAsDevice(run, deviceOf(peer.publicKey), peer, channel, args)
      }
    })
    try {
      port = await next.listen()
      server = next
      sharingError = null
      discovery.publish({ name: name(), port, publicKey: getKeys().publicKey.toString('hex') })
      startRemote()
    } catch (error) {
      await next.close()
      sharingError = `Não foi possível compartilhar: ${(error as Error).message}`
      console.error('[conexão]', sharingError)
    }
  }

  async function stopSharing(): Promise<void> {
    codes.cancel()
    await stopRemote()
    discovery.unpublish()
    await server?.close()
    server = null
    port = null
    syncPowerBlocker()
  }

  async function startServerRole(): Promise<void> {
    db = openDatabase(dbFile)
    console.log(`[db] ${dbFile}`)
    if (store.get().sharing) await startSharing()
  }

  async function stopServerRole(): Promise<void> {
    await stopSharing()
    db?.close()
    db = null
  }

  async function serverAddresses(serverKey: string): Promise<Address[]> {
    const addresses: Address[] = []
    const saved = store.get().server?.address
    const parsed = saved ? parseAddress(saved) : null
    if (parsed) addresses.push(parsed)
    const found = await discovery.find(FIND_MS)
    for (const s of found) {
      if (s.publicKey !== serverKey) continue
      if (!addresses.some((a) => a.host === s.host && a.port === s.port)) {
        addresses.push({ host: s.host, port: s.port })
      }
    }
    return addresses
  }

  function startClientRole(): void {
    const target = store.get().server
    if (!target) {
      clientStatus = 'unpaired'
      return
    }
    clientStatus = 'connecting'
    const remoteDialer = (dialer = createRemoteDialer({ keyPair: getKeys() }))
    client = createSyncClient({
      keyPair: getKeys(),
      name,
      version: { schema: SCHEMA_VERSION },
      serverKey: target.publicKey,
      serverName: target.name,
      addresses: () => serverAddresses(target.publicKey),
      dialRemote: () => remoteDialer.dial(target.publicKey),
      onStatus: (status) => {
        clientStatus = status
        if (status === 'connected') options.onDataChanged([...DATA_TOPICS])
        changed()
      },
      onEvent: (topics, notice) => {
        options.onDataChanged(topics)
        notify(notice)
      },
      onConnected: (route) => {
        if (route.via !== 'local') return
        const current = store.get().server
        const value = `${route.address.host}:${route.address.port}`
        if (current && current.address !== value) {
          store.update({ server: { ...current, address: value } })
        }
      }
    })
  }

  function stopClientRole(): void {
    client?.close()
    client = null
    void dialer?.close()
    dialer = null
  }

  async function start(): Promise<void> {
    if (store.get().role === 'server') await startServerRole()
    else startClientRole()
    syncLoginItem()
  }

  async function restartAs(role: ConnectionRole): Promise<void> {
    if (store.get().role === 'server') await stopServerRole()
    else stopClientRole()
    store.update({ role })
    await start()
    options.onDataChanged([...DATA_TOPICS])
  }

  return {
    start,

    async call(channel: string, args: unknown[]): Promise<IpcResult<unknown>> {
      if (db) return runOperation(db, channel, args, dataChanged, options.onFailure)
      if (client) return client.request(channel, args)
      return {
        ok: false,
        error:
          'Este computador ainda não está conectado a outro. Veja em Configurações / Armazenamento.'
      }
    },

    info,

    keepsRunning(): boolean {
      const s = store.get()
      return s.role === 'server' && s.sharing && s.keepRunning
    },

    onlineDevices(): string[] {
      const online = server?.online() ?? new Set<string>()
      return store
        .get()
        .devices.filter((d) => online.has(d.publicKey))
        .map((d) => d.name)
    },

    async setRole(role: ConnectionRole): Promise<ConnectionInfo> {
      if (role !== store.get().role) await restartAs(role)
      changed()
      return info()
    },

    async setName(value: string): Promise<ConnectionInfo> {
      store.update({ name: value.trim() === systemName() ? '' : value.trim() })
      if (server && port !== null) {
        discovery.publish({ name: name(), port, publicKey: getKeys().publicKey.toString('hex') })
      }
      changed()
      return info()
    },

    async setSharing(on: boolean): Promise<ConnectionInfo> {
      store.update({ sharing: on })
      if (store.get().role === 'server') {
        if (on) await startSharing()
        else {
          await stopSharing()
          sharingError = null
        }
      }
      syncLoginItem()
      changed()
      return info()
    },

    async setKeepRunning(on: boolean): Promise<ConnectionInfo> {
      store.update({ keepRunning: on })
      changed()
      return info()
    },

    async setOpenAtLogin(on: boolean): Promise<ConnectionInfo> {
      store.update({ openAtLogin: on })
      syncLoginItem()
      changed()
      return info()
    },

    async setRemoteAccess(on: boolean): Promise<ConnectionInfo> {
      store.update({ remoteAccess: on })
      if (on) startRemote()
      else await stopRemote()
      changed()
      return info()
    },

    async setNotices(on: boolean): Promise<ConnectionInfo> {
      store.update({ notices: on })
      changed()
      return info()
    },

    async testRemote(): Promise<RemoteProbe> {
      const target = store.get().server
      if (store.get().role !== 'client' || !target || !dialer) {
        throw new Error('Este computador não está conectado a outro.')
      }
      const remoteDialer = dialer
      return probeServer({
        open: () => remoteDialer.dial(target.publicKey),
        serverKey: target.publicKey,
        serverName: target.name,
        name: name(),
        version: { schema: SCHEMA_VERSION }
      })
    },

    async createCode(grant: DeviceGrant): Promise<PairingCode> {
      const listening = port
      if (!server || listening === null) {
        const aparelho = grant.tipo === 'celular' ? 'um celular' : 'um computador'
        throw new Error(`Ligue o compartilhamento antes de conectar ${aparelho}.`)
      }
      const { code, expiresAt } = codes.issue(grant)
      const convite =
        grant.tipo === 'celular'
          ? escreverConvite({
              chave: getKeys().publicKey.toString('hex'),
              codigo: code,
              enderecos: localAddresses()
                .slice(0, 8)
                .map((host) => ({ host, port: listening }))
            })
          : null
      return { code: formatCode(code), expiresAt, convite }
    },

    async cancelCode(): Promise<void> {
      codes.cancel()
    },

    async removeDevice(publicKey: string): Promise<ConnectionInfo> {
      store.update({ devices: store.get().devices.filter((d) => d.publicKey !== publicKey) })
      server?.disconnect(publicKey)
      changed()
      return info()
    },

    async discover(): Promise<FoundServer[]> {
      const own = getKeys().publicKey.toString('hex')
      return (await discovery.find(FIND_MS)).filter((s) => s.publicKey !== own)
    },

    async pair(address: string, code: string): Promise<ConnectionInfo> {
      const target = parseAddress(address)
      if (!target)
        throw new Error('Endereço inválido. Use o formato 192.168.0.12 ou 192.168.0.12:47390.')
      const result = await pairWithServer({
        keyPair: getKeys(),
        name: name(),
        version: { schema: SCHEMA_VERSION },
        address: target,
        code
      })
      stopClientRole()
      store.update({
        role: 'client',
        server: { ...result, address: `${target.host}:${target.port}` }
      })
      if (db) await stopServerRole()
      startClientRole()
      options.onDataChanged([...DATA_TOPICS])
      changed()
      return info()
    },

    async forget(): Promise<ConnectionInfo> {
      stopClientRole()
      store.update({ server: null })
      clientStatus = 'unpaired'
      options.onDataChanged([...DATA_TOPICS])
      changed()
      return info()
    },

    async retry(): Promise<void> {
      client?.retry()
    },

    database: () => db,

    replaceDatabase(source: string): void {
      if (!db) throw new Error('Só o computador que guarda os dados pode restaurar uma cópia.')
      const current = db
      try {
        db = restoreDatabase(db, dbFile, source)
      } catch (error) {
        db = current.open ? current : null
        if (!db && !(error instanceof AggregateError)) db = openDatabase(dbFile)
        throw error
      }
      server?.broadcast([...DATA_TOPICS])
      options.onDataChanged([...DATA_TOPICS])
    },

    close(): void {
      stopClientRole()
      codes.cancel()
      void remote?.close()
      remote = null
      void server?.close()
      server = null
      db?.close()
      db = null
      if (blocker !== null) powerSaveBlocker.stop(blocker)
      discovery.destroy()
    }
  }
}
