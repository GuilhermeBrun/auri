import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, format, isSameYear } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { CalendarClock, Check, CircleDashed, FileText, Plus, Undo2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { formatTime, parseIsoLocalDateTime } from '@shared/dates'
import type { Appointment, AttendanceRecord, Patient, Presenca } from '@shared/schemas'
import { AttendanceChart } from '@renderer/components/AttendanceChart'
import { AttendanceReportDialog, MonthReportButton } from '@renderer/components/AttendanceReport'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { Page } from '@renderer/components/Layout'
import { SignatureImage } from '@renderer/components/SignatureImage'
import { PATIENT_COLUMN, PatientHeader } from '@renderer/components/PatientHeader'
import { Button } from '@renderer/components/ui/button'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorState } from '@renderer/components/ui/error'
import { Loading } from '@renderer/components/ui/loading'
import {
  patientAppointmentsQuery,
  patientAttendanceQuery,
  patientQuery
} from '@renderer/lib/queries'
import { DEFAULT_DURATION, nextSlot, PATIENTS_CRUMB, PRESENCA_LABELS } from '@renderer/lib/session'
import { cn } from '@renderer/lib/utils'

export function PatientSessionsRoute(): React.JSX.Element {
  const patientId = Number(useParams().id)
  return <PatientSessionsPage key={patientId} patientId={patientId} />
}

function PatientSessionsPage({ patientId }: { patientId: number }): React.JSX.Element {
  const patient = useQuery(patientQuery(patientId))
  const sessions = useQuery(patientAppointmentsQuery(patientId))
  const attendance = useQuery(patientAttendanceQuery(patientId))
  const [draft, setDraft] = useState<AppointmentDraft | null>(null)
  const [reporting, setReporting] = useState(false)
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
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setReporting(true)}
            disabled={!sessions.data?.length}
            aria-label="Relatório de presença"
            title="Relatório de presença"
          >
            <FileText />
          </Button>
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
        </>
      }
    >
      {patient.data && sessions.data ? (
        <SessionList
          patient={patient.data}
          sessions={sessions.data}
          records={attendance.data ?? []}
          onOpen={(appointment) => setDraft({ mode: 'edit', appointment })}
          onSchedule={schedule}
        />
      ) : patient.data ? (
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
      <AttendanceReportDialog patientId={patientId} open={reporting} onOpenChange={setReporting} />
    </Page>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function weekdayShort(date: Date): string {
  return format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
}

function timeRange(a: Appointment): string {
  return `${formatTime(parseIsoLocalDateTime(a.inicio))}–${formatTime(parseIsoLocalDateTime(a.fim))}`
}

function spokenDate(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function SessionList({
  patient,
  sessions,
  records,
  onOpen,
  onSchedule
}: {
  patient: Patient
  sessions: Appointment[]
  records: AttendanceRecord[]
  onOpen: (appointment: Appointment) => void
  onSchedule: () => void
}): React.JSX.Element {
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
          {past.length > 0 && (
            <Past
              patientId={patient.id}
              sessions={past}
              records={records}
              now={now}
              onOpen={onOpen}
            />
          )}
        </div>
      )}
    </div>
  )
}

function relativeDay(date: Date, now: Date): string {
  const days = differenceInCalendarDays(date, now)
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  return `em ${days} dias`
}

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

function Past({
  patientId,
  sessions,
  records,
  now,
  onOpen
}: {
  patientId: number
  sessions: Appointment[]
  records: AttendanceRecord[]
  now: Date
  onOpen: (appointment: Appointment) => void
}): React.JSX.Element {
  const months = useMemo(() => {
    const groups: { key: string; label: string; month: Date; sessions: Appointment[] }[] = []
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
          month: inicio,
          sessions: [a]
        })
      }
    }
    return groups
  }, [sessions, now])

  const byAppointment = useMemo(() => {
    const map = new Map<number, AttendanceRecord[]>()
    for (const r of records) map.set(r.appointment_id, [...(map.get(r.appointment_id) ?? []), r])
    return map
  }, [records])

  return (
    <section aria-labelledby="anteriores">
      <h2 id="anteriores" className="text-[15px] font-semibold tracking-tight">
        Anteriores
      </h2>
      <div className="mt-3 flex flex-col gap-6">
        {months.map((m) => (
          <div key={m.key}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-ink-faint">{m.label}</h3>
              <MonthReportButton patientId={patientId} month={m.month} />
            </div>
            <ul className="-mx-3 flex flex-col">
              {m.sessions.map((a) => (
                <li key={a.id}>
                  <SessionRow
                    appointment={a}
                    records={byAppointment.get(a.id) ?? []}
                    onOpen={onOpen}
                  />
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

function clock(iso: string): string {
  return format(new Date(iso), 'HH:mm')
}

function SignatureNote({
  appointment: a,
  records
}: {
  appointment: Appointment
  records: AttendanceRecord[]
}): React.JSX.Element | null {
  const active = records.find((r) => r.anulada === null)
  if (active)
    return (
      <span className="text-xs text-ink-soft">
        {active.signer_parentesco} · {clock(active.assinado_em)}
      </span>
    )
  if (records.length > 0) return <span className="text-xs text-ink-faint">assinatura anulada</span>
  if (a.presenca === 'presente')
    return <span className="text-xs text-ink-faint">sem assinatura</span>
  return null
}

function SessionRow({
  appointment: a,
  records,
  onOpen
}: {
  appointment: Appointment
  records: AttendanceRecord[]
  onOpen: (appointment: Appointment) => void
}): React.JSX.Element {
  const inicio = parseIsoLocalDateTime(a.inicio)
  const missed = a.presenca === 'falta' || a.presenca === 'desmarcou'
  const active = records.find((r) => r.anulada === null)

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

      <span className="flex items-center gap-3 self-center">
        {active && (
          <SignatureImage
            traco={active.traco}
            label={`Assinatura de ${active.signer_nome}`}
            className="h-7 w-[70px]"
          />
        )}
        <span className="flex min-w-[92px] flex-col items-start gap-0.5">
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5 [&_svg]:stroke-[2]',
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
          <SignatureNote appointment={a} records={records} />
        </span>
      </span>
    </button>
  )
}
