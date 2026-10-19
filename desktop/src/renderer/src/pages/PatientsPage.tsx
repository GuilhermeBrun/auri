import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Archive, Plus, Search } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { formatAge, isIsoDate, parseIsoDate } from '@shared/dates'
import type { Patient } from '@shared/schemas'
import { responsavelDe } from '@shared/responsavel'
import { formatSerie } from '@shared/serie'
import { createPatientSearch } from '@shared/search'
import { Page } from '@renderer/components/Layout'
import { Avatar } from '@renderer/components/ui/avatar'
import { Badge } from '@renderer/components/ui/badge'
import { Loading } from '@renderer/components/ui/loading'
import { Button } from '@renderer/components/ui/button'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorState } from '@renderer/components/ui/error'
import { SearchField } from '@renderer/components/ui/search-field'
import { revealRow, useVirtualRows } from '@renderer/lib/hooks'
import { patientsQuery } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/utils'

function formatDate(value: string): string {
  return isIsoDate(value) ? format(parseIsoDate(value), 'dd/MM/yyyy') : ''
}

const COLUMNS: { label: string; className?: string }[] = [
  { label: 'Paciente', className: 'w-[36%]' },
  { label: 'Responsável', className: 'w-[26%]' },
  { label: 'Escola' },
  { label: 'Entrada', className: 'w-[13%]' }
]

const ROW_HEIGHT = 56
const HEAD_HEIGHT = 36
const SAVED_MS = 2500

function Blank(): React.JSX.Element {
  return (
    <span className="text-ink-faint" aria-label="não informado">
      —
    </span>
  )
}

function TwoLines({
  main,
  sub
}: {
  main: React.ReactNode
  sub?: React.ReactNode
}): React.JSX.Element {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate" title={typeof main === 'string' ? main : undefined}>
        {main}
      </span>
      {sub && <span className="truncate text-xs text-ink-soft tabular-nums">{sub}</span>}
    </span>
  )
}

function ResponsavelCell({ patient }: { patient: Patient }): React.JSX.Element {
  const { pessoa } = responsavelDe(patient)
  if (!pessoa) return <Blank />
  const detalhe = [pessoa.parentesco, pessoa.celular].filter(Boolean).join(' · ')
  return pessoa.papel === 'paciente' ? (
    <TwoLines main="Próprio paciente" sub={pessoa.celular} />
  ) : (
    <TwoLines main={pessoa.nome} sub={detalhe} />
  )
}

function Spacer({ rows }: { rows: number }): React.JSX.Element {
  return (
    <tr aria-hidden="true">
      <td colSpan={COLUMNS.length} className="p-0" style={{ height: rows * ROW_HEIGHT }} />
    </tr>
  )
}

const PatientRow = memo(function PatientRow({
  patient: p,
  index,
  justSaved
}: {
  patient: Patient
  index: number
  justSaved: boolean
}): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <tr
      aria-rowindex={index + 2}
      onClick={() => navigate(`/pacientes/${p.id}`)}
      style={{ height: ROW_HEIGHT }}
      className={cn(
        'group cursor-pointer [&>td]:transition-colors [&>td:first-child]:rounded-l-card [&>td:last-child]:rounded-r-card hover:[&>td]:bg-canvas active:[&>td]:bg-accent-soft',
        justSaved && '[&>td]:animate-row-flash'
      )}
    >
      <td className="px-3">
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={p.nome} size="md" className={p.ativo ? undefined : 'opacity-60'} />
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <Link
                to={`/pacientes/${p.id}`}
                className="truncate font-semibold text-ink"
                title={p.nome}
                onClick={(e) => e.stopPropagation()}
              >
                {p.nome}
              </Link>
              {!p.ativo && <Badge>Inativo</Badge>}
            </span>
            <span className="truncate text-xs text-ink-soft tabular-nums">
              {formatAge(p.data_nascimento) || <Blank />}
            </span>
          </span>
        </span>
      </td>
      <td className="px-3">
        <ResponsavelCell patient={p} />
      </td>
      <td className="px-3">
        {p.escola ? <TwoLines main={p.escola} sub={formatSerie(p)} /> : <Blank />}
      </td>
      <td className="px-3 text-ink-soft tabular-nums">{formatDate(p.data_entrada) || <Blank />}</td>
    </tr>
  )
})

