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
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek,
  differenceInMinutes,
  isToday
} from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
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
import { DAY_END_HOUR, DAY_START_HOUR } from '@shared/agenda'
import { formatTime, parseIsoLocalDateTime, toIsoLocalDateTime } from '@shared/dates'
import { shortName } from '@shared/names'
import type { Appointment } from '@shared/schemas'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { ErrorState } from '@renderer/components/ui/error'
import { Segmented } from '@renderer/components/ui/segmented'
import { appointmentsQuery } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/utils'

const WEEK_OPTIONS = { weekStartsOn: 0 as const } // semana começa no domingo

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, WEEK_OPTIONS),
  getDay,
  locales: { 'pt-BR': ptBR }
})

/** O dia como um número que cresce com a data, para comparar dias sem criar objetos Date. */
const dayNumber = (d: Date): number => d.getFullYear() * 512 + d.getMonth() * 32 + d.getDate()

// A grade compara cada sessão com cada dia visível (`inRange` por dia) a cada redesenho, e a versão
// padrão cria várias datas por comparação: milhares por semana, e coleta de lixo. Esta compara
// números; as outras unidades seguem com a original. O react-big-calendar prevê trocar essas
// funções do localizer.
const defaultInRange = localizer.inRange
localizer.inRange = (day, min, max, unit = 'day') =>
  unit !== 'day'
    ? defaultInRange(day, min, max, unit)
    : (!min || dayNumber(day) >= dayNumber(min)) && (!max || dayNumber(day) <= dayNumber(max))

const DEFAULT_DURATION = 30
/** Faixa do rodapé da janela onde o aviso aparece (altura + margem): a sessão nova não pode ficar embaixo dele. */
const TOAST_CLEARANCE = 72
/** Por quanto tempo a sessão recém-salva fica marcada; o destaque dura menos que isso. */
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

// Horários com `formatTime`: a grade formata centenas deles a cada redesenho
const formats: Formats = {
  timeGutterFormat: formatTime,
  dateFormat: 'd',
  eventTimeRangeFormat: timeRange,
  selectRangeFormat: timeRange,
  dayFormat: (date) => format(date, 'EEE dd/MM', { locale: ptBR }),
  weekdayFormat: (date) => format(date, 'EEE', { locale: ptBR })
}

/** Período visível ("4 a 10 de outubro 2026"), mostrado na barra de ferramentas da página. */
function periodLabel(date: Date, view: View): string {
  if (view === Views.MONTH) return format(date, 'MMMM yyyy', { locale: ptBR })
  if (view === Views.DAY) return format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
  const start = startOfWeek(date, WEEK_OPTIONS)
  const end = addDays(start, 6)
  return start.getMonth() === end.getMonth()
    ? `${format(start, 'd')} a ${format(end, "d 'de' MMMM yyyy", { locale: ptBR })}`
    : `${format(start, "d 'de' MMM", { locale: ptBR })} a ${format(end, "d 'de' MMM yyyy", { locale: ptBR })}`
}

type NavAction = 'PREV' | 'NEXT' | 'TODAY'

/** Nova data ao navegar, no passo da visão atual (mês, semana ou dia). */
function navigateDate(date: Date, view: View, action: NavAction): Date {
  if (action === 'TODAY') return new Date()
  const step = action === 'NEXT' ? 1 : -1
  if (view === Views.MONTH) return addMonths(date, step)
  if (view === Views.DAY) return addDays(date, step)
  return addWeeks(date, step)
}

type CalendarEvent = { id: number; title: string; start: Date; end: Date; appointment: Appointment }

/** Intervalo visível na tela, para buscar só os agendamentos necessários. */
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

/** Próximo horário cheio ou meia hora a partir de agora, dentro do expediente (à noite, o início de amanhã). */
function nextSlot(now: Date): Date {
  const minutes = now.getMinutes() < 30 ? 30 : 60
  const slot = setMinutes(setHours(startOfDay(now), now.getHours()), minutes)
  if (slot.getHours() < DAY_START_HOUR) return setHours(startOfDay(now), DAY_START_HOUR)
  // sem lugar para uma sessão padrão antes das 20:00: a grade não tem esse horário
  if (differenceInMinutes(setHours(startOfDay(now), DAY_END_HOUR), slot) < DEFAULT_DURATION) {
    return setHours(startOfDay(addDays(now, 1)), DAY_START_HOUR)
  }
  return slot
}

