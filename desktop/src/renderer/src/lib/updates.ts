import { useSyncExternalStore } from 'react'
import type { UpdateState } from '@shared/api'

let snapshot: UpdateState | null = null
let started = false
const listeners = new Set<() => void>()

function set(state: UpdateState): void {
  snapshot = state
  for (const listener of listeners) listener()
}

function start(): void {
  if (started) return
  started = true
  window.updates.onChange(set)
  void window.updates.info().then(set)
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUpdates(): UpdateState | null {
  return useSyncExternalStore(subscribe, () => snapshot)
}

export function setUpdateState(state: UpdateState): void {
  set(state)
}
