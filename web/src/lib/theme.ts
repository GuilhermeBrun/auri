export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

const listeners = new Set<() => void>()

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function currentTheme(): Theme {
  const theme = document.documentElement.dataset.theme
  return theme === 'light' || theme === 'dark' ? theme : 'system'
}

export function setTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  try {
    if (theme === 'system') localStorage.removeItem('auri-theme')
    else localStorage.setItem('auri-theme', theme)
  } catch {}
  for (const listener of listeners) listener()
}

export const nextTheme = (theme: Theme) => THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
