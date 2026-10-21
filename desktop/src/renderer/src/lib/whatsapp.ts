import { useEffect, useState, useSyncExternalStore } from 'react'

let enabled: boolean | null = null
let watching = false
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function current(): boolean {
  enabled ??= window.prefs.initial?.whatsapp ?? true
  return enabled
}

function subscribe(listener: () => void): () => void {
  if (!watching) {
    watching = true
    window.prefs.onChange((prefs) => {
      if (prefs.whatsapp === enabled) return
      enabled = prefs.whatsapp
      notify()
    })
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWhatsAppEnabled(): boolean {
  return useSyncExternalStore(subscribe, current)
}

export function setWhatsAppEnabled(on: boolean): void {
  if (on === current()) return
  enabled = on
  window.prefs.save({ whatsapp: on })
  notify()
}

export function useWhatsAppUnread(on: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!on) return
    void window.whatsapp.unread().then(setCount)
    return window.whatsapp.onUnread(setCount)
  }, [on])
  return on ? count : 0
}
