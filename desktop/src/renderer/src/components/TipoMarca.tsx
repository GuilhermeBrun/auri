import type { Cor, EtiquetaResumo } from '@shared/tipos'
import { CorPonto } from '@renderer/components/ui/cor'
import { cn } from '@renderer/lib/utils'

export function TipoMarca({
  nome,
  cor,
  className
}: {
  nome: string
  cor: Cor
  className?: string
}): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-soft', className)}>
      <CorPonto cor={cor} />
      {nome}
    </span>
  )
}

export function EtiquetasMarca({
  etiquetas,
  className
}: {
  etiquetas: EtiquetaResumo[]
  className?: string
}): React.JSX.Element | null {
  if (etiquetas.length === 0) return null
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {etiquetas.map((e) => (
        <span
          key={e.id}
          className="inline-flex items-center gap-1 rounded-chip bg-fill px-1.5 py-px text-xs text-ink-soft"
        >
          <CorPonto cor={e.cor} className="size-1.5" />
          {e.nome}
        </span>
      ))}
    </span>
  )
}
