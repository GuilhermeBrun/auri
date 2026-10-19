import { useSyncExternalStore } from 'react'
import type { ConnectionInfo } from '@shared/api'

type Snapshot = {
  info: ConnectionInfo | null
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

export function useConnection(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot)
}
