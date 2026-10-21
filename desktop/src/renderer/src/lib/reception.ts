import { useSyncExternalStore } from 'react'

let current = window.prefs.initial.recepcao
const listeners = new Set<() => void>()

window.prefs.onChange((prefs) => {
  if (prefs.recepcao === current) return
  current = prefs.recepcao
  for (const listener of listeners) listener()
})

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useReception(): boolean {
  return useSyncExternalStore(subscribe, () => current)
}
