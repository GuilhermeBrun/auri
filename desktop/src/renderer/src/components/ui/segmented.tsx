import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@renderer/lib/utils'

type SegmentedProps<T extends string> = {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  disabled?: readonly T[]
  onChange: (value: T) => void
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange
}: SegmentedProps<T>): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = (): void => {
      const active = track.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (!active) return setThumb(null)
      const next = { x: active.offsetLeft, width: active.offsetWidth }
      setThumb((prev) => (prev?.x === next.x && prev.width === next.width ? prev : next))
    }
    measure()
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
          className="absolute inset-y-0.5 left-0 rounded-chip bg-selected shadow-lift transition-[translate,width] duration-250 ease-slide"
          style={{ translate: `${thumb.x}px 0`, width: thumb.width }}
        />
      )}
      {options.map(([optionValue, text]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          aria-pressed={value === optionValue}
          disabled={disabled?.includes(optionValue)}
          className={cn(
            'relative h-7 rounded-chip px-3 text-xs font-medium text-ink-soft transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-40 pointer-coarse:h-10',
            value === optionValue && 'text-ink'
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
