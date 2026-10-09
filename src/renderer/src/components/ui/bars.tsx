import { cn } from '@renderer/lib/utils'

/** Alturas das três barras do logo (esquerda, centro, direita). */
const HEIGHTS = ['56%', '100%', '72%']

type BarsProps = {
  className?: string
  /** Barras que pulsam, para dizer "carregando". Só movem `transform`. */
  animated?: boolean
}

/**
 * As três barras do logo, usadas como motivo do app: carregando e estados vazios. A cor vem do
 * texto (`currentColor`) e o tamanho, da altura que o pai der (`h-4`, `h-12`…).
 */
export function Bars({ className, animated }: BarsProps): React.JSX.Element {
  return (
    <span aria-hidden="true" className={cn('inline-flex h-4 items-center gap-[0.22em]', className)}>
      {HEIGHTS.map((height, i) => (
        <span
          key={i}
          className={cn('w-[0.22em] rounded-full bg-current', animated && 'animate-beat')}
          style={{ height, animationDelay: animated ? `${i * 130}ms` : undefined }}
        />
      ))}
    </span>
  )
}

/**
 * Carregando uma tela inteira. Só aparece depois de 400ms: com o banco local a resposta é quase
 * instantânea, e um indicador que pisca só atrapalha.
 */
export function Loading({ label = 'Carregando…' }: { label?: string }): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex h-full min-h-60 animate-[fade-in_200ms_ease-out_400ms_backwards] flex-col items-center justify-center gap-3 text-ink-faint"
    >
      <Bars animated className="h-6 text-ink-soft" />
      <span className="text-xs">{label}</span>
    </div>
  )
}
