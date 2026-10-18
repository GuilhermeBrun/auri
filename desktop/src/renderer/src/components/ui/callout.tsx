import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

const TONES = {
  neutral: { box: 'bg-fill', icon: 'text-ink-soft', body: 'text-ink-soft', Icon: Info },
  warning: { box: 'bg-warning-soft', icon: 'text-warning', body: 'text-ink', Icon: TriangleAlert },
  danger: { box: 'bg-danger-soft', icon: 'text-danger', body: 'text-ink', Icon: CircleAlert }
}

type CalloutProps = {
  /** neutral: explicação · warning: algo parou, não é erro · danger: uma ação falhou. */
  tone?: keyof typeof TONES
  title: ReactNode
  /** O que fazer; pode trazer botões e outros controles embaixo do texto. */
  children?: ReactNode
  /** Um botão `secondary` `sm` à direita. */
  action?: ReactNode
  className?: string
}

/**
 * Aviso que fica na página até ser resolvido: ícone, título, texto e, se houver, uma ação. Fundo
 * suave inteiro, nunca barra lateral colorida. Erro de gravação fica aqui (ou no campo), nunca num
 * aviso que some sozinho.
 */
export function Callout({
  tone = 'neutral',
  title,
  children,
  action,
  className
}: CalloutProps): React.JSX.Element {
  const t = TONES[tone]
  return (
    <div
      role={tone === 'neutral' ? 'note' : 'alert'}
      className={cn(
        'flex animate-error-in items-start gap-3 rounded-card py-3 pr-3 pl-4',
        t.box,
        className
      )}
    >
      <t.Icon className={cn('mt-0.5 size-4 shrink-0 stroke-[1.75]', t.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-5 font-medium text-ink">{title}</div>
        {children && <div className={cn('text-xs leading-4', t.body)}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
