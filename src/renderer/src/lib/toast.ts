import { createContext, useContext, type ReactNode } from 'react'

export type ToastInput = {
  title: string
  /** Segunda linha em cinza: sobre quem ou o quê foi a ação. */
  description?: string
  /** Padrão: um check que se desenha. */
  icon?: ReactNode
}

export const ToastContext = createContext<(toast: ToastInput) => void>(() => {})

/** Mostra um aviso de confirmação ("Paciente cadastrado"). Vale de qualquer tela, mesmo uma que se fecha em seguida. */
export function useToast(): (toast: ToastInput) => void {
  return useContext(ToastContext)
}
