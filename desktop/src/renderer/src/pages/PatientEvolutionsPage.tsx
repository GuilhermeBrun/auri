import { useMutation, useQuery } from '@tanstack/react-query'
import { format, isSameYear, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { FileDown, NotebookPen, SearchX } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { isIsoDate, parseIsoLocalDateTime } from '@shared/dates'
import type { Appointment } from '@shared/schemas'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { DateBlock } from '@renderer/components/DateBlock'
import { Page } from '@renderer/components/Layout'
import { PATIENT_COLUMN, PatientHeader } from '@renderer/components/PatientHeader'
import { Button } from '@renderer/components/ui/button'
import { DateField } from '@renderer/components/ui/date-field'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorState } from '@renderer/components/ui/error'
import { Field } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import { Segmented } from '@renderer/components/ui/segmented'
import { monthRange, type Range } from '@renderer/lib/period'
import { patientAppointmentsQuery, patientQuery } from '@renderer/lib/queries'
import { PATIENTS_CRUMB, PRESENCA_LABELS, spokenDate, timeRange } from '@renderer/lib/session'
import { useToast } from '@renderer/lib/toast'

const PERIODOS = [
  ['tudo', 'Tudo'],
  ['atual', 'Este mês'],
  ['anterior', 'Mês passado'],
  ['outro', 'Outro período']
] as const

type Periodo = (typeof PERIODOS)[number][0]

const day = (a: Appointment): string => a.inicio.slice(0, 10)

export function PatientEvolutionsRoute(): React.JSX.Element {
  const patientId = Number(useParams().id)
  return <PatientEvolutionsPage key={patientId} patientId={patientId} />
}

function PatientEvolutionsPage({ patientId }: { patientId: number }): React.JSX.Element {
  const patient = useQuery(patientQuery(patientId))
  const sessions = useQuery(patientAppointmentsQuery(patientId))
  const [draft, setDraft] = useState<AppointmentDraft | null>(null)
  const [now] = useState(() => new Date())
  const [periodo, setPeriodo] = useState<Periodo>('tudo')
  const [custom, setCustom] = useState<Range>(() => monthRange(now))
  const toast = useToast()
  const error = patient.error ?? sessions.error

  const evolutions = useMemo(
    () => (sessions.data ?? []).filter((a) => a.evolucao.trim() !== ''),
    [sessions.data]
  )

  const range: Range | null =
    periodo === 'atual'
      ? monthRange(now)
      : periodo === 'anterior'
        ? monthRange(subMonths(now, 1))
        : periodo === 'outro'
          ? custom
          : evolutions.length
            ? { de: day(evolutions.at(-1)!), ate: day(evolutions[0]) }
            : null
  const valid =
    range !== null && isIsoDate(range.de) && isIsoDate(range.ate) && range.ate >= range.de

  const shown =
    periodo === 'tudo'
      ? evolutions
      : valid
        ? evolutions.filter((a) => day(a) >= range.de && day(a) <= range.ate)
        : []

  const pdf = useMutation({
    mutationFn: ({ de, ate }: Range) => window.api.documents.evolutionsPdf(patientId, de, ate),
    onSuccess: (file) => {
      if (file) toast({ title: 'Relatório salvo', description: file.split(/[\\/]/).at(-1) })
    },
    onError: (e) => toast({ title: 'Não foi possível gerar o relatório', description: e.message })
  })

  const state = error ? (
    <ErrorState
      title="Não foi possível abrir as evoluções"
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
      trail={[PATIENTS_CRUMB, { label: patient.data?.nome ?? 'Evoluções' }]}
      actions={
        <Button
          variant="ghost"
          size="icon"
          onClick={() => valid && pdf.mutate(range)}
          disabled={!valid || shown.length === 0}
          loading={pdf.isPending}
          aria-label="Relatório de evolução do período"
          title="Relatório de evolução do período"
        >
          <FileDown />
        </Button>
      }
    >
      <div className={PATIENT_COLUMN}>
        {patient.data && (
          <PatientHeader
            nome={patient.data.nome}
            nascimento={patient.data.data_nascimento}
            inativo={!patient.data.ativo}
            tabs={{ patientId, value: 'evolucoes' }}
          />
        )}
        {patient.data && sessions.data ? (
          evolutions.length === 0 ? (
            <NoEvolutions patientId={patientId} />
          ) : (
            <>
              <PeriodFilter
                periodo={periodo}
                onPeriodo={setPeriodo}
                custom={custom}
                onCustom={setCustom}
                count={shown.length}
              />
              {shown.length === 0 ? (
                <EmptyState
                  icon={<SearchX />}
                  title="Nenhuma evolução neste período"
                  action={
                    <Button variant="secondary" onClick={() => setPeriodo('tudo')}>
                      Ver todas
                    </Button>
                  }
                />
              ) : (
                <EvolutionList
                  evolutions={shown}
                  now={now}
                  onOpen={(appointment) => setDraft({ mode: 'edit', appointment })}
                />
              )}
            </>
          )
        ) : (
          state
        )}
      </div>
      <AppointmentDialog draft={draft} onClose={() => setDraft(null)} />
    </Page>
  )
}

