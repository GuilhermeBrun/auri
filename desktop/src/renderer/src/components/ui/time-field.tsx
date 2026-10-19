import { Check, Clock } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { maskTime, normalizeTime } from '@shared/dates'
import { optionClass, popupClass, trailingIconClass } from '@renderer/components/ui/field-style'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

type TimeFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  slots: readonly string[]
  invalid?: boolean
}

export function TimeField({
  id,
  value,
  onChange,
  slots,
  invalid
}: TimeFieldProps): React.JSX.Element {
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const selectOnMouseUp = useRef(false)
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState<number | null>(null)

  if (value !== seen) {
    setSeen(value)
    if (text !== value) setText(value)
  }

  const exact = slots.indexOf(text)
  const typed = normalizeTime(text)
  const byPrefix = text === '' ? -1 : slots.findIndex((s) => s.startsWith(text))
  const byTime = typed ? slots.findIndex((s) => s >= typed) : -1
  const anchor =
    [exact, byPrefix, byTime].find((i) => i >= 0) ?? (text === '' ? 0 : slots.length - 1)

  useLayoutEffect(() => {
    const list = listRef.current
    const item = list?.children[highlight ?? anchor] as HTMLElement | undefined
    if (!list || !item) return
    if (highlight === null) {
      list.scrollTop = item.offsetTop - (list.clientHeight - item.offsetHeight) / 2
    } else if (item.offsetTop < list.scrollTop) {
      list.scrollTop = item.offsetTop - 4
    } else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight + 4
    }
  }, [open, anchor, highlight])

  const close = (): void => {
    setOpen(false)
    setHighlight(null)
  }

  const choose = (slot: string): void => {
    setText(slot)
    onChange(slot)
    close()
  }

  const commit = (): void => {
    const full = normalizeTime(text)
    if (full) {
      setText(full)
      onChange(full)
    }
    close()
  }

  const move = (to: number): void => {
    setOpen(true)
    setHighlight(Math.min(Math.max(to, 0), slots.length - 1))
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && highlight !== null ? `${listId}-${highlight}` : undefined}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh:mm"
        value={text}
        className="pr-9"
        onChange={(e) => {
          const next = maskTime(e.target.value)
          setText(next)
          onChange(next)
          setOpen(true)
          setHighlight(null)
        }}
        onFocus={(e) => {
          e.target.select()
          selectOnMouseUp.current = true
          setOpen(true)
        }}
        onMouseUp={(e) => {
          if (!selectOnMouseUp.current) return
          selectOnMouseUp.current = false
          e.preventDefault()
        }}
        onClick={() => setOpen(true)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            move(highlight === null ? (exact >= 0 ? anchor + 1 : anchor) : highlight + 1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            move((highlight ?? anchor) - 1)
          } else if (e.key === 'Enter') {
            if (open && highlight !== null) {
              e.preventDefault()
              choose(slots[highlight])
            } else {
              commit()
            }
          } else if (e.key === 'Escape' && open) {
            close()
          }
        }}
      />
      <Clock
        className={cn(
          trailingIconClass,
          'pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2'
        )}
        aria-hidden="true"
      />
      <ul
        hidden={!open}
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Horários"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          popupClass,
          'absolute top-full right-0 left-0 z-10 mt-1.5 max-h-56 animate-pop-in overflow-auto'
        )}
      >
        {slots.map((slot, i) => (
          <li
            key={slot}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={slot === value}
            data-highlighted={i === highlight || undefined}
            onMouseDown={(e) => {
              e.preventDefault()
              choose(slot)
            }}
            onMouseEnter={() => setHighlight(i)}
            className={cn(optionClass, 'tabular-nums')}
          >
            {slot}
            {slot === value && (
              <Check className={cn(trailingIconClass, 'ml-auto')} aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
