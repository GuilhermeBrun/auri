import { useSyncExternalStore } from 'react'
import type { Theme } from '@shared/schemas'

/**
 * Tema escolhido em Configurações. Quem aplica é o main (`nativeTheme`), e o CSS segue sozinho pelo
 * `prefers-color-scheme`; aqui fica só a escolha, para a tela mostrar a opção marcada mesmo depois
 * de sair e voltar (o `window.prefs.initial` é o valor da abertura e não muda).
 */
let current: Theme = window.prefs.initial.theme
const listeners = new Set<() => void>()

// configurações importadas trocam o tema por fora desta tela
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
