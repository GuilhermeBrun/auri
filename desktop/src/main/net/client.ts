import net from 'node:net'
import SecretStream from '@hyperswarm/secret-stream'
import type { DataTopic, IpcResult, LinkVia, RemoteProbe } from '../../shared/api'
import { pairingProof, proofMatches } from './pairing'
import {
  decode,
  encode,
  PROTOCOL_VERSION,
  serverMessage,
  type ClientMessage,
  type ServerMessage
} from './protocol'
import type { KeyPair } from './server'

export type Address = { host: string; port: number }

export type Route = { via: 'local'; address: Address } | { via: 'internet' }

export function tcpStream(keyPair: KeyPair, address: Address): SecretStream {
  const socket = net.connect(address.port, address.host)
  socket.on('error', () => {})
  socket.setKeepAlive(true, 10_000)
  return new SecretStream(true, socket, { keyPair })
}

export type ClientStatus = 'connecting' | 'connected' | 'offline' | 'version' | 'revoked'

export type ClientHooks = {
  keyPair: KeyPair
  name: () => string
  schemaVersion: number
  serverKey: string
  serverName: string
  addresses: () => Promise<Address[]>
  dialRemote?: () => SecretStream
  onStatus: (status: ClientStatus) => void
  onEvent: (topics: DataTopic[]) => void
  onConnected?: (route: Route) => void
}

const LOCAL_TIMEOUT_MS = 5_000
const REMOTE_TIMEOUT_MS = 20_000
const REMOTE_DELAY_MS = 1_500
const REQUEST_TIMEOUT_MS = 15_000
const PING_MS = 10_000
const DEAD_MS = 25_000
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000]
const FIRST_CONNECT_WAIT_MS = 6_000

type Outcome = 'ok' | 'fail' | 'version' | 'revoked'

type Race = { won: boolean; aborts: Set<() => void> }

