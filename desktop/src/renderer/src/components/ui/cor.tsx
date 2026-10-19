import { Check } from 'lucide-react'
import { COR_LABELS, CORES, type Cor } from '@shared/tipos'
import { cn } from '@renderer/lib/utils'

const BG: Record<Cor, string> = {
  grafite: 'bg-tipo-grafite',
  ardosia: 'bg-tipo-ardosia',
  azul: 'bg-tipo-azul',
  violeta: 'bg-tipo-violeta',
  rosa: 'bg-tipo-rosa',
  areia: 'bg-tipo-areia'
}

export function CorPonto({ cor, className }: { cor: Cor; className?: string }): React.JSX.Element {
  return (
    <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', BG[cor], className)} />
  )
}

export function CorEscolha({
  value,
  onChange,
  label
}: {
  value: Cor
  onChange: (cor: Cor) => void
  label: string
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {CORES.map((cor) => (
        <button
          key={cor}
          type="button"
          role="radio"
          aria-checked={value === cor}
          aria-label={COR_LABELS[cor]}
          title={COR_LABELS[cor]}
          onClick={() => onChange(cor)}
          className={cn(
            'grid size-7 place-items-center rounded-full transition-[box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            value === cor && 'shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-ink)]'
          )}
        >
          <span className={cn('grid size-6 place-items-center rounded-full', BG[cor])}>
            {value === cor && <Check className="size-3.5 stroke-[2.5] text-white" aria-hidden />}
          </span>
        </button>
      ))}
    </div>
  )
}
