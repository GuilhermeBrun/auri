import { useSyncExternalStore } from 'react'
import type { ConnectionInfo } from '@shared/api'

type Snapshot = {
  /** null até a primeira resposta do main (uma fração de segundo na abertura). */
  info: ConnectionInfo | null
  /**
   * Já conectou ao outro computador desde que o app abriu (ou desde que trocou de computador).
   * Separa "nunca conectou" (a tela inteira avisa) de "caiu" (os dados ficam, com um aviso).
   */
  everConnected: boolean
}

let snapshot: Snapshot = { info: null, everConnected: false }
const listeners = new Set<() => void>()

function set(info: ConnectionInfo): void {
  const sameServer =
    snapshot.info?.role === info.role && snapshot.info?.server?.publicKey === info.server?.publicKey
  snapshot = {
    info,
    everConnected: info.status === 'connected' || (sameServer && snapshot.everConnected)
  }
  for (const listener of listeners) listener()
}

window.connection.onChange(set)
void window.connection.info().then(set)

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Papel deste computador e estado da conexão com o outro (Configurações / Conexão). */
export function useConnection(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot)
}