/**
 * Conteúdo da sessão. Semana e Mês têm colunas estreitas: mostram o nome curto ("Maria Eduarda"),
 * que cabe inteiro; o nome completo aparece no balão e na visão Dia (ver .name-short, .name-full e
 * .agenda-day no CSS). Sessões curtas (menos de 45 min) ficam em uma linha, sem horário, porque ele
 * já está na grade; na visão Dia, que tem espaço de sobra, o horário vem à direita. Sessões longas:
 * nome em cima e intervalo embaixo. No Mês não há grade, então o horário vem antes do nome e a
 * segunda linha some (.event-start e .event-detail).
 */
function EventContent({ event }: EventProps<CalendarEvent>): React.JSX.Element {
  const short = differenceInMinutes(event.end, event.start) < 45
  const start = formatTime(event.start)
  const range = timeRange(event)
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="min-w-0 truncate">
          <span className="event-start mr-1.5 hidden font-normal tabular-nums opacity-75">
            {start}
          </span>
          <span className="name-short">{shortName(event.title)}</span>
          <span className="name-full">{event.title}</span>
        </span>
        {short && (
          <span className="event-inline-time ml-auto hidden shrink-0 text-xs font-normal tabular-nums opacity-75">
            {range}
          </span>
        )}
      </span>
      {!short && (
        <span className="event-detail truncate text-xs font-normal tabular-nums opacity-75">
          {range}
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

/** Três letras do dia da semana ("seg"): o 'EEE' do pt-BR no date-fns devolve o nome por extenso. */
function weekdayShort(date: Date): string {
  return format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
}

/** Cabeçalho de cada dia na semana: dia pequeno em cima, número grande embaixo; hoje vira um quadrado grafite. */
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
}

/**
 * Ferramentas da agenda, na barra da página, com 32px de altura. Dois grupos no mesmo trilho de
 * preenchimento neutro das outras ferramentas: "quando" (‹ Hoje ›) e "como ver" (Dia, Semana, Mês,
 * com a opção ativa elevada).
 */
function AgendaControls({ view, onNavigate, onView }: AgendaControlsProps): React.JSX.Element {
  return (
    <>
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

/** Fim de semana com fundo levemente diferente, como no Amie. */
function dayPropGetter(date: Date): { className?: string } {
  const weekday = getDay(date)
  return weekday === 0 || weekday === 6 ? { className: 'rbc-weekend' } : {}
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
  const observacao = event.appointment.observacao ? `\n${event.appointment.observacao}` : ''
  return `${timeRange(event)} · ${event.title}${observacao}`
}

type AgendaCalendarProps = {
  events: CalendarEvent[]
  date: Date
  view: View
  onNavigate: (date: Date) => void
  onView: (view: View) => void
  onDraft: (draft: AppointmentDraft) => void
  /** Sessão recém-salva, que entra com destaque (ver `.event-arrived`). Um ref, para a grade não redesenhar ao marcar. */
  arrivedRef: RefObject<number | null>
}

/**
 * A grade da agenda, num componente à parte e com `memo`. O react-big-calendar refaz tudo a cada
 * render (e mede o layout no fim), então a grade só deve redesenhar quando a data, a visão ou as
 * sessões mudam: abrir e fechar o diálogo de agendamento não toca nela.
 */
const AgendaCalendar = memo(function AgendaCalendar({
  events,
  date,
  view,
  onNavigate,
  onView,
  onDraft,
  arrivedRef
}: AgendaCalendarProps): React.JSX.Element {
  const { min, max, scrollToTime } = useMemo(() => {
    const base = startOfDay(new Date())
    return {
      min: setHours(base, DAY_START_HOUR),
      max: setHours(base, DAY_END_HOUR),
      // começa no início do expediente: na escala atual o dia inteiro quase cabe, e rolar até as 8h
      // cortava o rótulo da primeira hora
      scrollToTime: setHours(base, DAY_START_HOUR)
    }
  }, [])

  const onSelectSlot = useCallback(
    (slot: SlotInfo): void => {
      if (view === Views.MONTH) {
        // no mês o clique é no dia inteiro: sugere 8h
        onDraft({
          mode: 'create',
          inicio: setHours(startOfDay(slot.start), 8),
          duracao: DEFAULT_DURATION
        })
      } else {
        const selected = differenceInMinutes(slot.end, slot.start)
        onDraft({
          mode: 'create',
          inicio: slot.start,
          duracao:
            slot.action === 'select' && selected > DEFAULT_DURATION ? selected : DEFAULT_DURATION
        })
      }
    },
    [view, onDraft]
  )

  const onSelectEvent = useCallback(
    (event: CalendarEvent): void => onDraft({ mode: 'edit', appointment: event.appointment }),
    [onDraft]
  )

  // Sessão recém-salva fora da área visível da grade (ex.: 19:30 numa janela baixa) ou sob o aviso:
  // rola até ela, deixando-a no meio, para o destaque ser visto. Só nas visões com grade de horas.
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

  // Lido na hora de desenhar a sessão: a que acabou de ser salva ganha a classe de destaque
  const eventPropGetter = useCallback(
    (event: CalendarEvent): { className?: string } =>
      event.id === arrivedRef.current ? { className: 'event-arrived' } : {},
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
        eventPropGetter={eventPropGetter}
        selectable
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
  // Sessão recém-salva: destacada quando a grade a desenha, e esquecida em seguida para que voltar a
  // esta semana mais tarde não repita o destaque
  const arrivedRef = useRef<number | null>(null)
  const markArrived = useCallback((appointment: Appointment): void => {
    arrivedRef.current = appointment.id
    setTimeout(() => {
      if (arrivedRef.current === appointment.id) arrivedRef.current = null
    }, ARRIVED_MS)
  }, [])

  const queryClient = useQueryClient()
  const { data, error, refetch } = useQuery({
    ...appointmentsQuery(visibleRange(date, view)),
    placeholderData: (previous) => previous
  })
  // Falha só quando não há nada para mostrar: se uma atualização falhar, os dados anteriores ficam
  const failed = error !== null && data === undefined

  const events = useMemo<CalendarEvent[]>(
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

  // Deixa no cache o período anterior, o seguinte e as outras visões da mesma data: navegar vira um
  // único redesenho, já com as sessões, em vez de a grade aparecer vazia e as sessões surgirem
  // depois. Busca quando o app está ocioso, para não disputar o quadro com a navegação.
  useEffect(() => {
    const ranges = [
      visibleRange(navigateDate(date, view, 'PREV'), view),
      visibleRange(navigateDate(date, view, 'NEXT'), view),
      ...VIEWS.filter((v) => v !== view).map((v) => visibleRange(date, v))
    ]
    const idle = requestIdleCallback(() => {
      for (const range of ranges) void queryClient.prefetchQuery(appointmentsQuery(range))
    })
    return () => cancelIdleCallback(idle)
  }, [date, view, queryClient])

  const navigate = useCallback(
    (action: NavAction): void => setDate((current) => navigateDate(current, view, action)),
    [view]
  )

  const openNew = useCallback((): void => {
    setDraft({ mode: 'create', inicio: nextSlot(new Date()), duracao: DEFAULT_DURATION })
  }, [])

  // Atalho N: novo agendamento (fora de campos de texto e com nenhum diálogo aberto)
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

  const period = periodLabel(date, view)

  return (
    <Page
      // key: o período novo entra com um fade, para a mudança de data ser notada além da grade
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
      toolbar={<AgendaControls view={view} onNavigate={navigate} onView={setView} />}
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
        <div className="min-h-[520px] flex-1">
          <AgendaCalendar
            events={events}
            date={date}
            view={view}
            onNavigate={setDate}
            onView={setView}
            onDraft={setDraft}
            arrivedRef={arrivedRef}
          />
        </div>
      )}
      <AppointmentDialog draft={draft} onClose={() => setDraft(null)} onSaved={markArrived} />
    </Page>
  )
}
