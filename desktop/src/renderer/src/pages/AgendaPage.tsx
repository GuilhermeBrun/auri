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
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  CircleAlert,
  ChevronRight,
  Clock,
  Hourglass,
  PenLine,
  Plus,
  TimerOff,
  Undo2,
  X
} from 'lucide-react'
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
import { useLocation } from 'react-router'
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
import withDragAndDrop, {
  type EventInteractionArgs
} from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
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
  DIAS_SEMANA,
  type DiaSemana,
  type Funcionamento
} from '@shared/agenda'
import { formatTime, parseIsoLocalDateTime, toIsoLocalDateTime } from '@shared/dates'
import { shortName } from '@shared/names'
import { commitmentName, type Commitment } from '@shared/commitments'
import { PEDIDO_LABELS, type Vaga } from '@shared/confirmacao'
import { vagaEm, type Intervalo } from '@shared/encaixe'
import type { Appointment } from '@shared/schemas'
import { ehPrincipal } from '@shared/tipos'
import type { WaitlistEntry } from '@shared/waitlist'
import { AniversariantesHoje, BoloAniversario } from '@renderer/components/Aniversariantes'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { AvisosDaConfirmacao } from '@renderer/components/confirmacao/AvisosDaConfirmacao'
import { ConfirmacoesDialog } from '@renderer/components/confirmacao/ConfirmacoesDialog'
import { CommitmentDialog, type CommitmentDraft } from '@renderer/components/CommitmentDialog'
import { SlotDialog, type SlotDraft } from '@renderer/components/SlotDialog'
import { WaitlistPanel } from '@renderer/components/waitlist/WaitlistPanel'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { ErrorState } from '@renderer/components/ui/error'
import { CorPonto } from '@renderer/components/ui/cor'
import { Segmented } from '@renderer/components/ui/segmented'
import { Select } from '@renderer/components/ui/select'
import { appointmentsQuery, clinicQuery, commitmentsQuery, tiposQuery } from '@renderer/lib/queries'
import { DEFAULT_DURATION, nextSlot, PRESENCA_LABELS } from '@renderer/lib/session'
import { aoPedirEncaixe, horaDe } from '@renderer/lib/confirmacoes'
import { cn } from '@renderer/lib/utils'
import { corVar } from '@renderer/lib/tipos'
import {
  aoSoltar,
  avisoDeErro,
  descricaoDoAviso,
  desfazer,
  destinoDe,
  gravar,
  horarioDe,
  minutosDaGrade,
  podeArrastar,
  tituloDoAviso,
  type Arrastavel,
  type Destino,
  type Soltura
} from '@renderer/lib/arrastar'
import { useArrastarCartao, type Contexto } from '@renderer/lib/arrastar-cartao'
import { useComputador } from '@renderer/lib/finance'
import { useToast } from '@renderer/lib/toast'
import {
  comAtalho,
  useTeclas,
  textoDaTecla,
  useAtalhos,
  useTextoDoAtalho
} from '@renderer/lib/atalhos'

const WEEK_OPTIONS = { weekStartsOn: 0 as const }

const DragCalendar = withDragAndDrop<CalendarEvent>(Calendar)

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
const STEP = 30
const TIMESLOTS = 2

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

type AppointmentEvent = {
  kind: 'appointment'
  id: number
  title: string
  start: Date
  end: Date
  appointment: Appointment
}

type CommitmentEvent = {
  kind: 'commitment'
  id: string
  title: string
  start: Date
  end: Date
  commitment: Commitment
}

type VagaEvent = { kind: 'vaga'; id: string; title: string; start: Date; end: Date }

type CalendarEvent = AppointmentEvent | CommitmentEvent | VagaEvent

const chave = (event: CalendarEvent | Arrastavel): string =>
  event.kind === 'appointment'
    ? `a${event.appointment.id}`
    : event.kind === 'commitment'
      ? `c${event.commitment.id}`
      : event.id

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

