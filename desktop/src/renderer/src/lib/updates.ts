import { useSyncExternalStore } from 'react'
import type { UpdateState } from '@shared/api'

/** null até a primeira resposta do main. */
let snapshot: UpdateState | null = null
let started = false
const listeners = new Set<() => void>()

function set(state: UpdateState): void {
  snapshot = state
  for (const listener of listeners) listener()
}

// Liga ao main só quando alguma tela usa: as telas testadas sozinhas não têm window.updates.
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

/** Estado da atualização do Auri (Configurações › Geral), atualizado pelo main. */
export function useUpdates(): UpdateState | null {
  return useSyncExternalStore(subscribe, () => snapshot)
}

/** Atualiza já com a resposta de uma ação, sem esperar o aviso do main. */
export function setUpdateState(state: UpdateState): void {
  set(state)
}
