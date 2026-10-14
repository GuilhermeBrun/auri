import net from 'node:net'
import SecretStream from '@hyperswarm/secret-stream'
import type { DataTopic, IpcResult } from '../../shared/api'
import { pairingProof, type createPairingCodes } from './pairing'
import {
  clientMessage,
  decode,
  DEFAULT_PORT,
  encode,
  MAX_REQUEST_BYTES,
  PROTOCOL_VERSION,
  type ServerMessage
} from './protocol'

export type KeyPair = { publicKey: Buffer; secretKey: Buffer }

export type ServerHooks = {
  keyPair: KeyPair
  /** Nome deste computador, como os outros o veem. */
  name: () => string
  schemaVersion: number
  isPaired: (publicKey: string) => boolean
  codes: ReturnType<typeof createPairingCodes>
  /** Um computador acertou o código (ou repareou, talvez com outro nome). */
  onPaired: (device: { publicKey: string; name: string }) => void
  /** Um computador pareado ficou online (primeira conexão) ou offline (última fechou). */
  onPresence: (publicKey: string, online: boolean) => void
  /** Executa uma operação do registro (ver main/operations.ts). */
  handle: (channel: string, args: unknown[]) => IpcResult<unknown>
}

/** Tempo para o cliente se apresentar depois do handshake. */
const HELLO_TIMEOUT_MS = 10_000
/** O cliente manda `ping` a cada 10 s; sem nada por este tempo, a conexão está morta. */
const IDLE_TIMEOUT_MS = 45_000

/**
 * Servidor do papel "guarda os dados". Cada conexão é um fluxo cifrado (Noise, padrão XX: os dois
 * lados trocam as chaves públicas); a chave do cliente é a identidade dele. Só chaves pareadas
 * passam do `hello`, e nada além do `hello` é aceito antes disso. `attach` recebe qualquer fluxo
 * cifrado, para outros transportes além do TCP.
 */
export function createSyncServer(hooks: ServerHooks): {
  /** Devolve a porta em uso. Padrão: todas as interfaces, na porta preferida. */
  listen(options?: { host?: string; port?: number }): Promise<number>
  attach(this: void, stream: SecretStream): void
  broadcast(topics: DataTopic[]): void
  disconnect(publicKey: string): void
  online(): Set<string>
  close(): Promise<void>
} {
  /** Fluxo → chave do cliente, depois que o `hello` foi aceito (null antes). */
  const sessions = new Map<SecretStream, string | null>()
  let server: net.Server | null = null

  const send = (stream: SecretStream, message: ServerMessage): void => {
    if (!stream.destroyed) stream.write(encode(message))
  }

  const online = (): Set<string> =>
    new Set([...sessions.values()].filter((key): key is string => key !== null))

  function reject(
    stream: SecretStream,
    reason: Extract<ServerMessage, { t: 'reject' }>['reason']
  ): void {
    send(stream, { t: 'reject', reason })
    stream.end()
  }

  function hello(
    stream: SecretStream,
    name: string,
    protocol: number,
    schema: number,
    proof?: string
  ): void {
    const remote = stream.remotePublicKey?.toString('hex')
    const hash = stream.handshakeHash
    if (!remote || !hash) return stream.destroy()
    if (protocol !== PROTOCOL_VERSION || schema !== hooks.schemaVersion) {
      return reject(stream, 'version')
    }

    let serverProof: string | undefined
    if (proof !== undefined) {
      const check = hooks.codes.check(Buffer.from(proof, 'hex'), hash)
      if (!check.ok) return reject(stream, `code-${check.reason}`)
      hooks.onPaired({ publicKey: remote, name })
      serverProof = pairingProof(check.code, 'server', hash).toString('hex')
    } else if (!hooks.isPaired(remote)) {
      return reject(stream, 'unpaired')
    }

    const wasOnline = online().has(remote)
    sessions.set(stream, remote)
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
        hello(stream, message.name, message.protocol, message.schema, message.proof)
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
          result: hooks.handle(message.channel, message.args)
        })
      }
    })
    stream.on('error', () => {})
    stream.on('close', () => {
      clearTimeout(timer)
      const peer = sessions.get(stream)
      sessions.delete(stream)
      if (peer && !online().has(peer)) hooks.onPresence(peer, false)
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
            // a porta preferida está em uso: deixa o sistema escolher outra
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
    broadcast(topics) {
      for (const [stream, peer] of sessions) if (peer) send(stream, { t: 'event', topics })
    },
    disconnect(publicKey) {
      for (const [stream, peer] of sessions) if (peer === publicKey) stream.destroy()
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
