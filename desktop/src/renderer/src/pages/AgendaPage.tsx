import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek,
  differenceInMinutes,
  isToday
} from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { Check, ChevronLeft, ChevronRight, PenLine, Plus } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type RefObject
} from 'react'
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type Components,
  type EventProps,
  type HeaderProps,
  type Formats,
  type Messages,
  type SlotInfo,
  type View
} from 'react-big-calendar'
import {
  abertoNoHorario,
  algumDiaAberto,
  CONFIRMACAO_LABELS,
  confirmacao,
  dentroDoFuncionamento,
  diaAberto,
  FUNCIONAMENTO_PADRAO,
  horarioDoDia,
  limitesDoFuncionamento,
  minutesOf,
  type DiaSemana,
  type Funcionamento
} from '@shared/agenda'
import { formatTime, parseIsoLocalDateTime, toIsoLocalDateTime } from '@shared/dates'
import { shortName } from '@shared/names'
import type { Appointment } from '@shared/schemas'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { ErrorState } from '@renderer/components/ui/error'
import { CorPonto } from '@renderer/components/ui/cor'
import { Segmented } from '@renderer/components/ui/segmented'
import { Select } from '@renderer/components/ui/select'
import { appointmentsQuery, clinicQuery, etiquetasQuery } from '@renderer/lib/queries'
import { DEFAULT_DURATION, nextSlot, PRESENCA_LABELS } from '@renderer/lib/session'
import { cn } from '@renderer/lib/utils'
import { corVar } from '@renderer/lib/tipos'

const WEEK_OPTIONS = { weekStartsOn: 0 as const }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, WEEK_OPTIONS),
  getDay,
  locales: { 'pt-BR': ptBR }
})

const dayNumber = (d: Date): number => d.getFullYear() * 512 + d.getMonth() * 32 + d.getDate()

const defaultInRange = localizer.inRange
localizer.inRange = (day, min, max, unit = 'day') =>
  unit !== 'day'
    ? defaultInRange(day, min, max, unit)
    : (!min || dayNumber(day) >= dayNumber(min)) && (!max || dayNumber(day) <= dayNumber(max))

const TOAST_CLEARANCE = 72
const ARRIVED_MS = 3000

const messages: Messages<CalendarEvent> = {
  today: 'Hoje',
  previous: 'Anterior',
  next: 'Próximo',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Lista',
  date: 'Data',
  time: 'Hora',
  event: 'Paciente',
  noEventsInRange: 'Nenhum agendamento neste período.',
  showMore: (total) => `+${total} mais`
}

const timeRange = ({ start, end }: { start: Date; end: Date }): string =>
  `${formatTime(start)} – ${formatTime(end)}`

const formats: Formats = {
  timeGutterFormat: formatTime,
  dateFormat: 'd',
  eventTimeRangeFormat: timeRange,
  selectRangeFormat: timeRange,
  dayFormat: (date) => format(date, 'EEE dd/MM', { locale: ptBR }),
  weekdayFormat: (date) => format(date, 'EEE', { locale: ptBR })
}