function firstDecisive(attempts: Promise<Outcome>[]): Promise<Outcome> {
  return new Promise((resolve) => {
    let left = attempts.length
    for (const attempt of attempts) {
      void attempt.then((outcome) => {
        if (outcome !== 'fail') resolve(outcome)
        else if (--left === 0) resolve('fail')
      })
    }
  })
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function trimArgs(args: unknown[]): unknown[] {
  let end = args.length
  while (end > 0 && args[end - 1] === undefined) end--
  return args.slice(0, end)
}

export function createSyncClient(hooks: ClientHooks): {
  request(channel: string, args: unknown[]): Promise<IpcResult<unknown>>
  status(): ClientStatus
  via(): LinkVia | null
  retry(): void
  close(): void
} {
  let status: ClientStatus = 'connecting'
  let stream: SecretStream | null = null
  let route: Route | null = null
  let looping = false
  let closed = false
  let attempt = 0
  let retryTimer: NodeJS.Timeout | undefined
  let pingTimer: NodeJS.Timeout | undefined
  let lastHeard = 0
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (result: IpcResult<unknown>) => void; timeout: NodeJS.Timeout }
  >()
  const statusWaiters = new Set<() => void>()
  const server = hooks.serverName

  function setStatus(next: ClientStatus): void {
    if (status === next) return
    status = next
    hooks.onStatus(next)
    for (const wake of statusWaiters) wake()
  }

  function unavailable(): string {
    if (status === 'version') return `${server} usa outra versão do Auri.`
    if (status === 'revoked') return `Este computador foi desconectado de ${server}.`
    return `Sem conexão com ${server}.`
  }

  function failPending(error: string): void {
    for (const { resolve, timeout } of pending.values()) {
      clearTimeout(timeout)
      resolve({ ok: false, error })
    }
    pending.clear()
  }

  function onMessage(message: ServerMessage): void {
    if (message.t === 'res') {
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      clearTimeout(entry.timeout)
      entry.resolve(message.result)
    } else if (message.t === 'event') {
      hooks.onEvent(message.topics)
    }
  }

  function adopt(next: SecretStream, through: Route): void {
    stream = next
    route = through
    attempt = 0
    lastHeard = Date.now()
    pingTimer = setInterval(() => {
      if (Date.now() - lastHeard > DEAD_MS) next.destroy()
      else next.write(encode({ t: 'ping' }))
    }, PING_MS)
    setStatus('connected')
    hooks.onConnected?.(through)
  }

  function dropped(): void {
    stream = null
    route = null
    clearInterval(pingTimer)
    failPending(
      `A conexão com ${server} caiu antes da resposta. Confira se a alteração foi salva antes de repetir.`
    )
    if (closed) return
    setStatus('offline')
    schedule()
  }

  function connectOnce(
    open: () => SecretStream,
    through: Route,
    timeoutMs: number,
    race: Race
  ): Promise<Outcome> {
    return new Promise((resolve) => {
      let secret: SecretStream
      try {
        secret = open()
      } catch {
        return resolve('fail')
      }
      let settled = false
      const finish = (outcome: Outcome): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        race.aborts.delete(abort)
        if (outcome !== 'ok') secret.destroy()
        resolve(outcome)
      }
      const abort = (): void => finish('fail')
      race.aborts.add(abort)
      const timer = setTimeout(() => finish('fail'), timeoutMs)

      secret.on('error', () => {})
      secret.on('connect', () => {
        if (secret.remotePublicKey?.toString('hex') !== hooks.serverKey) return finish('fail')
        const hello: ClientMessage = {
          t: 'hello',
          protocol: PROTOCOL_VERSION,
          schema: hooks.schemaVersion,
          name: hooks.name()
        }
        secret.write(encode(hello))
      })
      secret.on('data', (data: Buffer) => {
        const message = decode(serverMessage, data)
        if (!message) return secret.destroy()
        lastHeard = Date.now()
        if (settled) return onMessage(message)
        if (message.t === 'welcome') {
          if (closed || race.won || stream) return finish('fail')
          race.won = true
          adopt(secret, through)
          finish('ok')
        } else if (message.t === 'reject') {
          finish(message.reason === 'version' ? 'version' : 'revoked')
        } else finish('fail')
      })
      secret.on('close', () => {
        if (!settled) finish('fail')
        else if (stream === secret) dropped()
      })
    })
  }

  async function tryLocal(race: Race): Promise<Outcome> {
    const addresses = await hooks.addresses().catch(() => [])
    for (const address of addresses) {
      if (race.won || closed) return 'fail'
      const outcome = await connectOnce(
        () => tcpStream(hooks.keyPair, address),
        { via: 'local', address },
        LOCAL_TIMEOUT_MS,
        race
      )
      if (outcome !== 'fail') return outcome
    }
    return 'fail'
  }

  async function tryRemote(race: Race): Promise<Outcome> {
    const dial = hooks.dialRemote
    if (!dial) return 'fail'
    await sleep(REMOTE_DELAY_MS)
    if (race.won || closed) return 'fail'
    return connectOnce(dial, { via: 'internet' }, REMOTE_TIMEOUT_MS, race)
  }

  async function connectLoop(): Promise<void> {
    if (looping || closed || stream) return
    looping = true
    const race: Race = { won: false, aborts: new Set() }
    try {
      const outcome = await firstDecisive([tryLocal(race), tryRemote(race)])
      race.won = true
      for (const abort of race.aborts) abort()
      if (closed || outcome === 'ok') return
      if (outcome !== 'fail') return setStatus(outcome)
      setStatus('offline')
      schedule()
    } finally {
      looping = false
    }
  }

  function schedule(): void {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(
      () => void connectLoop(),
      BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
    )
    attempt++
  }

  function waitForStatusChange(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const wake = (): void => {
        clearTimeout(timeout)
        statusWaiters.delete(wake)
        resolve()
      }
      const timeout = setTimeout(wake, ms)
      statusWaiters.add(wake)
    })
  }

  void connectLoop()

  return {
    async request(channel, args) {
      if (!stream && status === 'connecting') await waitForStatusChange(FIRST_CONNECT_WAIT_MS)
      const current = stream
      if (!current) return { ok: false, error: unavailable() }
      const id = nextId++
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pending.delete(id)
          resolve({
            ok: false,
            error: `${server} não respondeu. Confira se a alteração foi salva antes de repetir.`
          })
        }, REQUEST_TIMEOUT_MS)
        pending.set(id, { resolve, timeout })
        current.write(encode({ t: 'req', id, channel, args: trimArgs(args) }))
      })
    },
    status: () => status,
    via: () => route?.via ?? null,
    retry() {
      if (closed || stream) return
      clearTimeout(retryTimer)
      attempt = 0
      if (status === 'version' || status === 'revoked') setStatus('connecting')
      void connectLoop()
    },
    close() {
      closed = true
      clearTimeout(retryTimer)
      clearInterval(pingTimer)
      stream?.destroy()
      stream = null
      route = null
      failPending(`Sem conexão com ${server}.`)
    }
  }
}

