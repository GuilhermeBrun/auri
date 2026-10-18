import { useState, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'

type ConfirmActionProps = {
  /** Primeiro botão (`danger-ghost`), com ícone se houver: "Excluir agendamento". */
  children: ReactNode
  /** A pergunta do segundo passo ("Excluir este agendamento?"). */
  question: string
  /** O verbo de novo, nunca "Sim" ("Excluir", "Remover"). */
  confirmLabel: ReactNode
  /** Desiste e volta ao primeiro botão. "Cancelar" por padrão; num rodapé que já tem Cancelar, "Manter". */
  cancelLabel?: string
  onConfirm: () => void
  loading?: boolean
  size?: 'sm' | 'md'
  /** Controlado por fora, quando o resto da tela muda durante a confirmação. */
  confirming?: boolean
  onConfirmingChange?: (confirming: boolean) => void
}

/**
 * Confirmação em dois passos no próprio lugar, para apagar sem abrir outro diálogo: o botão vira
 * a pergunta, com desistir e confirmar, num fade. Depois, um aviso com "Desfazer" quando der.
 */
export function ConfirmAction({
  children,
  question,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  loading,
  size = 'sm',
  confirming: controlled,
  onConfirmingChange
}: ConfirmActionProps): React.JSX.Element {
  const [own, setOwn] = useState(false)
  const confirming = controlled ?? own
  const set = (next: boolean): void => {
    setOwn(next)
    onConfirmingChange?.(next)
  }
  if (!confirming) {
    return (
      <Button variant="danger-ghost" size={size} onClick={() => set(true)}>
        {children}
      </Button>
    )
  }
  return (
    <div className="flex animate-fade-in items-center gap-2">
      <span className="mr-0.5 text-xs text-ink-soft">{question}</span>
      <Button variant="secondary" size={size} onClick={() => set(false)} autoFocus>
        {cancelLabel}
      </Button>
      <Button variant="danger" size={size} loading={loading} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  )
}
