// Tipos mínimos do que o Auri usa de @hyperswarm/secret-stream (a biblioteca não traz os seus).
declare module '@hyperswarm/secret-stream' {
  import type { EventEmitter } from 'events'
  import type { Duplex } from 'stream'

  type KeyPair = { publicKey: Buffer; secretKey: Buffer }

  /**
   * Fluxo cifrado (Noise + libsodium) sobre outro fluxo. Cada `write` chega inteiro como um evento
   * `data` do outro lado. Emite `connect` quando o handshake termina.
   */
  class SecretStream extends EventEmitter {
    constructor(
      isInitiator: boolean,
      rawStream?: Duplex | null,
      options?: { keyPair?: KeyPair; pattern?: string; remotePublicKey?: Buffer }
    )
    static keyPair(seed?: Buffer): KeyPair
    readonly isInitiator: boolean
    readonly publicKey: Buffer | null
    readonly remotePublicKey: Buffer | null
    readonly handshakeHash: Buffer | null
    readonly destroyed: boolean
    write(data: Buffer): boolean
    end(): void
    destroy(error?: Error): void
  }

  export = SecretStream
}