const PAIR_TIMEOUT_MS = 8_000

const PAIR_ERRORS: Record<Extract<ServerMessage, { t: 'reject' }>['reason'], string> = {
  version:
    'Os dois computadores estão com versões diferentes do Auri. Atualize os dois para a mesma versão.',
  unpaired: 'O outro computador recusou a conexão.',
  'code-none':
    'Não há código ativo no outro computador. Clique em Conectar computador lá para gerar um.',
  'code-expired': 'O código venceu. Gere outro no outro computador.',
  'code-wrong': 'Código incorreto. Confira e digite de novo.'
}

export function pairWithServer(options: {
  keyPair: KeyPair
  name: string
  schemaVersion: number
  address: Address
  code: string
}): Promise<{ publicKey: string; name: string }> {
  const { address, code } = options
  return new Promise((resolve, reject) => {
    const secret = tcpStream(options.keyPair, address)
    let settled = false
    const finish = (error: string | null, result?: { publicKey: string; name: string }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      secret.end()
      setTimeout(() => secret.destroy(), 500)
      if (error) reject(new Error(error))
      else resolve(result!)
    }
    const unreachable =
      `Não foi possível conectar a ${address.host}. Confira se o Auri está aberto lá, com o ` +
      'compartilhamento ligado, e se os dois computadores estão na mesma rede.'
    const timer = setTimeout(() => finish(unreachable), PAIR_TIMEOUT_MS)

    secret.on('error', () => {})
    secret.on('connect', () => {
      const proof = pairingProof(code, 'client', secret.handshakeHash!).toString('hex')
      const hello: ClientMessage = {
        t: 'hello',
        protocol: PROTOCOL_VERSION,
        schema: options.schemaVersion,
        name: options.name,
        proof
      }
      secret.write(encode(hello))
    })
    secret.on('data', (data: Buffer) => {
      const message = decode(serverMessage, data)
      if (message?.t === 'reject') return finish(PAIR_ERRORS[message.reason])
      if (message?.t !== 'welcome') return finish('Resposta inesperada do outro computador.')
      const expected = pairingProof(code, 'server', secret.handshakeHash!)
      if (!message.proof || !proofMatches(expected, Buffer.from(message.proof, 'hex'))) {
        return finish('Não foi possível confirmar a identidade do outro computador.')
      }
      finish(null, { publicKey: secret.remotePublicKey!.toString('hex'), name: message.name })
    })
    secret.on('close', () => finish(unreachable))
  })
}

const PROBE_TIMEOUT_MS = 25_000

export function probeServer(options: {
  open: () => SecretStream
  serverKey: string
  serverName: string
  name: string
  schemaVersion: number
}): Promise<RemoteProbe> {
  const started = Date.now()
  const server = options.serverName
  return new Promise((resolve) => {
    let secret: SecretStream
    try {
      secret = options.open()
    } catch (error) {
      return resolve({ ok: false, error: (error as Error).message })
    }
    let settled = false
    const finish = (result: RemoteProbe): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      secret.destroy()
      resolve(result)
    }
    const unreachable: RemoteProbe = {
      ok: false,
      error:
        `Não conectou pela internet. ${server} pode estar sem internet ou com o acesso de fora ` +
        'desligado, ou a rede de um dos dois computadores bloqueia esse tipo de conexão.'
    }
    const timer = setTimeout(() => finish(unreachable), PROBE_TIMEOUT_MS)

    secret.on('error', () => {})
    secret.on('connect', () => {
      if (secret.remotePublicKey?.toString('hex') !== options.serverKey) return finish(unreachable)
      const hello: ClientMessage = {
        t: 'hello',
        protocol: PROTOCOL_VERSION,
        schema: options.schemaVersion,
        name: options.name
      }
      secret.write(encode(hello))
    })
    secret.on('data', (data: Buffer) => {
      const message = decode(serverMessage, data)
      if (message?.t === 'welcome') return finish({ ok: true, ms: Date.now() - started })
      if (message?.t === 'reject' && message.reason === 'version') {
        return finish({ ok: false, error: `${server} usa outra versão do Auri.` })
      }
      if (message?.t === 'reject') {
        return finish({ ok: false, error: `Este computador foi desconectado de ${server}.` })
      }
      finish(unreachable)
    })
    secret.on('close', () => finish(unreachable))
  })
}