function weekDays(date: Date): Date[] {
  const start = startOfWeek(date, WEEK_OPTIONS)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

function shownWeekDays(date: Date, funcionamento: Funcionamento, events: CalendarEvent[]): Date[] {
  const days = weekDays(date)
  if (!algumDiaAberto(funcionamento)) return days
  const busy = new Set(events.map((e) => dayNumber(e.start)))
  return days.filter((d) => diaAberto(funcionamento, d) || busy.has(dayNumber(d)))
}

const DEFAULT_LIMITS = { abre: 7 * 60, fecha: 20 * 60 }
const LAST_MINUTE = 24 * 60 - 1

function gridLimits(
  funcionamento: Funcionamento,
  days: Date[],
  events: CalendarEvent[]
): { abre: number; fecha: number } {
  const limits =
    limitesDoFuncionamento(
      funcionamento,
      days.map((d) => getDay(d) as DiaSemana)
    ) ??
    limitesDoFuncionamento(funcionamento) ??
    DEFAULT_LIMITS
  let { abre, fecha } = limits
  const keys = new Set(days.map(dayNumber))
  for (const event of events) {
    if (!keys.has(dayNumber(event.start))) continue
    abre = Math.min(abre, event.start.getHours() * 60 + event.start.getMinutes())
    const sameDay = dayNumber(event.end) === dayNumber(event.start)
    fecha = Math.max(
      fecha,
      sameDay ? event.end.getHours() * 60 + event.end.getMinutes() : LAST_MINUTE
    )
  }
  return {
    abre: Math.floor(abre / 60) * 60,
    fecha: Math.min(Math.ceil(fecha / 60) * 60, LAST_MINUTE)
  }
}

function periodLabel(date: Date, view: View, shown: Date[]): string {
  if (view === Views.MONTH) return format(date, 'MMMM yyyy', { locale: ptBR })
  if (view === Views.DAY) return format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
  const start = shown[0] ?? startOfWeek(date, WEEK_OPTIONS)
  const end = shown.at(-1) ?? addDays(start, 6)
  return start.getMonth() === end.getMonth()
    ? `${format(start, 'd')} a ${format(end, "d 'de' MMMM yyyy", { locale: ptBR })}`
    : `${format(start, "d 'de' MMM", { locale: ptBR })} a ${format(end, "d 'de' MMM yyyy", { locale: ptBR })}`
}

type NavAction = 'PREV' | 'NEXT' | 'TODAY'

function navigateDate(
  date: Date,
  view: View,
  action: NavAction,
  funcionamento: Funcionamento
): Date {
  if (action === 'TODAY') return new Date()
  const step = action === 'NEXT' ? 1 : -1
  if (view === Views.MONTH) return addMonths(date, step)
  if (view === Views.WEEK) return addWeeks(date, step)
  let next = addDays(date, step)
  if (!algumDiaAberto(funcionamento)) return next
  while (!diaAberto(funcionamento, next)) next = addDays(next, step)
  return next
}

type CalendarEvent = { id: number; title: string; start: Date; end: Date; appointment: Appointment }

function visibleRange(date: Date, view: View): { de: string; ate: string } {
  let start: Date
  let end: Date
  if (view === Views.MONTH) {
    start = startOfWeek(startOfMonth(date), WEEK_OPTIONS)
    end = addDays(endOfWeek(endOfMonth(date), WEEK_OPTIONS), 1)
  } else if (view === Views.DAY) {
    start = startOfDay(date)
    end = addDays(start, 1)
  } else {
    start = startOfWeek(date, WEEK_OPTIONS)
    end = addDays(start, 7)
  }
  return { de: toIsoLocalDateTime(startOfDay(start)), ate: toIsoLocalDateTime(startOfDay(end)) }
}

function EventContent({ event }: EventProps<CalendarEvent>): React.JSX.Element {
  const short = differenceInMinutes(event.end, event.start) < 45
  const start = formatTime(event.start)
  const { tipo_nome: tipoText, assinatura, etiquetas } = event.appointment
  const confirmado = !assinatura && confirmacao(event.appointment) === 'confirmado'
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="min-w-0 truncate">
          <span className="event-start mr-1.5 hidden font-normal tabular-nums opacity-75">
            {start}
          </span>
          <span className="name-short">{shortName(event.title)}</span>
          <span className="name-full">{event.title}</span>
          {assinatura && (
            <PenLine
              aria-label="Chegada assinada"
              className="ml-1 inline size-3 -translate-y-px stroke-[2] opacity-75"
            />
          )}
          {confirmado && (
            <Check
              aria-label={CONFIRMACAO_LABELS.confirmado}
              className="ml-1 inline size-3 -translate-y-px stroke-[2.5] opacity-75"
            />
          )}
          {etiquetas.length > 0 && (
            <span
              role="img"
              aria-label={`Etiquetas: ${etiquetas.map((e) => e.nome).join(', ')}`}
              className="ml-1 inline-flex -translate-y-px gap-0.5 align-middle"
            >
              {etiquetas.map((e) => (
                <CorPonto key={e.id} cor={e.cor} className="size-1.5" />
              ))}
            </span>
          )}
          <span
            className={cn('event-tipo text-xs font-normal opacity-75', !short && 'event-tipo-long')}
          >
            {' · '}
            {tipoText}
          </span>
        </span>
        {short && (
          <span className="event-inline-time ml-auto hidden shrink-0 text-xs font-normal tabular-nums opacity-75">
            {timeRange(event)}
          </span>
        )}
      </span>
      {!short && (
        <span className="event-detail truncate text-xs font-normal tabular-nums opacity-75">
          {tipoText} · {timeRange(event)}
        </span>
      )}
    </span>
  )
}

