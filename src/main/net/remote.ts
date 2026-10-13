import type SecretStream from '@hyperswarm/secret-stream'
import DHT from 'hyperdht'
import type { RemoteReach } from '../../shared/api'
import type { KeyPair } from './server'

export type Bootstrap = { host: string; port: number }[]

/** Sem resposta da rede neste tempo, conta como sem internet e tenta de novo mais tarde. */
const LISTEN_TIMEOUT_MS = 20_000
const RETRY_MS = 60_000

function reachOf(dht: DHT): RemoteReach {
  if (!dht.firewalled) return 'open'
  return dht.randomized ? 'restricted' : 'likely'
}

/**
 * Acesso de fora da clínica, do lado de quem guarda os dados: escuta na rede distribuída do
 * Hyperswarm com a mesma chave da rede local. Quem conhece a chave (só computadores pareados) acha
 * este computador pela rede e as duas pontas furam o NAT dos roteadores, sem porta aberta e sem
 * servidor no meio; a conexão chega cifrada e segue o mesmo caminho das da rede local (`attach`).
 * Chaves não pareadas são recusadas antes da conexão (`firewall`). O pareamento continua só na
 * rede local: quem ainda não pareou não tem como saber a chave.
 */
export function createRemoteListener(options: {
  keyPair: KeyPair
  isPaired: (publicKey: string) => boolean
  attach: (stream: SecretStream) => void
  onReach: (reach: RemoteReach) => void
  /** Só nos testes: rede local em vez dos nós públicos. */
  bootstrap?: Bootstrap
}): { reach(): RemoteReach; close(): Promise<void> } {
  let reach: RemoteReach = 'starting'
  let dht: DHT | null = null
  let closed = false
  let retry: NodeJS.Timeout | undefined

  const setReach = (next: RemoteReach): void => {
    if (reach === next) return
    reach = next
    options.onReach(next)
  }

  async function start(): Promise<void> {
    const node = new DHT({ bootstrap: options.bootstrap })
    dht = node
    const server = node.createServer(
      // true recusa: só computadores pareados
      { firewall: (remote) => !options.isPaired(remote.toString('hex')) },
      (socket) => options.attach(socket)
    )
    try {
      let timer: NodeJS.Timeout | undefined
      await Promise.race([
        server.listen(options.keyPair),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('sem resposta')), LISTEN_TIMEOUT_MS)
        })
      ]).finally(() => clearTimeout(timer))
      if (closed) return
      setReach(reachOf(node))
      // o roteador pode mudar (outra rede, outro IP): o hyperdht se reanuncia sozinho
      node.on('nat-update', () => setReach(reachOf(node)))
    } catch (error) {
      console.error(`[acesso de fora] ${(error as Error).message}`)
      dht = null
      await node.destroy({ force: true }).catch(() => {})
      if (closed) return
      setReach('offline')
      retry = setTimeout(() => void start(), RETRY_MS)
    }
  }

  void start()

  return {
    reach: () => reach,
    async close() {
      closed = true
      clearTimeout(retry)
      await dht?.destroy({ force: true }).catch(() => {})
      dht = null
    }
  }
}

/**
 * Lado de quem usa os dados: um nó da rede distribuída para chegar ao outro computador pela
 * internet. Criado só quando preciso e reaproveitado entre tentativas.
 */
export function createRemoteDialer(options: { keyPair: KeyPair; bootstrap?: Bootstrap }): {
  dial(serverKey: string): SecretStream
  close(): Promise<void>
} {
  let dht: DHT | null = null
  return {
    dial(serverKey) {
      dht ??= new DHT({ bootstrap: options.bootstrap })
      return dht.connect(Buffer.from(serverKey, 'hex'), { keyPair: options.keyPair })
    },
    async close() {
      await dht?.destroy({ force: true }).catch(() => {})
      dht = null
    }
  }
}
