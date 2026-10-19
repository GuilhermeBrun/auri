import { CalendarDays } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useRef, useState } from 'react'
import {
  brDateToIso,
  isIsoDate,
  isoToBrDate,
  maskBrDate,
  parseIsoDate,
  toIsoDate
} from '@shared/dates'
import { Calendar } from '@renderer/components/ui/calendar'
import { openClass, popupClass, trailingIconClass } from '@renderer/components/ui/field-style'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

type DateFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  autoFocus?: boolean
}

const show = (value: string): string => (isIsoDate(value) ? isoToBrDate(value) : value)

const read = (text: string): string => brDateToIso(text) || text

export function DateField({
  id,
  value,
  onChange,
  invalid,
  autoFocus
}: DateFieldProps): React.JSX.Element {
  const [text, setText] = useState(() => show(value))
  const [seen, setSeen] = useState(value)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const refocus = useRef(false)

  if (value !== seen) {
    setSeen(value)
    if (read(text) !== value) setText(show(value))
  }

  const pick = (date: Date): void => {
    const iso = toIsoDate(date)
    setText(isoToBrDate(iso))
    onChange(iso)
    refocus.current = true
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            id={id}
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            autoFocus={autoFocus}
            value={text}
            aria-invalid={invalid || undefined}
            className={cn('pr-10', open && openClass)}
            onChange={(e) => {
              const next = maskBrDate(e.target.value)
              setText(next)
              onChange(read(next))
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setOpen(true)
              }
            }}
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label="Abrir calendário"
              className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-control transition-colors hover:bg-fill pointer-coarse:size-10"
            >
              <CalendarDays className={trailingIconClass} aria-hidden="true" />
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          ref={contentRef}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Escolher data"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            contentRef.current
              ?.querySelector<HTMLElement>('[role=grid] [tabindex="0"]')
              ?.focus({ preventScroll: true })
          }}
          onEscapeKeyDown={() => (refocus.current = true)}
          onCloseAutoFocus={(e) => {
            if (!refocus.current) return
            refocus.current = false
            e.preventDefault()
            inputRef.current?.focus()
          }}
          className={cn(
            popupClass,
            'z-[60] origin-(--radix-popover-content-transform-origin) p-3 focus:outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in'
          )}
        >
          <Calendar value={isIsoDate(value) ? parseIsoDate(value) : null} onSelect={pick} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