const VIEW_LABELS: [View, string][] = [
  [Views.DAY, 'Dia'],
  [Views.WEEK, 'Semana'],
  [Views.MONTH, 'Mês']
]

function weekdayShort(date: Date): string {
  return format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
}

function DayHeader({ date }: HeaderProps): React.JSX.Element {
  const today = isToday(date)
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          'text-xs capitalize',
          today ? 'font-semibold text-ink' : 'font-medium text-ink-soft'
        )}
      >
        {weekdayShort(date)}
      </span>
      <span
        className={cn(
          'grid size-8 place-items-center rounded-control text-lg leading-none font-semibold tracking-tight tabular-nums',
          today ? 'bg-solid text-on-solid' : 'text-ink'
        )}
      >
        {format(date, 'd')}
      </span>
    </span>
  )
}

function MonthHeader({ date }: HeaderProps): React.JSX.Element {
  return <span className="text-xs font-medium text-ink-soft capitalize">{weekdayShort(date)}</span>
}

type AgendaControlsProps = {
  view: View
  onNavigate: (action: NavAction) => void
  onView: (view: View) => void
  etiqueta: number | null
  onEtiqueta: (etiqueta: number | null) => void
}

function AgendaControls({
  view,
  onNavigate,
  onView,
  etiqueta,
  onEtiqueta
}: AgendaControlsProps): React.JSX.Element {
  const { data = [] } = useQuery(etiquetasQuery())
  const opcoes = data.filter((e) => !e.arquivado || e.id === etiqueta)
  return (
    <>
      {opcoes.length > 0 && (
        <div className="w-48">
          <Select
            aria-label="Filtrar por etiqueta"
            compact
            value={etiqueta === null ? 'todas' : String(etiqueta)}
            onValueChange={(v) => onEtiqueta(v === 'todas' ? null : Number(v))}
            options={[
              { value: 'todas', label: 'Todas as etiquetas' },
              ...opcoes.map((e) => ({
                value: String(e.id),
                label: e.nome,
                icon: <CorPonto cor={e.cor} />
              }))
            ]}
          />
        </div>
      )}
      <div
        role="group"
        aria-label="Período"
        className="flex items-center gap-0.5 rounded-control bg-fill p-0.5"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-chip"
          onClick={() => onNavigate('PREV')}
          aria-label="Anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-chip text-ink"
          onClick={() => onNavigate('TODAY')}
        >
          Hoje
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-chip"
          onClick={() => onNavigate('NEXT')}
          aria-label="Próximo"
        >
          <ChevronRight />
        </Button>
      </div>
      <Segmented label="Visualização" value={view} options={VIEW_LABELS} onChange={onView} />
    </>
  )
}

const VIEWS: View[] = [Views.MONTH, Views.WEEK, Views.DAY]

const COMPONENTS: Components<CalendarEvent> = {
  event: EventContent,
  week: { header: DayHeader },
  day: { header: DayHeader },
  month: { header: MonthHeader }
}

const CALENDAR_STYLE = { height: '100%' }

function tooltip(event: CalendarEvent): string {
  const { tipo_nome, presenca, observacao, etiquetas } = event.appointment
  const { assinatura } = event.appointment
  const tags = [
    tipo_nome,
    ...etiquetas.map((e) => e.nome),
    presenca ? PRESENCA_LABELS[presenca] : '',
    !presenca && !assinatura ? CONFIRMACAO_LABELS[confirmacao(event.appointment)] : '',
    assinatura ? `chegada assinada por ${assinatura.signer_nome}` : ''
  ].filter(Boolean)
  const extra = tags.length > 0 ? ` (${tags.join(', ')})` : ''
  return `${timeRange(event)} · ${event.title}${extra}${observacao ? `\n${observacao}` : ''}`
}

type AgendaCalendarProps = {
  events: CalendarEvent[]
  date: Date
  view: View
  funcionamento: Funcionamento
  shownDays: Date[]
  onNavigate: (date: Date) => void
  onView: (view: View) => void
  onDraft: (draft: AppointmentDraft) => void
  arrivedRef: RefObject<number | null>
}

