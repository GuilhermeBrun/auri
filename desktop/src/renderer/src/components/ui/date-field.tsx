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
  /** Mesmo `id` do `htmlFor` do `Field`. */
  id?: string
  /**
   * AAAA-MM-DD, ou '' se vazio. Enquanto o texto digitado não é uma data completa e existente, o
   * valor é o próprio texto ("12/05"): assim o formulário recusa em vez de gravar um campo vazio.
   */
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  autoFocus?: boolean
}

/** O que o campo mostra para um valor: dd/mm/aaaa, ou o texto cru de uma data ainda incompleta. */
const show = (value: string): string => (isIsoDate(value) ? isoToBrDate(value) : value)

/** O valor que um texto representa: a data em ISO se estiver completa e existir, senão o texto. */
const read = (text: string): string => brDateToIso(text) || text

/**
 * Data digitada (dd/mm/aaaa, com máscara) ou escolhida no calendário. No lugar do
 * <input type="date">, que abre o calendário do sistema (em inglês, com o azul do navegador) e
 * obriga a clicar mês a mês, o que não serve para uma data de nascimento.
 */
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
  // fechou escolhendo um dia (ou com Esc): o foco volta para o campo, onde a digitação continua
  const refocus = useRef(false)

  // o formulário trocou o valor por fora (carregou a ficha, limpou): o texto acompanha
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
          // o foco vai para o dia ativo, não para o primeiro botão (‹). Tem que ser aqui: antes disto
          // o diálogo em volta ainda prende o foco e o devolveria ao botão do calendário.
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
