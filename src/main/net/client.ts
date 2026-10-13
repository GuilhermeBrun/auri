import net from 'node:net'
import SecretStream from '@hyperswarm/secret-stream'
import type { DataTopic, IpcResult } from '../../shared/api'
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

export type ClientStatus = 'connecting' | 'connected' | 'offline' | 'version' | 'revoked'

export type ClientHooks = {
  keyPair: KeyPair
  /** Nome deste computador, como o servidor o vê. */
  name: () => string
  schemaVersion: number
  /** Chave pública (hex) do servidor com que este computador pareou: só ela é aceita. */
  serverKey: string
  /** Nome do servidor, para as mensagens ("Sem conexão com Recepção"). */
  serverName: string
  /** Onde tentar, em ordem (ex.: o último endereço que funcionou, depois o que a busca achar). */
  addresses: () => Promise<Address[]>
  onStatus: (status: ClientStatus) => void
  onEvent: (topics: DataTopic[]) => void
  /** Conectou por este endereço (para tentar ele primeiro da próxima vez). */
  onConnected?: (address: Address) => void
}

const CONNECT_TIMEOUT_MS = 5_000
const REQUEST_TIMEOUT_MS = 15_000
const PING_MS = 10_000
/** Sem nenhuma mensagem do servidor por este tempo (nem `pong`), a conexão está morta. */
const DEAD_MS = 25_000
/** Espera entre tentativas, crescendo até o último valor. */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000]
/** Logo ao abrir, um pedido espera a primeira conexão por até este tempo antes de falhar. */
const FIRST_CONNECT_WAIT_MS = 6_000

type Outcome = 'ok' | 'fail' | 'version' | 'revoked'

/** JSON troca `undefined` por `null` em listas: argumentos opcionais do fim simplesmente não vão. */
function trimArgs(args: unknown[]): unknown[] {
  let end = args.length
  while (end > 0 && args[end - 1] === undefined) end--
  return args.slice(0, end)
}

/**
 * Cliente do papel "usa os dados de outro computador": mantém uma conexão com o servidor, se
 * reconecta sozinho (com espera crescente) e repassa os pedidos das telas. Pedidos nunca são
 * repetidos automaticamente: se a resposta se perde, repetir uma gravação poderia criar uma sessão
 * em dobro, então o pedido falha e a tela recarrega os dados quando a conexão volta.
 */
export function createSyncClient(hooks: ClientHooks): {
  request(channel: string, args: unknown[]): Promise<IpcResult<unknown>>
  status(): ClientStatus
  retry(): void
  close(): void
} {
  let status: ClientStatus = 'connecting'
  let stream: SecretStream | null = null
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

  function adopt(next: SecretStream, address: Address): void {
    stream = next
    attempt = 0
    lastHeard = Date.now()
    pingTimer = setInterval(() => {
      if (Date.now() - lastHeard > DEAD_MS) next.destroy()
      else next.write(encode({ t: 'ping' }))
    }, PING_MS)
    setStatus('connected')
    hooks.onConnected?.(address)
  }

  function dropped(): void {
    stream = null
    clearInterval(pingTimer)
    failPending(
      `A conexão com ${server} caiu antes da resposta. Confira se a alteração foi salva antes de repetir.`
    )
    if (closed) return
    setStatus('offline')
    schedule()
  }

  function connectOnce(address: Address): Promise<Outcome> {
    return new Promise((resolve) => {
      const socket = net.connect(address.port, address.host)
      socket.on('error', () => {})
      socket.setKeepAlive(true, 10_000)
      const secret = new SecretStream(true, socket, { keyPair: hooks.keyPair })
      let settled = false
      const finish = (outcome: Outcome): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (outcome !== 'ok') secret.destroy()
        resolve(outcome)
      }
      const timer = setTimeout(() => finish('fail'), CONNECT_TIMEOUT_MS)

      secret.on('error', () => {})
      secret.on('connect', () => {
        // outro computador neste endereço (ex.: o roteador deu o IP a outra máquina)
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
          if (closed) return finish('fail')
          adopt(secret, address)
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

  async function connectLoop(): Promise<void> {
    if (looping || closed || stream) return
    looping = true
    try {
      const addresses = await hooks.addresses().catch(() => [])
      for (const address of addresses) {
        if (closed) return
        const outcome = await connectOnce(address)
        if (outcome === 'ok') return
        if (outcome !== 'fail') return setStatus(outcome)
      }
      if (closed) return
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

/**
 * Pareia com um servidor usando o código mostrado na tela dele. Os dois lados provam que conhecem o
 * código sem mandá-lo (ver `pairingProof`), e a prova amarra as chaves desta conexão: se alguém
 * estiver no meio, não confere. Devolve a chave e o nome do servidor; a conexão de uso é aberta
 * depois, por `createSyncClient`.
 */
export function pairWithServer(options: {
  keyPair: KeyPair
  name: string
  schemaVersion: number
  address: Address
  code: string
}): Promise<{ publicKey: string; name: string }> {
  const { address, code } = options
  return new Promise((resolve, reject) => {
    const socket = net.connect(address.port, address.host)
    socket.on('error', () => {})
    const secret = new SecretStream(true, socket, { keyPair: options.keyPair })
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
