import type { ReactNode } from 'react'
import { AuriSymbol } from '@renderer/components/ui/brand'

type EmptyStateProps = {
  /** Ícone num quadrado arredondado; sem ele, o símbolo da Auri. */
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}

/**
 * Lista vazia: diz o que está acontecendo, ensina o que fazer e oferece o próximo passo.
 * Primeiro uso e "nada encontrado" são telas diferentes e não devem se parecer.
 */
export function EmptyState({ icon, title, children, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex h-full min-h-80 animate-fade-in flex-col items-center justify-center px-6 text-center">
      {icon ? (
        <span className="mb-3 grid size-10 place-items-center rounded-card bg-accent-soft text-ink-soft [&_svg]:size-[18px] [&_svg]:stroke-[1.75]">
          {icon}
        </span>
      ) : (
        <AuriSymbol className="mb-4 size-10 text-ink-soft" />
      )}
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {children && <p className="mt-1 max-w-[42ch] text-[13px] text-ink-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
