import { createContext, useContext, type ReactNode } from 'react'

export type ToastInput = {
  title: string
  /** Segunda linha em cinza: sobre quem ou o quê foi a ação. */
  description?: string
  /** Padrão: um check que se desenha. */
  icon?: ReactNode
  /**
   * Um botão no aviso, quase sempre "Desfazer" depois de excluir ou inativar. Com ação o aviso fica
   * 6s em vez de 4s. `altText` diz ao leitor de tela como fazer o mesmo sem o aviso.
   */
  action?: { label: string; icon?: ReactNode; altText: string; onClick: () => void }
}

export const ToastContext = createContext<(toast: ToastInput) => void>(() => {})

/** Mostra um aviso de confirmação ("Paciente cadastrado"). Vale de qualquer tela, mesmo uma que se fecha em seguida. */
export function useToast(): (toast: ToastInput) => void {
  return useContext(ToastContext)
}
