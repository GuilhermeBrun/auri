import { useEffect, useSyncExternalStore } from 'react'
import { formatPhone } from '@shared/masks'

type Receiving = { id: number; texto: string } | null

let current: Receiving = null
let queue: string[] = []
let next = 1
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function openReceive(texto = ''): void {
  if (current) {
    if (texto && !queue.includes(texto) && current.texto !== texto) queue.push(texto)
    return
  }
  current = { id: next++, texto }
  emit()
}

export function closeReceive(): void {
  const following = queue.shift()
  current = following ? { id: next++, texto: following } : null
  emit()
}

export function useReceiving(): Receiving {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}

export function phoneOf(numero: string): string {
  const local = numero.startsWith('55') && numero.length >= 12 ? numero.slice(2) : numero
  return formatPhone(local)
}

export function signedLocal(unix: number, fuso: number): Date {
  const local = new Date((unix + fuso * 60) * 1000)
  return new Date(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    local.getUTCHours(),
    local.getUTCMinutes()
  )
}

export function useIncomingTerms(): void {
  useEffect(() => {
    const take = (): void => {
      void window.api.terms
        .takeIncoming()
        .then((list) => list.forEach((texto) => openReceive(texto)))
    }
    take()
    return window.api.terms.onIncoming(take)
  }, [])
}
