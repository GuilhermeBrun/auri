import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { useMemo, useRef, useState } from 'react'
import { formatTime, parseIsoLocalDateTime } from '@shared/dates'
import type { Appointment, Presenca } from '@shared/schemas'
import { PRESENCA_LABELS } from '@renderer/lib/session'
import { cn } from '@renderer/lib/utils'

const MAX_BARS = 40

type Kind = Presenca | 'pendente'

const KINDS: Record<Kind, { one: string; many: string; fill: string }> = {
  presente: { one: 'presença', many: 'presenças', fill: 'bg-ink' },
  falta: { one: 'falta', many: 'faltas', fill: 'bg-line-strong' },
  desmarcou: { one: 'desmarcada', many: 'desmarcadas', fill: 'bg-hatch' },
  pendente: {
    one: 'sem registro',
    many: 'sem registro',
    fill: 'border border-dashed border-control'
  }
}

const KIND_ORDER: Kind[] = ['presente', 'falta', 'desmarcou', 'pendente']

const kindOf = (a: Appointment): Kind => a.presenca || 'pendente'

const statusLabel = (kind: Kind): string =>
  kind === 'pendente' ? 'Sem registro' : PRESENCA_LABELS[kind]

export function AttendanceChart({
  sessions,
  onOpen
}: {
  sessions: Appointment[]
  onOpen: (appointment: Appointment) => void
}): React.JSX.Element {
  const bars = useMemo(() => sessions.slice(0, MAX_BARS).reverse(), [sessions])
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { presente: 0, falta: 0, desmarcou: 0, pendente: 0 }
    for (const a of sessions) c[kindOf(a)]++
    return c
  }, [sessions])
  const registered = sessions.length - counts.pendente
  const signedCount = useMemo(() => sessions.filter((a) => a.assinatura).length, [sessions])
  const frequency = registered > 0 ? Math.round((counts.presente / registered) * 100) : null

  const [active, setActive] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState(bars.length - 1)
  const [highlight, setHighlight] = useState<Kind | null>(null)
  const [pinned, setPinned] = useState<Kind | null>(null)
  const lit = highlight ?? pinned
  const barRefs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const keys: Record<string, number> = {
      ArrowLeft: focusIndex - 1,
      ArrowRight: focusIndex + 1,
      Home: 0,
      End: bars.length - 1
    }
    if (!(e.key in keys)) return
    e.preventDefault()
    const next = Math.max(0, Math.min(bars.length - 1, keys[e.key]))
    setFocusIndex(next)
    barRefs.current[next]?.focus()
  }

  const shown = active === null ? null : bars[active]

  return (
    <section aria-labelledby="frequencia">
      <div className="flex items-baseline justify-between gap-6">
        <h2 id="frequencia" className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight">Frequência</span>
          <span className="text-[13px] text-ink-soft tabular-nums">
            {frequency === null
              ? 'nenhuma presença marcada'
              : `${frequency}% · ${counts.presente} de ${registered}${signedCount > 0 ? ` · ${signedCount} ${signedCount === 1 ? 'assinada' : 'assinadas'}` : ''}`}
          </span>
        </h2>

        <div className="-mr-2 flex flex-wrap justify-end" role="group" aria-label="Destacar">
          {KIND_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={pinned === kind}
              onMouseEnter={() => setHighlight(kind)}
              onMouseLeave={() => setHighlight(null)}
              onClick={() => setPinned((p) => (p === kind ? null : kind))}
              className={cn(
                'flex h-6 items-center gap-1.5 rounded-chip px-2 text-xs text-ink-soft transition-colors hover:bg-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                pinned === kind && 'bg-fill-hover text-ink'
              )}
            >
              <span aria-hidden className={cn('size-2 rounded-[2px]', KINDS[kind].fill)} />
              {counts[kind]} {counts[kind] === 1 ? KINDS[kind].one : KINDS[kind].many}
            </button>
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label="Presença por sessão. Use as setas para percorrer e Enter para abrir."
        onKeyDown={onKeyDown}
        onMouseLeave={() => setActive(null)}
        className="mt-4 flex gap-[3px]"
      >
        {bars.map((a, i) => {
          const inicio = parseIsoLocalDateTime(a.inicio)
          const kind = kindOf(a)
          const previous = bars[i - 1]
          const newMonth =
            !previous || parseIsoLocalDateTime(previous.inicio).getMonth() !== inicio.getMonth()
          const dim = (lit && lit !== kind) || (active !== null && active !== i)
          return (
            <div key={a.id} className="flex min-w-0 flex-1 flex-col">
              <button
                ref={(el) => {
                  barRefs.current[i] = el
                }}
                type="button"
                tabIndex={i === focusIndex ? 0 : -1}
                aria-label={`${format(inicio, "EEEE, d 'de' MMMM", { locale: ptBR })}, ${statusLabel(kind)}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => {
                  setFocusIndex(i)
                  setActive(i)
                }}
                onBlur={() => setActive(null)}
                onClick={() => onOpen(a)}
                className={cn(
                  'group flex h-6 items-center rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
                )}
              >
                <span
                  style={{ animationDelay: `${i * 14}ms` }}
                  className={cn(
                    'w-full animate-fade-in rounded-[3px] transition-[opacity,height] duration-150',
                    KINDS[kind].fill,
                    active === i ? 'h-3' : 'h-1.5',
                    dim && 'opacity-25'
                  )}
                />
              </button>
              <span
                aria-hidden
                className="h-4 pt-1.5 text-xs leading-none whitespace-nowrap text-ink-faint"
              >
                {newMonth ? format(inicio, 'MMM', { locale: ptBR }) : ''}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 min-h-5 truncate text-xs text-ink-soft">
        {shown ? (
          <>
            <span className="font-medium text-ink">
              {format(parseIsoLocalDateTime(shown.inicio), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>
            {' · '}
            {formatTime(parseIsoLocalDateTime(shown.inicio))} · {statusLabel(kindOf(shown))}
            {shown.tipo === 'avaliacao' && ' · Avaliação'}
            {shown.evolucao && ` — ${shown.evolucao}`}
          </>
        ) : (
          <span className="text-ink-faint">
            {sessions.length > MAX_BARS
              ? `Últimas ${MAX_BARS} sessões. Passe o mouse para ver cada uma.`
              : 'Passe o mouse para ver cada sessão.'}
          </span>
        )}
      </p>
    </section>
  )
}
