import { useQuery } from '@tanstack/react-query'
import { CorPonto } from '@renderer/components/ui/cor'
import { etiquetasQuery } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/utils'

export function EtiquetasEscolha({
  value,
  onChange
}: {
  value: number[]
  onChange: (value: number[]) => void
}): React.JSX.Element | null {
  const { data = [] } = useQuery(etiquetasQuery())
  const opcoes = data.filter((e) => !e.arquivado || value.includes(e.id))
  if (opcoes.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <span id="etiquetas-rotulo" className="text-xs font-medium text-ink">
        Etiquetas
      </span>
      <div role="group" aria-labelledby="etiquetas-rotulo" className="flex flex-wrap gap-1.5">
        {opcoes.map((e) => {
          const on = value.includes(e.id)
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((id) => id !== e.id) : [...value, e.id])}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-chip px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent pointer-coarse:h-10',
                on ? 'bg-selected text-ink shadow-lift' : 'bg-fill text-ink-soft hover:text-ink'
              )}
            >
              <CorPonto cor={e.cor} />
              {e.nome}
            </button>
          )
        })}
      </div>
    </div>
  )
}
