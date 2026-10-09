import type { ReactNode } from 'react'
import { Bars } from '@renderer/components/ui/bars'

type EmptyStateProps = {
  /** Ícone num quadrado arredondado; sem ele, as três barras do logo. */
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
    <div className="flex h-full min-h-80 flex-col items-center justify-center px-6 text-center">
      {icon ? (
        <span className="mb-3 grid size-10 place-items-center rounded-card bg-accent-soft text-ink-soft [&_svg]:size-[18px] [&_svg]:stroke-[1.75]">
          {icon}
        </span>
      ) : (
        <Bars className="mb-4 h-10 text-line-strong" />
      )}
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {children && <p className="mt-1 max-w-[42ch] text-[13px] text-ink-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
