import net from 'node:net'
import SecretStream from '@hyperswarm/secret-stream'
import type { AgendaNotice } from '../../shared/agenda-notice'
import type { DataTopic, DeviceGrant, DeviceKind, IpcResult } from '../../shared/api'
import { pairingProof, type PairingCodes } from './pairing'
import {
  clientMessage,
  decode,
  DEFAULT_PORT,
  encode,
  MAX_REQUEST_BYTES,
  PROTOCOL_VERSION,
  type ApiRange,
  type ClientMessage,
  type ServerMessage
} from './protocol'

export type KeyPair = { publicKey: Buffer; secretKey: Buffer }

export type Peer = { publicKey: string; api: number | null }

export type ServerHooks = {
  keyPair: KeyPair
  name: () => string
  schemaVersion: number
  api: ApiRange
  device: (publicKey: string) => { tipo: DeviceKind } | null
  codes: PairingCodes
  onPaired: (device: { publicKey: string; name: string } & DeviceGrant) => void
  onPresence: (publicKey: string, online: boolean) => void
  handle: (channel: string, args: unknown[], peer: Peer) => IpcResult<unknown>
}

type Hello = Extract<ClientMessage, { t: 'hello' }>

const HELLO_TIMEOUT_MS = 10_000
const IDLE_TIMEOUT_MS = 45_000

export function createSyncServer(hooks: ServerHooks): {
  listen(options?: { host?: string; port?: number }): Promise<number>
  attach(this: void, stream: SecretStream): void
  broadcast(topics: DataTopic[], notice?: AgendaNotice, from?: string): void
  disconnect(publicKey: string): void
  online(): Set<string>
  close(): Promise<void>
} {
  const sessions = new Map<SecretStream, Peer | null>()
  let server: net.Server | null = null

  const send = (stream: SecretStream, message: ServerMessage): void => {
    if (!stream.destroyed) stream.write(encode(message))
  }

  const online = (): Set<string> =>
    new Set([...sessions.values()].flatMap((peer) => (peer === null ? [] : [peer.publicKey])))

  function reject(
    stream: SecretStream,
    reason: Extract<ServerMessage, { t: 'reject' }>['reason'],
    api?: ApiRange
  ): void {
    send(stream, { t: 'reject', reason, api })
    stream.end()
  }

  function speaks(tipo: DeviceKind, message: Hello): boolean {
    if (tipo === 'computador') return message.schema === hooks.schemaVersion
    return message.api !== undefined && message.api >= hooks.api.min && message.api <= hooks.api.max
  }

  function refuseVersion(stream: SecretStream, tipo: DeviceKind): void {
    reject(stream, 'version', tipo === 'celular' ? hooks.api : undefined)
  }

  function hello(stream: SecretStream, message: Hello): void {
    const remote = stream.remotePublicKey?.toString('hex')
    const hash = stream.handshakeHash
    if (!remote || !hash) return stream.destroy()
    if (message.protocol !== PROTOCOL_VERSION) return reject(stream, 'version')

    let serverProof: string | undefined
    let tipo: DeviceKind
    if (message.proof !== undefined) {
      const offered = hooks.codes.active()
      if (offered && !speaks(offered.tipo, message)) return refuseVersion(stream, offered.tipo)
      const check = hooks.codes.check(Buffer.from(message.proof, 'hex'), hash)
      if (!check.ok) return reject(stream, `code-${check.reason}`)
      hooks.onPaired({ publicKey: remote, name: message.name, ...check.grant })
      serverProof = pairingProof(check.code, 'server', hash).toString('hex')
      tipo = check.grant.tipo
    } else {
      const device = hooks.device(remote)
      if (!device) return reject(stream, 'unpaired')
      if (!speaks(device.tipo, message)) return refuseVersion(stream, device.tipo)
      tipo = device.tipo
    }

    const wasOnline = online().has(remote)
    sessions.set(stream, { publicKey: remote, api: tipo === 'celular' ? message.api! : null })
    send(stream, { t: 'welcome', name: hooks.name(), proof: serverProof })
    if (!wasOnline) hooks.onPresence(remote, true)
  }

  function attach(stream: SecretStream): void {
    sessions.set(stream, null)
    let timer = setTimeout(() => stream.destroy(), HELLO_TIMEOUT_MS)
    const touch = (): void => {
      clearTimeout(timer)
      timer = setTimeout(() => stream.destroy(), IDLE_TIMEOUT_MS)
    }

    stream.on('data', (data: Buffer) => {
      if (data.length > MAX_REQUEST_BYTES) return stream.destroy()
      const message = decode(clientMessage, data)
      if (!message) return stream.destroy()
      const peer = sessions.get(stream)

      if (message.t === 'hello') {
        if (peer !== null) return stream.destroy()
        hello(stream, message)
        if (sessions.get(stream)) touch()
        return
      }
      if (!peer) return stream.destroy()
      touch()
      if (message.t === 'ping') send(stream, { t: 'pong' })
      else {
        send(stream, {
          t: 'res',
          id: message.id,
          result: hooks.handle(message.channel, message.args, peer)
        })
      }
    })
    stream.on('error', () => {})
    stream.on('close', () => {
      clearTimeout(timer)
      const peer = sessions.get(stream)
      sessions.delete(stream)
      if (peer && !online().has(peer.publicKey)) hooks.onPresence(peer.publicKey, false)
    })
  }

  return {
    listen({ host = '0.0.0.0', port = DEFAULT_PORT } = {}) {
      server = net.createServer((socket) => {
        socket.on('error', () => {})
        socket.setKeepAlive(true, 10_000)
        attach(new SecretStream(false, socket, { keyPair: hooks.keyPair }))
      })
      const tryPort = (port: number): Promise<number> =>
        new Promise((resolve, reject) => {
          const onError = (error: NodeJS.ErrnoException): void => {
            if (error.code === 'EADDRINUSE' && port !== 0) resolve(tryPort(0))
            else reject(error)
          }
          server!.once('error', onError)
          server!.listen(port, host, () => {
            server!.off('error', onError)
            resolve((server!.address() as net.AddressInfo).port)
          })
        })
      return tryPort(port)
    },
    attach,
    broadcast(topics, notice, from) {
      for (const [stream, peer] of sessions) {
        if (peer) {
          send(stream, { t: 'event', topics, notice: peer.publicKey === from ? undefined : notice })
        }
      }
    },
    disconnect(publicKey) {
      for (const [stream, peer] of sessions) if (peer?.publicKey === publicKey) stream.destroy()
    },
    online,
    close() {
      for (const stream of sessions.keys()) stream.destroy()
      sessions.clear()
      const closing = server
      server = null
      return new Promise((resolve) => (closing ? closing.close(() => resolve()) : resolve()))
    }
  }
}
