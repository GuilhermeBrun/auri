import { Bonjour, type Service } from 'bonjour-service'
import { networkInterfaces } from 'node:os'
import type { FoundServer } from '../../shared/api'
import { PROTOCOL_VERSION } from './protocol'

const TYPE = 'auri'

/** Endereços IPv4 deste computador na rede local (sem o 127.0.0.1). */
export function localAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address)
}

function toFound(service: Service): FoundServer | null {
  const txt = (service.txt ?? {}) as Record<string, unknown>
  const key = typeof txt.key === 'string' ? txt.key : null
  const host =
    service.addresses?.find((address) => /^\d+\.\d+\.\d+\.\d+$/.test(address)) ??
    service.referer?.address
  if (!key || !host || Number(txt.v) !== PROTOCOL_VERSION) return null
  return {
    name: typeof txt.nome === 'string' ? txt.nome : service.name,
    publicKey: key,
    host,
    port: service.port
  }
}

/**
 * Anúncio e busca na rede local (Bonjour/mDNS, o mesmo de impressoras e AirPlay). O anúncio leva só
 * o nome, a porta e a chave pública: nenhum dado. Funciona sem internet.
 */
export function createDiscovery(): {
  publish(options: { name: string; port: number; publicKey: string }): void
  unpublish(): void
  /** Procura por `ms` e devolve o que achou (sem repetir a mesma chave). */
  find(ms: number): Promise<FoundServer[]>
  destroy(): void
} {
  let bonjour: Bonjour | null = null
  let published: Service | null = null
  const instance = (): Bonjour => (bonjour ??= new Bonjour({}, () => {}))

  return {
    publish({ name, port, publicKey }) {
      published?.stop?.()
      // o nome do serviço precisa ser único na rede; o que aparece na tela vem do `nome`
      published = instance().publish({
        name: `Auri ${publicKey.slice(0, 8)}`,
        type: TYPE,
        port,
        txt: { key: publicKey, nome: name, v: String(PROTOCOL_VERSION) }
      })
      published.on('error', (error: Error) => console.error('[descoberta]', error.message))
    },
    unpublish() {
      published?.stop?.()
      published = null
    },
    find(ms) {
      return new Promise((resolve) => {
        const found = new Map<string, FoundServer>()
        const browser = instance().find({ type: TYPE }, (service) => {
          const server = toFound(service)
          if (server) found.set(server.publicKey, server)
        })
        setTimeout(() => {
          browser.stop()
          resolve([...found.values()])
        }, ms)
      })
    },
    destroy() {
      bonjour?.unpublishAll()
      bonjour?.destroy()
      bonjour = null
      published = null
    }
  }
}
