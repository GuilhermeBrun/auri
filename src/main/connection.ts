import SecretStream from '@hyperswarm/secret-stream'
import { app, powerSaveBlocker, safeStorage } from 'electron'
import { hostname } from 'os'
import { join } from 'path'
import {
  DATA_TOPICS,
  type ConnectionInfo,
  type ConnectionRole,
  type DataTopic,
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
import { createSyncClient, pairWithServer, probeServer, type Address } from './net/client'
import { createDiscovery, localAddresses } from './net/discovery'
import { createPairingCodes, formatCode } from './net/pairing'
import { DEFAULT_PORT } from './net/protocol'
import { createRemoteDialer, createRemoteListener } from './net/remote'
import { createSyncServer, type KeyPair } from './net/server'
import { runOperation } from './operations'

/** Quanto tempo a busca na rede espera respostas (na aba Conexão e ao reconectar). */
const FIND_MS = 2_000

export type Connection = {
  /** Abre o banco ou a conexão conforme o papel salvo. */
  start(): Promise<void>
  /** Um pedido das telas: no banco local ou no outro computador, conforme o papel. */
  call(channel: string, args: unknown[]): Promise<IpcResult<unknown>>
  info(): ConnectionInfo
  /** Fechar a janela mantém o Auri rodando (bandeja / barra de menus). */
  keepsRunning(): boolean
  /** Computadores usando os dados deste agora (para confirmar antes de sair). */
  onlineDevices(): string[]
  setRole(role: ConnectionRole): Promise<ConnectionInfo>
  setName(name: string): Promise<ConnectionInfo>
  setSharing(on: boolean): Promise<ConnectionInfo>
  setKeepRunning(on: boolean): Promise<ConnectionInfo>
  setOpenAtLogin(on: boolean): Promise<ConnectionInfo>
  setRemoteAccess(on: boolean): Promise<ConnectionInfo>
  testRemote(): Promise<RemoteProbe>
  createCode(): Promise<PairingCode>
  cancelCode(): Promise<void>
  removeDevice(publicKey: string): Promise<ConnectionInfo>
  discover(): Promise<FoundServer[]>
  pair(address: string, code: string): Promise<ConnectionInfo>
  forget(): Promise<ConnectionInfo>
  retry(): Promise<void>
  /** Ao sair do app: síncrono, para o banco fechar antes de o processo terminar. */
  close(): void
}

function systemName(): string {
  return (
    hostname()
      .replace(/\.local$/i, '')
      .slice(0, 60) || 'Computador'
  )
}

/** "192.168.0.12" ou "192.168.0.12:47390". */
export function parseAddress(value: string): Address | null {
  const match = /^\s*([\w.-]+)(?::(\d{1,5}))?\s*$/.exec(value)
  if (!match) return null
  const port = match[2] ? Number(match[2]) : DEFAULT_PORT
  return port > 0 && port < 65536 ? { host: match[1], port } : null
}

/**
 * Onde ficam os dados deste computador e como ele conversa com o outro (ver
 * docs/superpowers/specs/2026-10-13-conexao-entre-computadores-design.md).
 *
 * - Papel `server` (recepção): abre o SQLite; com o compartilhamento ligado, aceita computadores
 *   pareados pela rede local (TCP, anunciado por mDNS) e, com o acesso de fora ligado, também pela
 *   internet (rede distribuída do Hyperswarm, com a mesma chave).
 * - Papel `client` (consultório): não abre o banco local; repassa cada pedido ao servidor, pela
 *   rede local quando dá, senão pela internet.
 *
 * Trocar de papel não reinicia o app: fecha um lado, abre o outro e avisa as telas
 * (`onDataChanged` com tudo) para recarregarem.
 */
export function createConnection(options: {
  userData: string
  onDataChanged: (topics: DataTopic[]) => void
  onInfoChanged: (info: ConnectionInfo) => void
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

  // Chaves -------------------------------------------------------------------------------------

  /**
   * O par de chaves é a identidade deste computador. A chave secreta fica cifrada pelo cofre do
   * sistema (Chaveiro no Mac, DPAPI no Windows) quando ele está disponível.
   */
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

  // Estado para as telas -----------------------------------------------------------------------

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

  /** Enquanto houver um computador conectado, este não entra em suspensão. */
  function syncPowerBlocker(): void {
    const busy = (server?.online().size ?? 0) > 0
    if (busy && blocker === null) blocker = powerSaveBlocker.start('prevent-app-suspension')
    if (!busy && blocker !== null) {
      powerSaveBlocker.stop(blocker)
      blocker = null
    }
  }

  /** Abre ao ligar o computador: só no app instalado (em desenvolvimento registraria o Electron). */
  function syncLoginItem(): void {
    if (!app.isPackaged) return
    const s = store.get()
    app.setLoginItemSettings({ openAtLogin: s.role === 'server' && s.sharing && s.openAtLogin })
  }

  // Papel servidor -----------------------------------------------------------------------------

  function dataChanged(topics: DataTopic[]): void {
    server?.broadcast(topics)
    options.onDataChanged(topics)
  }

  /** Acesso de fora: escuta também pela rede distribuída, entregando as conexões ao mesmo servidor. */
  function startRemote(): void {
    if (remote || !server || !store.get().remoteAccess) return
    remoteReach = 'starting'
    remote = createRemoteListener({
      keyPair: getKeys(),
      isPaired: (key) => store.get().devices.some((d) => d.publicKey === key),
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
    const local = db
    const next = createSyncServer({
      keyPair: getKeys(),
      name,
      schemaVersion: SCHEMA_VERSION,
      isPaired: (key) => store.get().devices.some((d) => d.publicKey === key),
      codes,
      onPaired: ({ publicKey, name: deviceName }) => {
        const others = store.get().devices.filter((d) => d.publicKey !== publicKey)
        store.update({ devices: [...others, { publicKey, name: deviceName, lastSeen: null }] })
        changed()
      },
      onPresence: (publicKey, online) => {
        updateDevice(publicKey, { lastSeen: new Date().toISOString() })
        syncPowerBlocker()
        changed()
        if (online) console.log('[conexão] computador conectado')
      },
      handle: (channel, args) => runOperation(local, channel, args, dataChanged)
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

  // Papel cliente ------------------------------------------------------------------------------

  /** Último endereço que funcionou primeiro; depois o que a busca na rede achar com a mesma chave. */
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
      schemaVersion: SCHEMA_VERSION,
      serverKey: target.publicKey,
      serverName: target.name,
      addresses: () => serverAddresses(target.publicKey),
      dialRemote: () => remoteDialer.dial(target.publicKey),
      onStatus: (status) => {
        clientStatus = status
        // voltou: o que mudou enquanto estava fora não chegou como aviso
        if (status === 'connected') options.onDataChanged([...DATA_TOPICS])
        changed()
      },
      onEvent: options.onDataChanged,
      onConnected: (route) => {
        // pela internet não há endereço a guardar: a chave basta para achar o outro
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

  // Ciclo de vida ------------------------------------------------------------------------------

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
      if (db) return runOperation(db, channel, args, dataChanged)
      if (client) return client.request(channel, args)
      return {
        ok: false,
        error: 'Este computador ainda não está conectado a outro. Veja em Configurações / Conexão.'
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
        schemaVersion: SCHEMA_VERSION
      })
    },

    async createCode(): Promise<PairingCode> {
      if (!server) throw new Error('Ligue o compartilhamento antes de conectar um computador.')
      const { code, expiresAt } = codes.issue()
      return { code: formatCode(code), expiresAt }
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
        schemaVersion: SCHEMA_VERSION,
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
