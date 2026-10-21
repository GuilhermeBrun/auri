import { useSyncExternalStore } from 'react'
import {
  paletteCss,
  sameColors as same,
  TEXT_SIZES,
  type TextSize,
  type ThemeColors
} from '@shared/aparencia'
import type { Theme, UiPrefs } from '@shared/schemas'

type Appearance = Pick<UiPrefs, 'theme' | 'textSize' | 'colors'>

let state: Appearance | null = null
let largest: TextSize = TEXT_SIZES[TEXT_SIZES.length - 1]
const listeners = new Set<() => void>()

function now(): Appearance {
  state ??= pick(window.prefs.initial)
  return state
}

function pick({ theme, textSize, colors }: UiPrefs): Appearance {
  return { theme, textSize, colors }
}

function paint(colors: ThemeColors): void {
  let style = document.getElementById('auri-cores')
  if (!style) {
    style = document.createElement('style')
    style.id = 'auri-cores'
    document.head.append(style)
  }
  style.textContent = paletteCss(colors)
}

function update(next: Appearance): void {
  if (!same(next.colors, now().colors)) paint(next.colors)
  state = next
  for (const listener of listeners) listener()
}

export function startAppearance(): void {
  paint(now().colors)
  window.prefs.onFit((next) => {
    if (next === largest) return
    largest = next
    for (const listener of listeners) listener()
  })
  window.prefs.onChange((prefs) => {
    const next = pick(prefs)
    const current = now()
    if (
      next.theme === current.theme &&
      next.textSize === current.textSize &&
      same(next.colors, current.colors)
    ) {
      return
    }
    update(next)
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function save(patch: Partial<Appearance>): void {
  const next = { ...now(), ...patch }
  update(next)
  window.prefs.save(patch)
}

export function setTheme(theme: Theme): void {
  if (theme !== now().theme) save({ theme })
}

export function setTextSize(textSize: TextSize): void {
  if (textSize !== now().textSize) save({ textSize })
}

export function setThemeColors(colors: ThemeColors): void {
  if (!same(colors, now().colors)) save({ colors })
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => now().theme)
}

export function useTextSize(): TextSize {
  return useSyncExternalStore(subscribe, () => now().textSize)
}

export function useThemeColors(): ThemeColors {
  return useSyncExternalStore(subscribe, () => now().colors)
}

export function useLargestTextSize(): TextSize {
  return useSyncExternalStore(subscribe, () => largest)
}

export function useZoom(): number {
  return Math.min(useTextSize(), useLargestTextSize())
}
