import { createContext, useContext, type ReactNode } from 'react'

export type ToastInput = {
  title: string
  description?: string
  icon?: ReactNode
  action?: { label: string; icon?: ReactNode; altText: string; onClick: () => void }
}

export const ToastContext = createContext<(toast: ToastInput) => void>(() => {})

export function useToast(): (toast: ToastInput) => void {
  return useContext(ToastContext)
}
