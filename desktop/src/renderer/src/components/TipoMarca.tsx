import type { Cor } from '@shared/tipos'
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
