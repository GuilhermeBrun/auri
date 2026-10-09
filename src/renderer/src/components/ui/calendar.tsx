import {
  addDays,
  addMonths,
  addYears,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toIsoDate } from '@shared/dates'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

// A semana começa no domingo, como na agenda
const WEEK = { weekStartsOn: 0 as const }

type CalendarProps = {
  /** Data escolhida, se houver. */
  value: Date | null
  onSelect: (date: Date) => void
}

/** "dom", "seg"...: três letras, como na agenda (o 'EEE' do pt-BR mistura "sexta" e "seg."). */
function weekday(date: Date): string {
  return format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
}

/**
 * Calendário de um mês (6 semanas, para a altura não mudar de um mês para o outro). Teclado, como
 * no padrão de seletor de data da WAI-ARIA: setas andam de dia em dia e de semana em semana,
 * Home/End vão ao começo e ao fim da semana, PageUp/PageDown trocam de mês (com Shift, de ano) e
 * Enter ou Espaço escolhem. Só o dia ativo está na ordem do Tab (`[tabindex="0"]`): quem abre o
 * calendário põe o foco nele, depois que o diálogo em volta liberar o foco para fora dele.
 */
export function Calendar({ value, onSelect }: CalendarProps): React.JSX.Element {
  const today = new Date()
  const [active, setActive] = useState(value ?? today)
  const [month, setMonth] = useState(startOfMonth(active))
  const gridRef = useRef<HTMLDivElement>(null)
  // o foco acompanha o dia ativo quando ele muda pelo teclado, não ao clicar em ‹ ›
  const followFocus = useRef(false)

  useEffect(() => {
    if (!followFocus.current) return
    followFocus.current = false
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-date="${toIsoDate(active)}"]`)
      ?.focus({ preventScroll: true })
  }, [active, month])

  const goTo = (date: Date): void => {
    followFocus.current = true
    setActive(date)
    setMonth(startOfMonth(date))
  }

  const shiftMonth = (by: number): void => {
    setActive((a) => addMonths(a, by))
    setMonth((m) => addMonths(m, by))
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const moves: Record<string, Date> = {
      ArrowLeft: addDays(active, -1),
      ArrowRight: addDays(active, 1),
      ArrowUp: addDays(active, -7),
      ArrowDown: addDays(active, 7),
      Home: startOfWeek(active, WEEK),
      End: endOfWeek(active, WEEK),
      PageUp: e.shiftKey ? addYears(active, -1) : addMonths(active, -1),
      PageDown: e.shiftKey ? addYears(active, 1) : addMonths(active, 1)
    }
    const next = moves[e.key]
    if (!next) return
    e.preventDefault()
    goTo(next)
  }

  const first = startOfWeek(month, WEEK)
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i))

  return (
    <div className="w-56">
      <div className="mb-2 flex items-center justify-between">
        <h2 aria-live="polite" className="pl-1 text-[13px] font-semibold capitalize">
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mês anterior"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próximo mês"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={format(month, 'MMMM yyyy', { locale: ptBR })}
        onKeyDown={onKeyDown}
      >
        <div role="row" className="grid grid-cols-7">
          {days.slice(0, 7).map((day) => (
            <span
              key={day.getDay()}
              role="columnheader"
              aria-label={format(day, 'EEEE', { locale: ptBR })}
              className="grid h-6 place-items-center text-xs text-ink-faint"
            >
              {weekday(day)}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div key={week} role="row" className="grid grid-cols-7">
            {days.slice(week * 7, week * 7 + 7).map((day) => {
              const selected = value !== null && isSameDay(day, value)
              const isToday = isSameDay(day, today)
              return (
                <div key={day.getTime()} role="gridcell" aria-selected={selected}>
                  <button
                    type="button"
                    data-date={toIsoDate(day)}
                    tabIndex={isSameDay(day, active) ? 0 : -1}
                    aria-label={format(day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => onSelect(day)}
                    className={cn(
                      'grid size-8 place-items-center rounded-control text-[13px] tabular-nums transition-colors pointer-coarse:size-10',
                      selected
                        ? 'bg-solid font-semibold text-on-solid hover:bg-solid-hover'
                        : cn(
                            'hover:bg-fill',
                            isSameMonth(day, month) ? 'text-ink' : 'text-ink-faint',
                            isToday && 'font-semibold shadow-[inset_0_0_0_1px_var(--color-control)]'
                          )
                    )}
                  >
                    {day.getDate()}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-2">
        <Button variant="ghost" size="sm" onClick={() => onSelect(today)}>
          Hoje
        </Button>
      </div>
    </div>
  )
}
