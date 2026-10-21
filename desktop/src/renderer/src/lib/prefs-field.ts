import { useSyncExternalStore } from 'react'
import { DEFAULT_UI_PREFS } from '@shared/api'
import type { UiPrefs } from '@shared/schemas'

type Key = Exclude<keyof UiPrefs, 'recepcao'>

export type PrefsField<K extends Key> = {
  get: () => UiPrefs[K]
  set: (next: UiPrefs[K]) => void
  subscribe: (listener: () => void) => () => void
}

export function prefsField<K extends Key>(key: K): PrefsField<K> {
  let value: UiPrefs[K] | undefined
  let watching = false
  const listeners = new Set<() => void>()
  const get = (): UiPrefs[K] => (value ??= window.prefs.initial?.[key] ?? DEFAULT_UI_PREFS[key])
  const notify = (): void => {
    for (const listener of listeners) listener()
  }
  return {
    get,
    set(next) {
      value = next
      window.prefs.save({ [key]: next })
      notify()
    },
    subscribe(listener) {
      if (!watching) {
        watching = true
        window.prefs.onChange((prefs) => {
          if (JSON.stringify(prefs[key]) === JSON.stringify(get())) return
          value = prefs[key]
          notify()
        })
      }
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

export function usePrefsField<K extends Key>(field: PrefsField<K>): UiPrefs[K] {
  return useSyncExternalStore(field.subscribe, field.get)
}
