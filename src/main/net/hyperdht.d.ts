// Tipos mínimos do que o Auri usa de hyperdht (a biblioteca não traz os seus).
declare module 'hyperdht' {
  import type { EventEmitter } from 'events'
  import type SecretStream from '@hyperswarm/secret-stream'

  type KeyPair = { publicKey: Buffer; secretKey: Buffer }
  type Bootstrap = (string | { host: string; port: number })[]

  class Server extends EventEmitter {
    listen(keyPair: KeyPair): Promise<void>
    close(): Promise<void>
  }

  /**
   * Nó da rede distribuída do Hyperswarm. Encontra outro nó pela chave pública e abre uma conexão
   * UDP direta entre os dois (furando o NAT), já cifrada (Noise).
   */
  class DHT extends EventEmitter {
    constructor(options?: { bootstrap?: Bootstrap; keyPair?: KeyPair; host?: string })
    static keyPair(seed?: Buffer): KeyPair
    /** O roteador deste computador bloqueia conexões que chegam de fora. */
    readonly firewalled: boolean
    /** O roteador troca a porta a cada destino (NAT "simétrico"): furar fica difícil. */
    readonly randomized: boolean
    ready(): Promise<void>
    fullyBootstrapped(): Promise<void>
    createServer(
      options: { firewall?: (remotePublicKey: Buffer, payload: unknown) => boolean },
      onConnection: (socket: SecretStream) => void
    ): Server
    connect(remotePublicKey: Buffer, options?: { keyPair?: KeyPair }): SecretStream
    destroy(options?: { force?: boolean }): Promise<void>
  }

  export = DHT
}

declare module 'hyperdht/testnet' {
  import type DHT from 'hyperdht'

  type Testnet = {
    bootstrap: { host: string; port: number }[]
    nodes: DHT[]
    destroy(): Promise<void>
  }

  function createTestnet(size?: number): Promise<Testnet>
  export = createTestnet
}
