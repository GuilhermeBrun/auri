import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Archive, Plus, Search, X } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { formatAge, isIsoDate, parseIsoDate } from '@shared/dates'
import type { Patient } from '@shared/schemas'
import { createPatientSearch } from '@shared/search'
import { Page } from '@renderer/components/Layout'
import { Avatar } from '@renderer/components/ui/avatar'
import { Loading } from '@renderer/components/ui/loading'
import { Button } from '@renderer/components/ui/button'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorState } from '@renderer/components/ui/error'
import { Input } from '@renderer/components/ui/input'
import { revealRow, useVirtualRows } from '@renderer/lib/hooks'
import { patientsQuery } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/utils'

function formatDate(value: string): string {
  return isIsoDate(value) ? format(parseIsoDate(value), 'dd/MM/yyyy') : ''
}

const COLUMNS: { label: string; className?: string }[] = [
  { label: 'Paciente', className: 'w-[36%]' },
  { label: 'Mãe', className: 'w-[26%]' },
  { label: 'Escola' },
  { label: 'Entrada', className: 'w-[13%]' }
]

/** Altura de cada linha da tabela. Fixa, para a lista montar só as linhas visíveis. */
const ROW_HEIGHT = 56
/** Altura do cabeçalho da tabela, que fica fixo no topo da área de rolagem (`h-9`). */
const HEAD_HEIGHT = 36
/** Quanto tempo o paciente recém-salvo fica marcado na lista; o destaque (1,8s) dura menos que isso. */
const SAVED_MS = 2500

/** Valor vazio: um traço, que o leitor de tela anuncia como "não informado". */
function Blank(): React.JSX.Element {
  return (
    <span className="text-ink-faint" aria-label="não informado">
      —
    </span>
  )
}

/** Texto principal e, embaixo, o complemento em cinza (a célula tem duas linhas). */
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

/** Espaço das linhas que não estão no DOM, acima ou abaixo das visíveis. */
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
  /** Acabou de ser cadastrado ou editado: o fundo da linha se apaga aos poucos. */
  justSaved: boolean
}): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <tr
      aria-rowindex={index + 2}
      onClick={() => navigate(`/pacientes/${p.id}`)}
      style={{ height: ROW_HEIGHT }}
      // hover: fundo arredondado na linha inteira; ao clicar, um tom mais escuro
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
              {!p.ativo && (
                <span className="shrink-0 rounded-chip bg-fill px-2 py-px text-xs font-medium text-ink-soft">
                  Inativo
                </span>
              )}
            </span>
            <span className="truncate text-xs text-ink-soft tabular-nums">
              {formatAge(p.data_nascimento) || <Blank />}
            </span>
          </span>
        </span>
      </td>
      <td className="px-3">
        {p.mae_nome || p.mae_celular ? (
          <TwoLines main={p.mae_nome || <Blank />} sub={p.mae_celular} />
        ) : (
          <Blank />
        )}
      </td>
      <td className="px-3">{p.escola ? <TwoLines main={p.escola} sub={p.serie} /> : <Blank />}</td>
      <td className="px-3 text-ink-soft tabular-nums">{formatDate(p.data_entrada) || <Blank />}</td>
    </tr>
  )
})

/**
 * Tabela de pacientes. Só as linhas visíveis (e uma folga) vão para o DOM, então abrir a tela,
 * buscar e recolher a barra lateral custam o mesmo com 50 ou 2.000 pacientes. Com `memo`, digitar
 * na busca só redesenha a tabela quando o resultado muda, e cada linha só quando o paciente muda.
 */
const PatientTable = memo(function PatientTable({
  patients,
  savedId
}: {
  patients: Patient[]
  /** Paciente recém-salvo: a lista rola até ele (se preciso) e a linha é destacada. */
  savedId: number | undefined
}): React.JSX.Element {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const { start, end } = useVirtualRows(bodyRef, patients.length, ROW_HEIGHT)

  // O paciente novo chega com a lista atualizada, uma fração depois de a tela abrir: rola uma vez só
  const revealed = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (savedId === undefined || revealed.current === savedId || !bodyRef.current) return
    const index = patients.findIndex((p) => p.id === savedId)
    if (index < 0) return
    revealed.current = savedId
    revealRow(bodyRef.current, index, ROW_HEIGHT, HEAD_HEIGHT)
  }, [patients, savedId])
  return (
    // pb-20: folga no fim para a última linha subir acima do aviso, que fica no rodapé da janela
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
  // A ficha manda o id do paciente salvo na navegação; ele fica marcado por um instante e a marca sai
  // do histórico (senão voltar a esta tela repetiria o destaque)
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
  // A busca filtra a lista em memória: o resultado aparece na mesma tecla, sem esperar o banco
  const search = useMemo(() => createPatientSearch(data ?? []), [data])
  const patients = useMemo(() => search(busca), [search, busca])

  const searchRef = useRef<HTMLInputElement>(null)
  const searching = busca.trim() !== ''
  const newPatient = (): void => {
    navigate('/pacientes/novo')
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
          <div className="relative w-52 @min-[960px]:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 stroke-[1.75] text-ink-soft"
              aria-hidden="true"
            />
            <Input
              ref={searchRef}
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, mãe ou CPF"
              // o "x" nativo do navegador é azul e fora da paleta: o botão abaixo o substitui
              // ferramenta do cabeçalho: o mesmo preenchimento dos botões ao lado, sem contorno; no foco
              // ganha o fundo e o contorno de campo
              className="h-8 border-transparent bg-fill pr-8 pl-9 text-[13px] hover:border-transparent hover:bg-fill-hover focus:border-ink focus:bg-surface pointer-coarse:h-11 [&::-webkit-search-cancel-button]:appearance-none"
              aria-label="Buscar pacientes por nome, mãe ou CPF"
              autoFocus
            />
            {busca !== '' && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => {
                  setBusca('')
                  searchRef.current?.focus()
                }}
                className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 animate-fade-in place-items-center rounded-chip text-ink-soft transition-colors hover:bg-fill hover:text-ink pointer-coarse:size-9 [&_svg]:size-4 [&_svg]:stroke-[1.75]"
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mostrar inativos"
            title={incluirInativos ? 'Mostrando inativos' : 'Mostrar inativos'}
            // ligado: o fundo do item ativo do menu lateral
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
