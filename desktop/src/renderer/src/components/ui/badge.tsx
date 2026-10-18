import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

const TONES = {
  neutral: 'bg-fill text-ink-soft',
  /** Ainda sem dado ("Sem registro"). */
  outline: 'text-ink-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
  /** Raro: "Hoje", "Agora". */
  strong: 'bg-solid text-on-solid',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger'
}

type BadgeProps = {
  tone?: keyof typeof TONES
  /** Ícone de 12px (em `warning` e `danger`). */
  icon?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * Selo de uma ou duas palavras ao lado de um nome ("Inativo", "Faltou"). Sempre com texto: a cor
 * só reforça. 20px, `radius-chip`.
 */
export function Badge({
  tone = 'neutral',
  icon,
  className,
  children
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-chip px-1.5 text-xs leading-4 font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:stroke-2',
        TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  )
}