function BlockContent({ event }: { event: CommitmentEvent | VagaEvent }): React.JSX.Element {
  const label = event.kind === 'vaga' ? 'Vaga' : event.commitment.etiqueta_nome
  const titulo = event.kind === 'commitment' ? event.commitment.titulo : ''
  return (
    <span data-chave={chave(event)} className="flex min-w-0 flex-col">
      <span className="truncate">
        {label}
        {titulo && <span className="font-normal opacity-75"> · {titulo}</span>}
      </span>
      {differenceInMinutes(event.end, event.start) >= 45 && (
        <span
          data-horario
          className="event-detail truncate text-xs font-normal tabular-nums opacity-75"
        >
          {timeRange(event)}
        </span>
      )}
    </span>
  )
}

function EventContent({ event }: EventProps<CalendarEvent>): React.JSX.Element {
  if (event.kind !== 'appointment') return <BlockContent event={event} />
  const short = differenceInMinutes(event.end, event.start) < 45
  const start = formatTime(event.start)
  const { tipo_nome: tipoText, assinatura, pedido } = event.appointment
  const confirmado = !assinatura && confirmacao(event.appointment) === 'confirmado'
  const aguardando = !confirmado && pedido?.estado === 'aguardando'
  return (
    <span data-chave={chave(event)} className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="min-w-0 truncate">
          <span className="event-start mr-1.5 hidden font-normal tabular-nums opacity-75">
            {start}
          </span>
          <BoloAniversario patientId={event.appointment.patient_id} dia={event.start} />
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
          {aguardando && (
            <Clock
              aria-label={`${PEDIDO_LABELS.aguardando} até ${horaDe(pedido.prazo)}`}
              className="ml-1 inline size-3 -translate-y-px stroke-[2] opacity-75"
            />
          )}
          {pedido?.estado === 'sem_resposta' && (
            <TimerOff
              aria-label={PEDIDO_LABELS.sem_resposta}
              className="ml-1 inline size-3 -translate-y-px stroke-[2] opacity-75"
            />
          )}
          <span
            className={cn('event-tipo text-xs font-normal opacity-75', !short && 'event-tipo-long')}
          >
            {' · '}
            {tipoText}
          </span>
        </span>
        {short && (
          <span
            data-horario
            className="event-inline-time ml-auto hidden shrink-0 text-xs font-normal tabular-nums opacity-75"
          >
            {timeRange(event)}
          </span>
        )}
      </span>
      {!short && (
        <span
          data-horario
          className="event-detail truncate text-xs font-normal tabular-nums opacity-75"
        >
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
  const { data = [] } = useQuery(tiposQuery())
  const opcoes = data.filter((e) => ehPrincipal(e.categoria))
  const teclas = useTeclas()
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
          title={comAtalho('Anterior', textoDaTecla(teclas['agenda-anterior']))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-chip text-ink"
          onClick={() => onNavigate('TODAY')}
          title={comAtalho('Hoje', textoDaTecla(teclas['agenda-hoje']))}
        >
          Hoje
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-chip"
          onClick={() => onNavigate('NEXT')}
          aria-label="Próximo"
          title={comAtalho('Próximo', textoDaTecla(teclas['agenda-proximo']))}
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
  if (event.kind === 'vaga') return `Vaga · ${timeRange(event)}`
  if (event.kind === 'commitment') {
    const { observacao } = event.commitment
    const nome = commitmentName(event.commitment)
    return `${timeRange(event)} · ${nome}${observacao ? `\n${observacao}` : ''}`
  }
  const { tipo_nome, presenca, observacao } = event.appointment
  const { assinatura, pedido } = event.appointment
  const tags = [
    tipo_nome,
    presenca ? PRESENCA_LABELS[presenca] : '',
    pedido && pedido.estado !== 'confirmado' ? PEDIDO_LABELS[pedido.estado] : '',
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
  onSlot: (slot: SlotDraft, action: SlotInfo['action']) => void
  onCommitment: (commitment: Commitment) => void
  vaga: Intervalo | null
  arrivedRef: RefObject<number | null>
  onMoved: (appointment: Appointment) => void
}

const arrastavel = (event: CalendarEvent): boolean =>
  event.kind !== 'vaga' && podeArrastar(event, new Date())

const AgendaCalendar = memo(function AgendaCalendar({
  events,
  date,
  view,
  funcionamento,
  shownDays,
  onNavigate,
  onView,
  onDraft,
  onSlot,
  onCommitment,
  vaga,
  arrivedRef,
  onMoved
}: AgendaCalendarProps): React.JSX.Element {
  const toast = useToast()
  const queryClient = useQueryClient()
  const computador = useComputador()
  const [movendo, setMovendo] = useState<ReadonlyMap<string, Destino>>(new Map())

  const shown = useMemo(
    () =>
      movendo.size === 0
        ? events
        : events.map((event) => {
            const destino = movendo.get(chave(event))
            return destino
              ? {
                  ...event,
                  start: parseIsoLocalDateTime(destino.inicio),
                  end: parseIsoLocalDateTime(destino.fim)
                }
              : event
          }),
    [events, movendo]
  )

  const { min, max, scrollToTime } = useMemo(() => {
    const base = startOfDay(date)
    const days = view === Views.DAY ? [base] : shownDays
    const { abre, fecha } = gridLimits(funcionamento, days, shown)
    return {
      min: setMinutes(base, abre),
      max: setMinutes(base, fecha),
      scrollToTime: setMinutes(base, abre)
    }
  }, [date, view, shownDays, funcionamento, shown])

  const segurar = useCallback((item: Arrastavel, destino: Destino | null): void => {
    setMovendo((atual) => {
      const next = new Map(atual)
      if (destino) next.set(chave(item), destino)
      else next.delete(chave(item))
      return next
    })
  }, [])

  const aplicar = useCallback(
    async (
      item: Arrastavel,
      destino: Destino,
      gravacao: () => Promise<Arrastavel>,
      feito: (gravado: Arrastavel) => void
    ): Promise<void> => {
      segurar(item, destino)
      try {
        const gravado = await gravacao()
        if (gravado.kind === 'appointment') onMoved(gravado.appointment)
        await queryClient.invalidateQueries({
          queryKey: [gravado.kind === 'appointment' ? 'appointments' : 'commitments']
        })
        feito(gravado)
      } catch (error) {
        toast({
          ...avisoDeErro(error instanceof Error ? error.message : String(error)),
          icon: <CircleAlert />
        })
      } finally {
        segurar(item, null)
      }
    },
    [segurar, onMoved, queryClient, toast]
  )

  const executar = useCallback(
    (item: Arrastavel, soltura: Soltura): void => {
      if (soltura.tipo === 'recusa') {
        toast({ ...avisoDeErro(soltura.problema), icon: <CircleAlert /> })
        return
      }
      if (soltura.tipo === 'volta') return
      const { destino } = soltura
      void aplicar(
        item,
        destino,
        () => gravar(window.api, item, destino, computador),
        (gravado) =>
          toast({
            title: tituloDoAviso(item, destino),
            description: descricaoDoAviso(gravado),
            action: {
              label: 'Desfazer',
              icon: <Undo2 />,
              altText: 'Para desfazer, arraste de volta.',
              onClick: () =>
                void aplicar(
                  gravado,
                  horarioDe(item),
                  () => desfazer(window.api, item, gravado, computador),
                  (volta) => toast({ title: 'Desfeito', description: descricaoDoAviso(volta) })
                )
            }
          })
      )
    },
    [toast, aplicar, computador]
  )

  const mover = useCallback(
    ({ event, start, end }: EventInteractionArgs<CalendarEvent>): void => {
      if (event.kind === 'vaga' || !podeArrastar(event, new Date())) return
      executar(event, aoSoltar(event, destinoDe(start, end), funcionamento, new Date()))
    },
    [funcionamento, executar]
  )

  const redimensionavel = useCallback(
    (event: CalendarEvent): boolean => view !== Views.MONTH && arrastavel(event),
    [view]
  )

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
        onSlot(
          {
            inicio: setMinutes(startOfDay(slot.start), Math.max(minutesOf(horario.abre), 8 * 60)),
            duracao: DEFAULT_DURATION
          },
          slot.action
        )
      } else {
        if (!abertoNoHorario(funcionamento, slot.start)) return
        const selected = differenceInMinutes(slot.end, slot.start)
        onSlot(
          {
            inicio: slot.start,
            duracao:
              slot.action === 'select' && selected > DEFAULT_DURATION ? selected : DEFAULT_DURATION
          },
          slot.action
        )
      }
    },
    [view, funcionamento, onSlot]
  )

  const onSelectEvent = useCallback(
    (event: CalendarEvent): void => {
      if (event.kind === 'appointment') onDraft({ mode: 'edit', appointment: event.appointment })
      else if (event.kind === 'commitment') onCommitment(event.commitment)
    },
    [onDraft, onCommitment]
  )

  const backgroundEvents = useMemo<CalendarEvent[]>(
    () =>
      vaga
        ? [
            {
              kind: 'vaga',
              id: 'vaga',
              title: 'Vaga',
              start: parseIsoLocalDateTime(vaga.inicio),
              end: parseIsoLocalDateTime(vaga.fim)
            }
          ]
        : [],
    [vaga]
  )

  const rootRef = useRef<HTMLDivElement>(null)
  const contexto: Contexto = {
    dias: view === Views.DAY ? [startOfDay(date)] : weekDays(date),
    ...minutosDaGrade(min, max, STEP * TIMESLOTS),
    funcionamento,
    item: (alvo) => {
      const event = shown.find((e) => chave(e) === alvo)
      return event && event.kind !== 'vaga' && podeArrastar(event, new Date()) ? event : null
    },
    soltar: executar
  }
  const arraste = useArrastarCartao(rootRef, contexto)

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
    (event: CalendarEvent): { className?: string; style?: CSSProperties } => {
      const arrastado =
        arraste?.chave === chave(event) &&
        (arraste.fase === 'erguido' ? 'event-origem' : 'event-pousando')
      if (event.kind === 'commitment') {
        const style = { '--tipo-cor': corVar(event.commitment.cor) } as CSSProperties
        return { className: cn('event-block', arrastado), style }
      }
      if (event.kind === 'vaga') return { className: 'event-vaga' }
      const missed =
        event.appointment.presenca === 'falta' || event.appointment.presenca === 'desmarcou'
      const className = cn(
        event.id === arrivedRef.current && 'event-arrived',
        missed && 'event-missed',
        arrastado
      )
      const style = { '--tipo-cor': corVar(event.appointment.tipo_cor) } as CSSProperties
      return className ? { className, style } : { style }
    },
    [arrivedRef, arraste]
  )

  return (
    <div ref={rootRef} className="h-full">
      <DragCalendar
        localizer={localizer}
        culture="pt-BR"
        events={shown}
        backgroundEvents={backgroundEvents}
        date={date}
        view={view}
        onNavigate={onNavigate}
        onView={onView}
        views={VIEWS}
        toolbar={false}
        step={STEP}
        timeslots={TIMESLOTS}
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
        draggableAccessor={arrastavel}
        resizableAccessor={redimensionavel}
        onEventDrop={mover}
        onEventResize={mover}
        className={`agenda-${view}`}
        style={CALENDAR_STYLE}
      />
    </div>
  )
})

const PANEL_KEY = 'auri.agenda.listaDeEspera'

function readPanelOpen(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) !== 'fechado'
  } catch {
    return true
  }
}

