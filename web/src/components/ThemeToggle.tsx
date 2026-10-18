import { useSyncExternalStore } from 'react'
import { currentTheme, nextTheme, setTheme, subscribeTheme, type Theme } from '../lib/theme'
import { Monitor, Moon, Sun } from './icons'

const LABELS: Record<Theme, string> = { system: 'igual ao sistema', light: 'claro', dark: 'escuro' }

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'system' as const)
  const next = nextTheme(theme)
  return (
    <button
      type="button"
      className="theme-toggle"
      data-current={theme}
      aria-label={`Tema: ${LABELS[theme]}. Mudar para ${LABELS[next]}`}
      title={`Tema: ${LABELS[theme]}`}
      onClick={() => setTheme(next)}
    >
      <span data-theme-icon="system">
        <Monitor />
      </span>
      <span data-theme-icon="light">
        <Sun />
      </span>
      <span data-theme-icon="dark">
        <Moon />
      </span>
    </button>
  )
}
