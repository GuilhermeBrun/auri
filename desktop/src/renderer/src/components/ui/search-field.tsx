import { Search, X } from 'lucide-react'
import { useRef, type Ref } from 'react'
import { cn } from '@renderer/lib/utils'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  autoFocus?: boolean
  className?: string
  ref?: Ref<HTMLInputElement>
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
  className,
  ref
}: SearchFieldProps): React.JSX.Element {
  const inner = useRef<HTMLInputElement | null>(null)
  const setRef = (el: HTMLInputElement | null): void => {
    inner.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 stroke-[1.75] text-ink-soft"
        aria-hidden="true"
      />
      <input
        ref={setRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value !== '') {
            e.stopPropagation()
            onChange('')
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        className="h-8 w-full appearance-none rounded-control bg-fill pr-8 pl-[34px] text-[13px] text-ink shadow-[inset_0_0_0_1px_transparent] transition-[background-color,box-shadow] duration-150 outline-none placeholder:text-ink-faint hover:bg-fill-hover focus:bg-surface focus:shadow-[inset_0_0_0_1px_var(--color-ink),0_0_0_3px_color-mix(in_srgb,var(--color-ink)_10%,transparent)] pointer-coarse:h-11 pointer-coarse:text-base [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            onChange('')
            inner.current?.focus()
          }}
          className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 animate-fade-in place-items-center rounded-chip text-ink-soft transition-colors hover:bg-fill-hover hover:text-ink pointer-coarse:size-9 [&_svg]:size-3.5 [&_svg]:stroke-[1.75]"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