function savePanelOpen(open: boolean): void {
  try {
    localStorage.setItem(PANEL_KEY, open ? 'aberto' : 'fechado')
  } catch {
    return
  }
}

function targetDate(state: unknown): string | null {
  const date = (state as { date?: unknown } | null)?.date
  return typeof date === 'string' ? date : null
}

export function AgendaPage(): React.JSX.Element {
  const location = useLocation()
  const target = targetDate(location.state)
  const [date, setDate] = useState(() => (target ? parseIsoLocalDateTime(target) : new Date()))
  const [targetKey, setTargetKey] = useState(location.key)
  if (targetKey !== location.key) {
    setTargetKey(location.key)
    if (target) setDate(parseIsoLocalDateTime(target))
  }
  const [view, setView] = useState<View>(Views.WEEK)
  const [draft, setDraft] = useState<AppointmentDraft | null>(null)
  const [slot, setSlot] = useState<SlotDraft | null>(null)
  const [commitment, setCommitment] = useState<Commitment | null>(null)
  const commitmentDraft = useMemo<CommitmentDraft | null>(
    () => (commitment ? { mode: 'edit', commitment } : null),
    [commitment]
  )
  const [panelOpen, setPanelOpen] = useState(readPanelOpen)
  const [vaga, setVaga] = useState<Intervalo | null>(null)
  const [confirmacoes, setConfirmacoes] = useState(false)
  const arrivedRef = useRef<number | null>(null)
  const markArrived = useCallback((appointment: Appointment): void => {
    arrivedRef.current = appointment.id
    setVaga(null)
    setTimeout(() => {
      if (arrivedRef.current === appointment.id) arrivedRef.current = null
    }, ARRIVED_MS)
  }, [])

  const queryClient = useQueryClient()
  const clinic = useQuery(clinicQuery())
  const funcionamento = clinic.data?.funcionamento ?? FUNCIONAMENTO_PADRAO
  const range = visibleRange(date, view)
  const { data, error, refetch } = useQuery({
    ...appointmentsQuery(range),
    placeholderData: (previous) => previous
  })
  const commitments = useQuery({
    ...commitmentsQuery(range),
    placeholderData: (previous) => previous
  })
  const failed = error !== null && data === undefined

  const [etiqueta, setEtiqueta] = useState<number | null>(null)
  const allEvents = useMemo<CalendarEvent[]>(
    () => [
      ...(data ?? []).map((a): CalendarEvent => ({
        kind: 'appointment',
        id: a.id,
        title: a.patient_nome,
        start: parseIsoLocalDateTime(a.inicio),
        end: parseIsoLocalDateTime(a.fim),
        appointment: a
      })),
      ...(commitments.data ?? []).map((c): CalendarEvent => ({
        kind: 'commitment',
        id: `c${c.id}`,
        title: c.etiqueta_nome,
        start: parseIsoLocalDateTime(c.inicio),
        end: parseIsoLocalDateTime(c.fim),
        commitment: c
      }))
    ],
    [data, commitments.data]
  )
  const events = useMemo(
    () =>
      etiqueta === null
        ? allEvents
        : allEvents.filter((e) => e.kind !== 'appointment' || e.appointment.tipo_id === etiqueta),
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
      for (const range of ranges) {
        void queryClient.prefetchQuery(appointmentsQuery(range))
        void queryClient.prefetchQuery(commitmentsQuery(range))
      }
    })
    return () => cancelIdleCallback(idle)
  }, [date, view, funcionamento, queryClient])

  const navigate = useCallback(
    (action: NavAction): void =>
      setDate((current) => navigateDate(current, view, action, funcionamento)),
    [view, funcionamento]
  )

  const openNew = useCallback((): void => {
    setSlot({ inicio: nextSlot(new Date(), funcionamento), duracao: DEFAULT_DURATION })
  }, [funcionamento])

  const withPanel = panelOpen && view !== Views.MONTH

  const turnos = useMemo(
    () =>
      DIAS_SEMANA.flatMap((dia) =>
        funcionamento[dia] ? [{ dia_semana: dia, ...funcionamento[dia] }] : []
      ),
    [funcionamento]
  )

  const onSlot = useCallback(
    (picked: SlotDraft, action: SlotInfo['action']): void => {
      if (!withPanel || action !== 'click') {
        setSlot(picked)
        return
      }
      const ocupados = events.flatMap((e) =>
        e.kind === 'commitment' ||
        (e.kind === 'appointment' && e.appointment.presenca !== 'desmarcou')
          ? [{ inicio: toIsoLocalDateTime(e.start), fim: toIsoLocalDateTime(e.end) }]
          : []
      )
      setVaga(vagaEm(toIsoLocalDateTime(picked.inicio), turnos, ocupados))
    },
    [withPanel, events, turnos]
  )

  const encaixar = useCallback((livre: Vaga): void => {
    setView((current) => (current === Views.MONTH ? Views.WEEK : current))
    setDate(parseIsoLocalDateTime(livre.inicio))
    setPanelOpen(true)
    savePanelOpen(true)
    setVaga(livre)
  }, [])

  useEffect(() => aoPedirEncaixe(encaixar), [encaixar])

  const togglePanel = (): void => {
    const next = !panelOpen
    setPanelOpen(next)
    savePanelOpen(next)
    if (!next) setVaga(null)
  }

  const pickFromWaitlist = useCallback((entry: WaitlistEntry, horario: Intervalo): void => {
    setDraft({
      mode: 'create',
      inicio: parseIsoLocalDateTime(horario.inicio),
      duracao: entry.duracao,
      patient: { id: entry.patient_id, nome: entry.patient_nome }
    })
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setVaga(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useAtalhos({
    'agenda-novo': openNew,
    'agenda-hoje': () => navigate('TODAY'),
    'agenda-anterior': () => navigate('PREV'),
    'agenda-proximo': () => navigate('NEXT'),
    'agenda-dia': () => setView(Views.DAY),
    'agenda-semana': () => setView(Views.WEEK),
    'agenda-mes': () => setView(Views.MONTH)
  })
  const novoAtalho = useTextoDoAtalho('agenda-novo')

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
        <>
          <AniversariantesHoje />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmacoes(true)}
            aria-label="Confirmações"
            title="Pedir a confirmação das sessões do próximo dia"
          >
            <CalendarCheck />
          </Button>
          {view !== Views.MONTH && (
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePanel}
              aria-expanded={panelOpen}
              aria-label="Lista de espera"
              title={panelOpen ? 'Esconder a lista de espera' : 'Mostrar a lista de espera'}
            >
              <Hourglass />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={openNew}
            aria-label="Novo agendamento"
            title={comAtalho('Novo agendamento', novoAtalho)}
          >
            <Plus />
          </Button>
        </>
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
        <>
          <AvisosDaConfirmacao onEncaixar={encaixar} />
          <div className="flex min-h-0 flex-1">
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
                onSlot={onSlot}
                onCommitment={setCommitment}
                vaga={withPanel ? vaga : null}
                arrivedRef={arrivedRef}
                onMoved={markArrived}
              />
            </div>
            {withPanel && (
              <aside
                aria-label="Encaixe"
                className="flex w-72 shrink-0 animate-fade-in flex-col overflow-y-auto pt-3 pr-3 pb-20 pl-2"
              >
                <WaitlistPanel
                  vaga={vaga}
                  onPick={pickFromWaitlist}
                  vagaActions={
                    vaga && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Marcar neste horário"
                          title="Marcar neste horário"
                          onClick={() =>
                            setSlot({
                              inicio: parseIsoLocalDateTime(vaga.inicio),
                              duracao: DEFAULT_DURATION
                            })
                          }
                        >
                          <Plus />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Ver a lista toda"
                          title="Ver a lista toda (Esc)"
                          onClick={() => setVaga(null)}
                        >
                          <X />
                        </Button>
                      </>
                    )
                  }
                />
              </aside>
            )}
          </div>
        </>
      )}
      <ConfirmacoesDialog open={confirmacoes} onClose={() => setConfirmacoes(false)} />
      <AppointmentDialog draft={draft} onClose={() => setDraft(null)} onSaved={markArrived} />
      <SlotDialog slot={slot} onClose={() => setSlot(null)} onSaved={markArrived} />
      <CommitmentDialog
        draft={commitmentDraft}
        onClose={() => setCommitment(null)}
        onScheduleReserve={(reserve) => {
          setCommitment(null)
          const inicio = parseIsoLocalDateTime(reserve.inicio)
          setDraft({
            mode: 'create',
            inicio,
            duracao: differenceInMinutes(parseIsoLocalDateTime(reserve.fim), inicio),
            reserveId: reserve.id
          })
        }}
      />
    </Page>
  )
}