const PatientTable = memo(function PatientTable({
  patients,
  savedId
}: {
  patients: Patient[]
  savedId: number | undefined
}): React.JSX.Element {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const { start, end } = useVirtualRows(bodyRef, patients.length, ROW_HEIGHT)

  const revealed = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (savedId === undefined || revealed.current === savedId || !bodyRef.current) return
    const index = patients.findIndex((p) => p.id === savedId)
    if (index < 0) return
    revealed.current = savedId
    revealRow(bodyRef.current, index, ROW_HEIGHT, HEAD_HEIGHT)
  }, [patients, savedId])
  return (
    <div className="px-4 pb-20">
      <table
        aria-rowcount={patients.length + 1}
        className="w-full table-fixed border-separate border-spacing-0 text-left text-[13px]"
      >
        <thead className="sticky top-0 z-[1] bg-surface text-xs text-ink-soft">
          <tr aria-rowindex={1}>
            {COLUMNS.map(({ label, className }) => (
              <th key={label} className={cn('h-9 px-3 font-medium', className)}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {start > 0 && <Spacer rows={start} />}
          {patients.slice(start, end).map((p, i) => (
            <PatientRow key={p.id} patient={p} index={start + i} justSaved={p.id === savedId} />
          ))}
          {end < patients.length && <Spacer rows={patients.length - end} />}
        </tbody>
      </table>
    </div>
  )
})

export function PatientsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const savedId = (useLocation().state as { saved?: number } | null)?.saved
  useEffect(() => {
    if (savedId === undefined) return
    const timer = setTimeout(() => navigate('/pacientes', { replace: true, state: null }), SAVED_MS)
    return () => clearTimeout(timer)
  }, [savedId, navigate])
  const [incluirInativos, setIncluirInativos] = useState(false)

  const { data, isPending, error, refetch } = useQuery({
    ...patientsQuery(incluirInativos),
    placeholderData: (previous) => previous
  })
  const search = useMemo(() => createPatientSearch(data ?? []), [data])
  const patients = useMemo(() => search(busca), [search, busca])

  const searchRef = useRef<HTMLInputElement>(null)
  const searching = busca.trim() !== ''
  const newPatient = (): void => {
    void navigate('/pacientes/novo')
  }

  return (
    <Page
      trail={[{ label: 'Pacientes' }]}
      actions={
        <Button
          variant="ghost"
          size="icon"
          onClick={newPatient}
          aria-label="Novo paciente"
          title="Novo paciente"
        >
          <Plus />
        </Button>
      }
      toolbar={
        <>
          <SearchField
            ref={searchRef}
            value={busca}
            onChange={setBusca}
            placeholder="Nome, família ou CPF"
            label="Buscar pacientes por nome, mãe, pai, responsável ou CPF"
            className="w-52 @min-[960px]:w-64"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mostrar inativos"
            title={incluirInativos ? 'Mostrando inativos' : 'Mostrar inativos'}
            aria-pressed={incluirInativos}
            onClick={() => setIncluirInativos((v) => !v)}
          >
            <Archive />
          </Button>
        </>
      }
      bodyClassName="flex flex-col"
    >
      {error ? (
        <ErrorState
          title="Não foi possível carregar os pacientes"
          detail={error.message}
          onRetry={() => void refetch()}
        >
          Tente de novo. Se o problema continuar, feche e abra o Auri.
        </ErrorState>
      ) : isPending ? (
        <Loading />
      ) : patients.length === 0 ? (
        searching ? (
          <EmptyState icon={<Search />} title={`Nenhum paciente encontrado para “${busca.trim()}”`}>
            Confira a grafia ou busque pelo nome da mãe ou pelo CPF.
          </EmptyState>
        ) : (
          <EmptyState
            title="Nenhum paciente cadastrado ainda"
            action={
              <Button onClick={newPatient}>
                <Plus /> Cadastrar o primeiro paciente
              </Button>
            }
          >
            Comece pela ficha de entrada: dados do paciente, dos pais e da escola.
          </EmptyState>
        )
      ) : (
        <PatientTable patients={patients} savedId={savedId} />
      )}
    </Page>
  )
}
