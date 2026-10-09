import { RotateCw, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'

type ErrorStateProps = {
  title: string
  /** Texto técnico do erro (ex.: "database is locked"): fica em cinza, para quem der suporte. */
  detail?: string
  children?: ReactNode
  /** Quando existe, mostra o botão "Tentar de novo". */
  onRetry?: () => void
}

/**
 * Falha ao carregar uma tela inteira. Ocupa o lugar do conteúdo (uma grade vazia pareceria "sem
 * agendamentos") e sempre oferece uma saída. Mesma forma do `EmptyState`, com o ícone em vermelho.
 */
export function ErrorState({
  title,
  detail,
  children,
  onRetry
}: ErrorStateProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex h-full min-h-80 flex-col items-center justify-center px-6 text-center"
    >
      <span className="mb-3 grid size-10 place-items-center rounded-card bg-danger/8 text-danger [&_svg]:size-[18px] [&_svg]:stroke-[1.75]">
        <TriangleAlert aria-hidden="true" />
      </span>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {children && <p className="mt-1 max-w-[46ch] text-[13px] text-ink-soft">{children}</p>}
      {detail && <p className="mt-2 max-w-[46ch] text-xs text-ink-faint">{detail}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RotateCw /> Tentar de novo
        </Button>
      )}
    </div>
  )
}
