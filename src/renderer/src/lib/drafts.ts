import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Draft = { values: unknown; base: string | null }

/** Só na memória: fechar o Auri descarta. */
const drafts = new Map<string, Draft>()

/**
 * Guarda o que foi digitado e não salvo ao sair da tela (trocar de aba na ficha, ir à agenda) e
 * devolve ao voltar, como um rascunho. `base` é o `updated_at` do registro aberto: se ele mudar
 * enquanto o rascunho espera (outro computador salvou), o rascunho é esquecido, para não gravar por
 * cima do que a outra pessoa escreveu sem ver.
 *
 * `take` devolve o rascunho uma única vez (quem chama aplica sobre os dados carregados);
 * `discard` é para depois de salvar.
 */
export function useDraft<T>(
  key: string | null,
  base: string | null | undefined,
  dirty: boolean,
  getValues: () => T
): { take: () => T | null; discard: () => void } {
  // lido na montagem: no StrictMode a desmontagem de teste logo em seguida apaga a entrada
  const [stored] = useState(() => (key ? drafts.get(key) : undefined))
  const taken = useRef(false)
  const state = useRef({ dirty, base, getValues, discarded: false })
  // o último valor de cada um, para a desmontagem (que roda depois do último render)
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

  // o mesmo objeto a cada render: quem chama o usa como dependência do efeito que carrega os dados
  return useMemo(() => ({ take, discard }), [take, discard])
}