const AgendaCalendar = memo(function AgendaCalendar({
  events,
  date,
  view,
  funcionamento,
  shownDays,
  onNavigate,
  onView,
  onDraft,
  arrivedRef
}: AgendaCalendarProps): React.JSX.Element {
  const { min, max, scrollToTime } = useMemo(() => {
    const base = startOfDay(date)
    const days = view === Views.DAY ? [base] : shownDays
    const { abre, fecha } = gridLimits(funcionamento, days, events)
    return {
      min: setMinutes(base, abre),
      max: setMinutes(base, fecha),
      scrollToTime: setMinutes(base, abre)
    }
  }, [date, view, shownDays, funcionamento, events])

  const shownKeys = useMemo(() => new Set(shownDays.map(dayNumber)), [shownDays])

  const dayPropGetter = useCallback(
    (day: Date): { className?: string } => {
      const className = cn(
        !diaAberto(funcionamento, day) && 'day-closed',
        view === Views.WEEK && !shownKeys.has(dayNumber(day)) && 'day-hidden'
      )
      return className ? { className } : {}
    },
    [funcionamento, view, shownKeys]
  )

  const slotPropGetter = useCallback(
    (slot: Date): HTMLAttributes<HTMLDivElement> => {
      const props: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string> = {}
      if (!abertoNoHorario(funcionamento, slot)) props.className = 'slot-closed'
      if (slot.getMinutes() === 30) props['data-meia'] = formatTime(slot)
      return props
    },
    [funcionamento]
  )

  const onSelecting = useCallback(
    ({ start, end }: { start: Date; end: Date }): boolean =>
      dentroDoFuncionamento(funcionamento, start, end),
    [funcionamento]
  )

  const onSelectSlot = useCallback(
    (slot: SlotInfo): void => {
      if (view === Views.MONTH) {
        const horario = horarioDoDia(funcionamento, slot.start)
        if (!horario) return
        onDraft({
          mode: 'create',
          inicio: setMinutes(startOfDay(slot.start), Math.max(minutesOf(horario.abre), 8 * 60)),
          duracao: DEFAULT_DURATION
        })
      } else {
        if (!abertoNoHorario(funcionamento, slot.start)) return
        const selected = differenceInMinutes(slot.end, slot.start)
        onDraft({
          mode: 'create',
          inicio: slot.start,
          duracao:
            slot.action === 'select' && selected > DEFAULT_DURATION ? selected : DEFAULT_DURATION
        })
      }
    },
    [view, funcionamento, onDraft]
  )

  const onSelectEvent = useCallback(
    (event: CalendarEvent): void => onDraft({ mode: 'edit', appointment: event.appointment }),
    [onDraft]
  )

  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (arrivedRef.current === null) return
    const arrived = rootRef.current?.querySelector<HTMLElement>('.event-arrived')
    const scroller = arrived?.closest<HTMLElement>('.rbc-time-content')
    if (!arrived || !scroller) return
    const box = arrived.getBoundingClientRect()
    const view = scroller.getBoundingClientRect()
    if (box.top >= view.top && box.bottom <= view.bottom - TOAST_CLEARANCE) return
    scroller.scrollTop += box.top + box.height / 2 - (view.top + view.height / 2)
  }, [events, arrivedRef])

  const eventPropGetter = useCallback(
    (event: CalendarEvent): { className?: string; style: CSSProperties } => {
      const missed =
        event.appointment.presenca === 'falta' || event.appointment.presenca === 'desmarcou'
      const className = cn(
        event.id === arrivedRef.current && 'event-arrived',
        missed && 'event-missed'
      )
      const style = { '--tipo-cor': corVar(event.appointment.tipo_cor) } as CSSProperties
      return className ? { className, style } : { style }
    },
    [arrivedRef]
  )

  return (
    <div ref={rootRef} className="h-full">
      <Calendar<CalendarEvent>
        localizer={localizer}
        culture="pt-BR"
        events={events}
        date={date}
        view={view}
        onNavigate={onNavigate}
        onView={onView}
        views={VIEWS}
        toolbar={false}
        step={30}
        timeslots={2}
        min={min}
        max={max}
        scrollToTime={scrollToTime}
        messages={messages}
        formats={formats}
        components={COMPONENTS}
        dayPropGetter={dayPropGetter}
        slotPropGetter={slotPropGetter}
        eventPropGetter={eventPropGetter}
        selectable
        onSelecting={onSelecting}
        popup
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        tooltipAccessor={tooltip}
        className={`agenda-${view}`}
        style={CALENDAR_STYLE}
      />
    </div>
  )
})

