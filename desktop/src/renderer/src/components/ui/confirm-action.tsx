import { useState, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'

type ConfirmActionProps = {
  children: ReactNode
  question: string
  confirmLabel: ReactNode
  cancelLabel?: string
  onConfirm: () => void
  loading?: boolean
  size?: 'sm' | 'md'
  confirming?: boolean
  onConfirmingChange?: (confirming: boolean) => void
}

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
