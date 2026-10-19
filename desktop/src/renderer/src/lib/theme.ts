import { useSyncExternalStore } from 'react'
import type { Theme } from '@shared/schemas'

let current: Theme = window.prefs.initial.theme
const listeners = new Set<() => void>()

window.prefs.onChange((prefs) => {
  if (prefs.theme === current) return
  current = prefs.theme
  for (const listener of listeners) listener()
})

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setTheme(theme: Theme): void {
  if (theme === current) return
  current = theme
  window.prefs.save({ theme })
  for (const listener of listeners) listener()
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => current)
}
