import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatAge } from '@shared/dates'
import { createPatientSearch } from '@shared/search'
import { Avatar } from '@renderer/components/ui/avatar'
import { Button } from '@renderer/components/ui/button'
import { optionClass, popupClass, trailingIconClass } from '@renderer/components/ui/field-style'
import { Input } from '@renderer/components/ui/input'
import { patientsQuery } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/utils'

export type PatientOption = { id: number; nome: string }

type Props = {
  value: PatientOption | null
  onChange: (value: PatientOption | null) => void
  invalid?: boolean
  autoFocus?: boolean
}

const MAX_RESULTS = 8

export function PatientCombobox({ value, onChange, invalid, autoFocus }: Props): React.JSX.Element {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const chipRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const refocus = useRef<'chip' | 'input' | null>(null)
  useLayoutEffect(() => {
    const target = refocus.current
    refocus.current = null
    if (target === 'chip') chipRef.current?.querySelector('button')?.focus()
    if (target === 'input') inputRef.current?.focus()
  }, [value])
  const { data, isPending } = useQuery({ ...patientsQuery(false), enabled: value === null })
  const search = useMemo(() => createPatientSearch(data ?? []), [data])
  const results = useMemo(() => search(query).slice(0, MAX_RESULTS), [search, query])

  if (value) {
    return (
      <div
        ref={chipRef}
        className="flex h-9 animate-fade-in items-center justify-between gap-2 rounded-control border border-control bg-surface pr-1 pl-2.5 pointer-coarse:h-11"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={value.nome} size="xs" />
          <span className="truncate text-[13px] font-semibold">{value.nome}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Trocar paciente (${value.nome})`}
          onClick={() => {
            refocus.current = 'input'
            onChange(null)
            setQuery('')
            setOpen(true)
          }}
        >
          Trocar
        </Button>
      </div>
    )
  }

  function select(option: PatientOption): void {
    refocus.current = 'chip'
    onChange({ id: option.id, nome: option.nome })
    setOpen(false)
  }

  return (
    <div className="relative">
      <Search
        className={cn(
          trailingIconClass,
          'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2'
        )}
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        className="pl-9"
        role="combobox"
        aria-label="Paciente"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        autoFocus={autoFocus}
        placeholder="Digite o nome do paciente"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlight(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setHighlight((h) => Math.min(h + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter' && open && results[highlight]) {
            e.preventDefault()
            select(results[highlight])
          } else if (e.key === 'Escape' && open) {
            setOpen(false)
          }
        }}
      />
      <ul
        hidden={!open}
        id={listId}
        role="listbox"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          popupClass,
          'absolute top-full right-0 left-0 z-10 mt-1.5 max-h-60 animate-pop-in overflow-auto'
        )}
      >
        {results.length === 0 ? (
          <li className="px-2 py-2 text-[13px] text-ink-soft">
            {isPending ? 'Buscando…' : 'Nenhum paciente ativo encontrado.'}
          </li>
        ) : (
          results.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === highlight}
              data-highlighted={i === highlight || undefined}
              onMouseDown={(e) => {
                e.preventDefault()
                select(p)
              }}
              onMouseEnter={() => setHighlight(i)}
              className={optionClass}
            >
              <Avatar name={p.nome} size="xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{p.nome}</span>
              <span className="shrink-0 text-xs text-ink-soft tabular-nums">
                {formatAge(p.data_nascimento)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
