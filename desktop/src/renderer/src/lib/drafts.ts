import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Draft = { values: unknown; base: string | null }

const drafts = new Map<string, Draft>()

export function useDraft<T>(
  key: string | null,
  base: string | null | undefined,
  dirty: boolean,
  getValues: () => T
): { take: () => T | null; discard: () => void } {
  const [stored] = useState(() => (key ? drafts.get(key) : undefined))
  const taken = useRef(false)
  const state = useRef({ dirty, base, getValues, discarded: false })
  useEffect(() => {
    state.current.dirty = dirty
    state.current.base = base
    state.current.getValues = getValues
  })

  useEffect(() => {
    if (!key) return
    const current = state.current
    current.discarded = false
    return () => {
      if (current.dirty && !current.discarded && current.base !== undefined) {
        drafts.set(key, { values: current.getValues(), base: current.base })
      } else {
        drafts.delete(key)
      }
    }
  }, [key])

  const take = useCallback((): T | null => {
    if (taken.current || !stored || stored.base !== base) return null
    taken.current = true
    return stored.values as T
  }, [stored, base])

  const discard = useCallback((): void => {
    state.current.discarded = true
    if (key) drafts.delete(key)
  }, [key])

  return useMemo(() => ({ take, discard }), [take, discard])
}
