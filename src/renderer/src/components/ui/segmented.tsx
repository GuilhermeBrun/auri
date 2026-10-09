import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@renderer/lib/utils'

type SegmentedProps<T extends string> = {
  /** Nome do grupo para leitor de tela ("Visualização"). */
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}

/**
 * Seletor de uma opção entre poucas: trilho cinza e, sobre a opção ativa, um bloco branco que
 * desliza até a nova opção. O bloco é medido na opção ativa (as larguras seguem o texto), e só
 * aparece depois da primeira medida, então não há deslize na abertura. Em "Reduzir movimento" a
 * transição fica instantânea (ver main.css).
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: SegmentedProps<T>): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = (): void => {
      const active = track.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (!active) return
      const next = { x: active.offsetLeft, width: active.offsetWidth }
      setThumb((prev) => (prev?.x === next.x && prev.width === next.width ? prev : next))
    }
    measure()
    // a fonte terminando de carregar ou a janela mudando de tamanho alteram as larguras
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [value])

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label={label}
      className="relative flex rounded-control bg-fill p-0.5"
    >
      {thumb && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0.5 left-0 rounded-chip bg-surface shadow-lift transition-[translate,width] duration-250 ease-slide"
          style={{ translate: `${thumb.x}px 0`, width: thumb.width }}
        />
      )}
      {options.map(([optionValue, text]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          aria-pressed={value === optionValue}
          className={cn(
            'relative h-7 rounded-chip px-3 text-xs font-medium text-ink-soft transition-colors hover:text-ink pointer-coarse:h-10',
            value === optionValue && 'text-ink'
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
