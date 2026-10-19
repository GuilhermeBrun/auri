import { useQuery } from '@tanstack/react-query'
import { addDays } from 'date-fns'
import { ChevronDown, Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toIsoDate } from '@shared/dates'
import type { Intervalo } from '@shared/encaixe'
import type { WaitlistEntry } from '@shared/waitlist'
import { Avatar } from '@renderer/components/ui/avatar'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { WaitlistDialog, type WaitlistTarget } from '@renderer/components/waitlist/WaitlistDialog'
import { quemCabeQuery, sugestoesQuery, waitlistQuery } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/utils'
import { esperaTexto, horarioTexto, preferenciasTexto } from '@renderer/lib/waitlist'

export const SUGESTAO_DIAS = 14
const SUGESTOES_VISIVEIS = 6

type OnPick = (entry: WaitlistEntry, horario: Intervalo) => void

type WaitlistPanelProps = {
  vaga?: Intervalo | null
  onPick?: OnPick
  vagaActions?: ReactNode
  className?: string
}

export function WaitlistPanel({
  vaga,
  onPick,
  vagaActions,
  className
}: WaitlistPanelProps): React.JSX.Element {
  const [editing, setEditing] = useState<WaitlistTarget | null>(null)
  const edit = (entry: WaitlistEntry): void =>
    setEditing({ patient: { id: entry.patient_id, nome: entry.patient_nome }, entry })
  return (
    <section aria-label="Lista de espera" className={cn('flex min-w-0 flex-col', className)}>
      {vaga ? (
        <VagaList vaga={vaga} onEdit={edit} onPick={onPick} actions={vagaActions} />
      ) : (
        <FullList onEdit={edit} onPick={onPick} />
      )}
      <WaitlistDialog target={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

function PanelHeader({
  title,
  actions,
  children
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-3 flex items-start gap-2 px-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-soft tabular-nums">{children}</p>
      </div>
      {actions && <div className="-mt-1 -mr-1.5 flex shrink-0 items-center">{actions}</div>}
    </div>
  )
}

function Note({ children, tone }: { children: ReactNode; tone?: 'danger' }): React.JSX.Element {
  return (
    <p
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn(
        'animate-fade-in px-3 text-xs text-ink-soft',
        tone === 'danger' && 'text-danger'
      )}
    >
      {children}
    </p>
  )
}

function FullList({
  onEdit,
  onPick
}: {
  onEdit: (entry: WaitlistEntry) => void
  onPick?: OnPick
}): React.JSX.Element {
  const list = useQuery(waitlistQuery())
  const [open, setOpen] = useState<number | null>(null)
  const [now] = useState(() => new Date())
  const total = list.data?.length ?? 0

  return (
    <>
      <PanelHeader title="Lista de espera">
        {list.data
          ? total === 0
            ? 'Ninguém esperando horário'
            : total === 1
              ? '1 paciente esperando horário'
              : `${total} pacientes esperando horário`
          : ' '}
      </PanelHeader>
      {list.error ? (
        <Note tone="danger">Não foi possível abrir a lista. {list.error.message}</Note>
      ) : list.data?.length === 0 ? (
        <Note>
          Para pôr um paciente na lista, abra a ficha dele e use “Pôr na lista de espera”.
        </Note>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.data?.map((entry) => (
            <EntryRow key={entry.id} entry={entry} now={now} onEdit={onEdit}>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2.5 self-start"
                aria-expanded={open === entry.id}
                onClick={() => setOpen(open === entry.id ? null : entry.id)}
              >
                Horários livres
                <ChevronDown
                  className={cn(
                    'transition-transform duration-150',
                    open === entry.id && 'rotate-180'
                  )}
                />
              </Button>
              {open === entry.id && <Suggestions entry={entry} now={now} onPick={onPick} />}
            </EntryRow>
          ))}
        </ul>
      )}
    </>
  )
}

function VagaList({
  vaga,
  onEdit,
  onPick,
  actions
}: {
  vaga: Intervalo
  onEdit: (entry: WaitlistEntry) => void
  onPick?: OnPick
  actions?: ReactNode
}): React.JSX.Element {
  const cabem = useQuery(quemCabeQuery({ inicio: vaga.inicio, fim: vaga.fim }))
  const [now] = useState(() => new Date())
  return (
    <>
      <PanelHeader title="Cabem neste horário" actions={actions}>
        {horarioTexto(vaga)}
      </PanelHeader>
      {cabem.error ? (
        <Note tone="danger">Não foi possível procurar. {cabem.error.message}</Note>
      ) : cabem.data?.length === 0 ? (
        <Note>Ninguém da lista de espera cabe neste horário.</Note>
      ) : (
        <ul className="flex flex-col gap-1">
          {cabem.data?.map((encaixe) => (
            <EntryRow key={encaixe.espera.id} entry={encaixe.espera} now={now} onEdit={onEdit}>
              <SlotItem
                horario={encaixe}
                preferida={encaixe.preferida}
                onPick={onPick && (() => onPick(encaixe.espera, encaixe))}
              />
            </EntryRow>
          ))}
        </ul>
      )}
    </>
  )
}

function EntryRow({
  entry,
  now,
  onEdit,
  children
}: {
  entry: WaitlistEntry
  now: Date
  onEdit: (entry: WaitlistEntry) => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <li className="flex animate-fade-in gap-2.5 rounded-card px-3 py-2.5 hover:bg-canvas">
      <Avatar name={entry.patient_nome} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            to={`/pacientes/${entry.patient_id}`}
            className="truncate text-[13px] font-medium hover:underline"
          >
            {entry.patient_nome}
          </Link>
          {entry.prioridade === 'alta' && <Badge>Prioridade</Badge>}
        </div>
        <p className="text-xs text-ink-soft">
          {entry.tipo_nome} · {entry.duracao} min · {preferenciasTexto(entry.dias, entry.periodos)}
        </p>
        <p className="text-xs text-ink-faint">{esperaTexto(entry.created_at, now)}</p>
        {entry.observacao && (
          <p className="line-clamp-2 text-xs text-ink-soft">{entry.observacao}</p>
        )}
        <div className="mt-1 flex flex-col">{children}</div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="-mt-1 -mr-1.5"
        aria-label={`Editar a espera de ${entry.patient_nome}`}
        onClick={() => onEdit(entry)}
      >
        <Pencil />
      </Button>
    </li>
  )
}

function Suggestions({
  entry,
  now,
  onPick
}: {
  entry: WaitlistEntry
  now: Date
  onPick?: OnPick
}): React.JSX.Element {
  const sugestoes = useQuery(
    sugestoesQuery({
      patient_id: entry.patient_id,
      duracao: entry.duracao,
      dias: entry.dias,
      periodos: entry.periodos,
      de: toIsoDate(now),
      ate: toIsoDate(addDays(now, SUGESTAO_DIAS - 1))
    })
  )
  if (sugestoes.error) {
    return <Note tone="danger">Não foi possível procurar. {sugestoes.error.message}</Note>
  }
  if (!sugestoes.data) return <p className="py-1 text-xs text-ink-faint">Procurando…</p>
  if (sugestoes.data.length === 0) {
    return (
      <p className="animate-fade-in py-1 text-xs text-ink-soft">
        Nenhum horário livre nas próximas duas semanas.
      </p>
    )
  }
  return (
    <ul
      aria-label={`Horários livres para ${entry.patient_nome}`}
      className="flex animate-fade-in flex-col"
    >
      {sugestoes.data
        .slice(0, SUGESTOES_VISIVEIS)
        .sort((a, b) => a.inicio.localeCompare(b.inicio))
        .map((s) => (
          <li key={s.inicio}>
            <SlotItem
              horario={s}
              preferida={s.preferida}
              onPick={onPick && (() => onPick(entry, s))}
            />
          </li>
        ))}
    </ul>
  )
}

function SlotItem({
  horario,
  preferida,
  onPick
}: {
  horario: Intervalo
  preferida: boolean
  onPick?: () => void
}): React.JSX.Element {
  const content = (
    <>
      <span className="text-ink tabular-nums">{horarioTexto(horario)}</span>
      {!preferida && <span className="text-ink-faint">fora da preferência</span>}
    </>
  )
  const base = 'flex min-h-7 flex-wrap items-center gap-x-2 text-xs'
  if (!onPick) return <span className={cn(base, 'py-1')}>{content}</span>
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        base,
        '-mx-2 rounded-control px-2 py-1 text-left transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent pointer-coarse:min-h-10'
      )}
    >
      {content}
    </button>
  )
}
