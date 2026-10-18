import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, format, isSameYear } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { CalendarClock, Check, CircleDashed, Plus, Undo2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { formatTime, parseIsoLocalDateTime } from '@shared/dates'
import type { Appointment, Patient, Presenca } from '@shared/schemas'
import { AttendanceChart } from '@renderer/components/AttendanceChart'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { Page } from '@renderer/components/Layout'
import { PATIENT_COLUMN, PatientHeader } from '@renderer/components/PatientHeader'
import { Button } from '@renderer/components/ui/button'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorState } from '@renderer/components/ui/error'
import { Loading } from '@renderer/components/ui/loading'
import { patientAppointmentsQuery, patientQuery } from '@renderer/lib/queries'
import { DEFAULT_DURATION, nextSlot, PATIENTS_CRUMB, PRESENCA_LABELS } from '@renderer/lib/session'
import { cn } from '@renderer/lib/utils'

export function PatientSessionsRoute(): React.JSX.Element {
  const patientId = Number(useParams().id)
  return <PatientSessionsPage key={patientId} patientId={patientId} />
}

function PatientSessionsPage({ patientId }: { patientId: number }): React.JSX.Element {
  const patient = useQuery(patientQuery(patientId))
  const sessions = useQuery(patientAppointmentsQuery(patientId))
  const [draft, setDraft] = useState<AppointmentDraft | null>(null)
  const error = patient.error ?? sessions.error

  const schedule = (): void => {
    if (!patient.data) return
    setDraft({
      mode: 'create',
      inicio: nextSlot(new Date()),
      duracao: DEFAULT_DURATION,
      patient: { id: patient.data.id, nome: patient.data.nome }
    })
  }

  const state = error ? (
    <ErrorState
      title="Não foi possível abrir as sessões"
      detail={error.message}
      onRetry={() => {
        void patient.refetch()
        void sessions.refetch()
      }}
    >
      Tente de novo. Se o problema continuar, feche e abra o Auri.
    </ErrorState>
  ) : (
    <Loading />
  )

  return (
    <Page
      trail={[PATIENTS_CRUMB, { label: patient.data?.nome ?? 'Sessões' }]}
      actions={
        <Button
          variant="ghost"
          size="icon"
          onClick={schedule}
          disabled={!patient.data}
          aria-label="Nova sessão"
          title="Nova sessão"
        >
          <Plus />
        </Button>
      }
    >
      {patient.data && sessions.data ? (
        <SessionList
          patient={patient.data}
          sessions={sessions.data}
          onOpen={(appointment) => setDraft({ mode: 'edit', appointment })}
          onSchedule={schedule}
        />
      ) : patient.data ? (
        // com o paciente já em mãos, nome e abas ficam no lugar enquanto as sessões chegam
        <div className={PATIENT_COLUMN}>
          <PatientHeader
            nome={patient.data.nome}
            nascimento={patient.data.data_nascimento}
            inativo={!patient.data.ativo}
            tabs={{ patientId, value: 'sessoes' }}
          />
          {state}
        </div>
      ) : (
        state
      )}
      <AppointmentDialog draft={draft} onClose={() => setDraft(null)} />
    </Page>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "sáb", sem o ponto que o date-fns põe na abreviação. */
function weekdayShort(date: Date): string {
  return format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
}

function timeRange(a: Appointment): string {
  return `${formatTime(parseIsoLocalDateTime(a.inicio))}–${formatTime(parseIsoLocalDateTime(a.fim))}`
}

/** Nome completo da data, para quem ouve a tela: o bloco visível só mostra o dia e a semana. */
function spokenDate(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function SessionList({
  patient,
  sessions,
  onOpen,
  onSchedule
}: {
  patient: Patient
  sessions: Appointment[]
  onOpen: (appointment: Appointment) => void
  onSchedule: () => void
}): React.JSX.Element {
  // a lista vem da mais nova para a mais antiga; as próximas aparecem da mais perto para a mais longe
  // "agora" de quando a lista abriu: uma sessão não muda de grupo enquanto se olha para ela
  const [now] = useState(() => new Date())
  const { upcoming, past } = useMemo(() => {
    const started = (a: Appointment): boolean => parseIsoLocalDateTime(a.inicio) <= now
    return {
      upcoming: sessions.filter((a) => !started(a)).reverse(),
      past: sessions.filter(started)
    }
  }, [sessions, now])

  return (
    <div className={PATIENT_COLUMN}>
      <PatientHeader
        nome={patient.nome}
        nascimento={patient.data_nascimento}
        inativo={!patient.ativo}
        tabs={{ patientId: patient.id, value: 'sessoes' }}
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="Nenhuma sessão ainda"
          action={
            <Button variant="secondary" onClick={onSchedule}>
              <Plus /> Agendar sessão
            </Button>
          }
        >
          As sessões agendadas aparecem aqui. Para lançar as das fichas de papel, agende com a data
          em que aconteceram e marque a presença.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-10">
          {past.length > 0 && <AttendanceChart sessions={past} onOpen={onOpen} />}
          {upcoming.length > 0 && <Upcoming sessions={upcoming} now={now} onOpen={onOpen} />}
          {past.length > 0 && <Past sessions={past} now={now} onOpen={onOpen} />}
        </div>
      )}
    </div>
  )
}

/** "hoje", "amanhã", "em 3 dias". */
function relativeDay(date: Date, now: Date): string {
  const days = differenceInCalendarDays(date, now)
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  return `em ${days} dias`
}

/** As próximas, em blocos lado a lado: ainda não têm presença nem evolução para mostrar. */
function Upcoming({
  sessions,
  now,
  onOpen
}: {
  sessions: Appointment[]
  now: Date
  onOpen: (appointment: Appointment) => void
}): React.JSX.Element {
  return (
    <section aria-labelledby="proximas">
      <h2 id="proximas" className="text-[15px] font-semibold tracking-tight">
        Próximas
      </h2>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {sessions.map((a) => {
          const inicio = parseIsoLocalDateTime(a.inicio)
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onOpen(a)}
                className="flex w-full items-center gap-3 rounded-card bg-fill p-3 text-left transition-colors hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="sr-only">{spokenDate(inicio)}, </span>
                <DateBlock date={inicio} className="bg-surface" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-medium tabular-nums">{timeRange(a)}</span>
                  <span className="truncate text-xs text-ink-soft">
                    {a.tipo === 'avaliacao' ? 'Avaliação · ' : ''}
                    {relativeDay(inicio, now)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Dia grande e dia da semana pequeno, como no cabeçalho da agenda. */
function DateBlock({
  date,
  muted,
  className
}: {
  date: Date
  muted?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 flex-col items-center justify-center rounded-control tabular-nums',
        muted && 'text-ink-faint',
        className
      )}
    >
      <span className="text-[17px] leading-none font-semibold tracking-tight">
        {format(date, 'd')}
      </span>
      <span className={cn('mt-1 text-xs leading-none', muted ? 'text-ink-faint' : 'text-ink-soft')}>
        {weekdayShort(date)}
      </span>
    </span>
  )
}

/** As anteriores agrupadas por mês, como as folhas de papel; a mais nova primeiro. */
function Past({
  sessions,
  now,
  onOpen
}: {
  sessions: Appointment[]
  now: Date
  onOpen: (appointment: Appointment) => void
}): React.JSX.Element {
  const months = useMemo(() => {
    const groups: { key: string; label: string; sessions: Appointment[] }[] = []
    for (const a of sessions) {
      const inicio = parseIsoLocalDateTime(a.inicio)
      const key = format(inicio, 'yyyy-MM')
      const last = groups.at(-1)
      if (last?.key === key) last.sessions.push(a)
      else {
        const month = capitalize(format(inicio, 'LLLL', { locale: ptBR }))
        groups.push({
          key,
          label: isSameYear(inicio, now) ? month : `${month} de ${format(inicio, 'yyyy')}`,
          sessions: [a]
        })
      }
    }
    return groups
  }, [sessions, now])

  return (
    <section aria-labelledby="anteriores">
      <h2 id="anteriores" className="text-[15px] font-semibold tracking-tight">
        Anteriores
      </h2>
      <div className="mt-3 flex flex-col gap-6">
        {months.map((m) => (
          <div key={m.key}>
            <h3 className="mb-1 text-xs font-medium text-ink-faint">{m.label}</h3>
            <ul className="-mx-3 flex flex-col">
              {m.sessions.map((a) => (
                <li key={a.id}>
                  <SessionRow appointment={a} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

const PRESENCA_ICONS: Record<Presenca, React.ReactNode> = {
  presente: <Check />,
  falta: <X />,
  desmarcou: <Undo2 />
}

/** Uma linha da tabela DATA / PRESENÇA da folha: quando, o tipo, a evolução e a presença. */
function SessionRow({
  appointment: a,
  onOpen
}: {
  appointment: Appointment
  onOpen: (appointment: Appointment) => void
}): React.JSX.Element {
  const inicio = parseIsoLocalDateTime(a.inicio)
  const missed = a.presenca === 'falta' || a.presenca === 'desmarcou'

  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      className="grid w-full grid-cols-[44px_1fr_auto] items-center gap-4 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
    >
      <span className="sr-only">{spokenDate(inicio)}, </span>
      <DateBlock date={inicio} muted={missed} />

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className={cn('text-[13px] font-medium tabular-nums', missed && 'text-ink-soft')}>
            {timeRange(a)}
          </span>
          {a.tipo === 'avaliacao' && (
            <span className="rounded-chip bg-fill px-1.5 py-px text-xs font-medium text-ink">
              Avaliação
            </span>
          )}
        </span>
        {a.evolucao ? (
          <span className="line-clamp-2 text-[13px] text-ink-soft" title={a.evolucao}>
            {a.evolucao}
          </span>
        ) : (
          a.presenca === 'presente' && <span className="text-xs text-ink-faint">Sem evolução</span>
        )}
      </span>

      <span
        className={cn(
          'flex items-center gap-1.5 self-center text-xs font-medium [&_svg]:size-3.5 [&_svg]:stroke-[2]',
          a.presenca === 'presente' || a.presenca === '' ? 'text-ink' : 'text-ink-soft'
        )}
      >
        {a.presenca ? (
          <>
            {PRESENCA_ICONS[a.presenca]}
            {PRESENCA_LABELS[a.presenca]}
          </>
        ) : (
          <>
            <CircleDashed />
            Sem registro
          </>
        )}
      </span>
    </button>
  )
}
