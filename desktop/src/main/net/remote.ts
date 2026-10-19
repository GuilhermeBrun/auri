import type SecretStream from '@hyperswarm/secret-stream'
import DHT from 'hyperdht'
import type { RemoteReach } from '../../shared/api'
import type { KeyPair } from './server'

export type Bootstrap = { host: string; port: number }[]

const LISTEN_TIMEOUT_MS = 20_000
const RETRY_MS = 60_000

function reachOf(dht: DHT): RemoteReach {
  if (!dht.firewalled) return 'open'
  return dht.randomized ? 'restricted' : 'likely'
}

export function createRemoteListener(options: {
  keyPair: KeyPair
  isPaired: (publicKey: string) => boolean
  attach: (stream: SecretStream) => void
  onReach: (reach: RemoteReach) => void
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