export function AgendaPage(): React.JSX.Element {
  const [date, setDate] = useState(() => new Date())
  const [view, setView] = useState<View>(Views.WEEK)
  const [draft, setDraft] = useState<AppointmentDraft | null>(null)
  const arrivedRef = useRef<number | null>(null)
  const markArrived = useCallback((appointment: Appointment): void => {
    arrivedRef.current = appointment.id
    setTimeout(() => {
      if (arrivedRef.current === appointment.id) arrivedRef.current = null
    }, ARRIVED_MS)
  }, [])

  const queryClient = useQueryClient()
  const clinic = useQuery(clinicQuery())
  const funcionamento = clinic.data?.funcionamento ?? FUNCIONAMENTO_PADRAO
  const { data, error, refetch } = useQuery({
    ...appointmentsQuery(visibleRange(date, view)),
    placeholderData: (previous) => previous
  })
  const failed = error !== null && data === undefined

  const [etiqueta, setEtiqueta] = useState<number | null>(null)
  const allEvents = useMemo<CalendarEvent[]>(
    () =>
      (data ?? []).map((a) => ({
        id: a.id,
        title: a.patient_nome,
        start: parseIsoLocalDateTime(a.inicio),
        end: parseIsoLocalDateTime(a.fim),
        appointment: a
      })),
    [data]
  )
  const events = useMemo(
    () =>
      etiqueta === null
        ? allEvents
        : allEvents.filter((e) => e.appointment.etiquetas.some((x) => x.id === etiqueta)),
    [allEvents, etiqueta]
  )

  const shownDays = useMemo(
    () => shownWeekDays(date, funcionamento, allEvents),
    [date, funcionamento, allEvents]
  )

  useEffect(() => {
    const ranges = [
      visibleRange(navigateDate(date, view, 'PREV', funcionamento), view),
      visibleRange(navigateDate(date, view, 'NEXT', funcionamento), view),
      ...VIEWS.filter((v) => v !== view).map((v) => visibleRange(date, v))
    ]
    const idle = requestIdleCallback(() => {
      for (const range of ranges) void queryClient.prefetchQuery(appointmentsQuery(range))
    })
    return () => cancelIdleCallback(idle)
  }, [date, view, funcionamento, queryClient])

  const navigate = useCallback(
    (action: NavAction): void =>
      setDate((current) => navigateDate(current, view, action, funcionamento)),
    [view, funcionamento]
  )

  const openNew = useCallback((): void => {
    setDraft({
      mode: 'create',
      inicio: nextSlot(new Date(), funcionamento),
      duracao: DEFAULT_DURATION
    })
  }, [funcionamento])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const target = e.target as HTMLElement
      const typing = target.closest('input, textarea, select, [contenteditable="true"]')
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || typing) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      openNew()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openNew])

  const period = periodLabel(date, view, shownDays)

  return (
    <Page
      trail={[
        { label: 'Agenda' },
        {
          label: (
            <span key={period} className="animate-fade-in">
              {period}
            </span>
          )
        }
      ]}
      toolbar={
        <AgendaControls
          view={view}
          onNavigate={navigate}
          onView={setView}
          etiqueta={etiqueta}
          onEtiqueta={setEtiqueta}
        />
      }
      actions={
        <Button
          variant="ghost"
          size="icon"
          onClick={openNew}
          aria-keyshortcuts="N"
          aria-label="Novo agendamento"
          title="Novo agendamento (N)"
        >
          <Plus />
        </Button>
      }
      bodyClassName="flex flex-col overflow-hidden"
    >
      {failed ? (
        <ErrorState
          title="Não foi possível carregar a agenda"
          detail={error.message}
          onRetry={() => void refetch()}
        >
          Tente de novo. Se o problema continuar, feche e abra o Auri.
        </ErrorState>
      ) : (
        <div className="flex min-h-[520px] flex-1">
          <div className="min-w-0 flex-1">
            <AgendaCalendar
              events={events}
              date={date}
              view={view}
              funcionamento={funcionamento}
              shownDays={shownDays}
              onNavigate={setDate}
              onView={setView}
              onDraft={setDraft}
              arrivedRef={arrivedRef}
            />
          </div>
        </div>
      )}
      <AppointmentDialog draft={draft} onClose={() => setDraft(null)} onSaved={markArrived} />
    </Page>
  )
}
