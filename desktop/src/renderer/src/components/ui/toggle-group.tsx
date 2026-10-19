import { cn } from '@renderer/lib/utils'

type ToggleGroupProps<T extends string | number> = {
  label: string
  value: readonly T[]
  options: readonly (readonly [T, string])[]
  onChange: (value: T[]) => void
}

export function ToggleGroup<T extends string | number>({
  label,
  value,
  options,
  onChange
}: ToggleGroupProps<T>): React.JSX.Element {
  const toggle = (option: T): void =>
    onChange(
      options.map(([v]) => v).filter((v) => (v === option ? !value.includes(v) : value.includes(v)))
    )
  return (
    <div role="group" aria-label={label} className="flex w-fit rounded-control bg-fill p-0.5">
      {options.map(([optionValue, text]) => {
        const pressed = value.includes(optionValue)
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => toggle(optionValue)}
            aria-pressed={pressed}
            className={cn(
              'h-7 rounded-chip px-3 text-xs font-medium text-ink-soft transition-[background-color,color,box-shadow] duration-150 hover:text-ink pointer-coarse:h-10',
              pressed && 'bg-selected text-ink shadow-lift'
            )}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}
