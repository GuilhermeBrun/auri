import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { cn } from '@renderer/lib/utils'

function weekdayShort(date: Date): string {
  return format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
}

export function DateBlock({
  date,
  muted,
  className
}: {
  date: Date
  muted?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 flex-col items-center justify-center rounded-control tabular-nums',
        muted && 'text-ink-faint',
        className
      )}
    >
      <span className="text-[17px] leading-none font-semibold tracking-tight">
        {format(date, 'd')}
      </span>
      <span className={cn('mt-1 text-xs leading-none', muted ? 'text-ink-faint' : 'text-ink-soft')}>
        {weekdayShort(date)}
      </span>
    </span>
  )
}