function NoEvolutions({ patientId }: { patientId: number }): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={<NotebookPen />}
      title="Nenhuma evolução ainda"
      action={
        <Button
          variant="secondary"
          onClick={() => void navigate(`/pacientes/${patientId}/sessoes`)}
        >
          Abrir sessões
        </Button>
      }
    >
      A evolução se escreve no registro de cada sessão.
    </EmptyState>
  )
}

function PeriodFilter({
  periodo,
  onPeriodo,
  custom,
  onCustom,
  count
}: {
  periodo: Periodo
  onPeriodo: (periodo: Periodo) => void
  custom: Range
  onCustom: (update: (range: Range) => Range) => void
  count: number
}): React.JSX.Element {
  const ids = useId()
  return (
    <div className="mb-8 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Segmented label="Período" value={periodo} options={PERIODOS} onChange={onPeriodo} />
        <p className="text-xs text-ink-soft tabular-nums" aria-live="polite">
          {count === 1 ? '1 evolução' : `${count} evoluções`}
        </p>
      </div>
      {periodo === 'outro' && (
        <div className="grid max-w-[360px] animate-fade-in grid-cols-2 gap-3">
          <Field label="De" htmlFor={`${ids}-de`}>
            <DateField
              id={`${ids}-de`}
              value={custom.de}
              onChange={(de) => onCustom((c) => ({ ...c, de }))}
              invalid={!isIsoDate(custom.de)}
            />
          </Field>
          <Field label="Até" htmlFor={`${ids}-ate`}>
            <DateField
              id={`${ids}-ate`}
              value={custom.ate}
              onChange={(ate) => onCustom((c) => ({ ...c, ate }))}
              invalid={!isIsoDate(custom.ate) || custom.ate < custom.de}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function EvolutionList({
  evolutions,
  now,
  onOpen
}: {
  evolutions: Appointment[]
  now: Date
  onOpen: (appointment: Appointment) => void
}): React.JSX.Element {
  const months = useMemo(() => {
    const groups: { key: string; label: string; items: Appointment[] }[] = []
    for (const a of evolutions) {
      const inicio = parseIsoLocalDateTime(a.inicio)
      const key = format(inicio, 'yyyy-MM')
      const last = groups.at(-1)
      if (last?.key === key) last.items.push(a)
      else {
        const month = capitalize(format(inicio, 'LLLL', { locale: ptBR }))
        groups.push({
          key,
          label: isSameYear(inicio, now) ? month : `${month} de ${format(inicio, 'yyyy')}`,
          items: [a]
        })
      }
    }
    return groups
  }, [evolutions, now])

  return (
    <div className="flex flex-col gap-8">
      {months.map((m) => (
        <section key={m.key} aria-labelledby={`evolucoes-${m.key}`}>
          <h2 id={`evolucoes-${m.key}`} className="mb-1 text-xs font-medium text-ink-faint">
            {m.label}
          </h2>
          <ul className="-mx-3 flex flex-col gap-1">
            {m.items.map((a) => (
              <li key={a.id}>
                <EvolutionRow appointment={a} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EvolutionRow({
  appointment: a,
  onOpen
}: {
  appointment: Appointment
  onOpen: (appointment: Appointment) => void
}): React.JSX.Element {
  const inicio = parseIsoLocalDateTime(a.inicio)
  const meta = [timeRange(a), a.tipo_nome, a.presenca ? PRESENCA_LABELS[a.presenca] : ''].filter(
    Boolean
  )
  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      className="grid w-full grid-cols-[44px_1fr] gap-4 rounded-card px-3 py-3 text-left transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
    >
      <span className="sr-only">{spokenDate(inicio)}, </span>
      <DateBlock date={inicio} />
      <span className="flex min-w-0 flex-col gap-1 pt-0.5">
        <span className="text-xs text-ink-soft tabular-nums">{meta.join(' · ')}</span>
        <span className="text-[13px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
          {a.evolucao}
        </span>
      </span>
    </button>
  )
}
