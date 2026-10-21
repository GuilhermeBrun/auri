import { useQuery } from '@tanstack/react-query'
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { ChevronLeft, ChevronRight, Plus, Tags, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toIsoDate } from '@shared/dates'
import { FORMA_PAGAMENTO_LABELS, FORMAS_PAGAMENTO, type FinanceOverview } from '@shared/finance'
import { formatBRL } from '@shared/money'
import { PaymentDialog } from '@renderer/components/FinanceDialogs'
import { Page } from '@renderer/components/Layout'
import { Avatar } from '@renderer/components/ui/avatar'
import { Button } from '@renderer/components/ui/button'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorState } from '@renderer/components/ui/error'
import { Loading } from '@renderer/components/ui/loading'
import { formatShortDay, RENOVACAO_LABELS, useRenewPackage } from '@renderer/lib/finance'
import { financeCatalogQuery, financeOverviewQuery } from '@renderer/lib/queries'
import { useReception } from '@renderer/lib/reception'

function monthName(date: Date): string {
  return format(date, "MMMM 'de' yyyy", { locale: ptBR })
}

function Section({
  id,
  title,
  total,
  children
}: {
  id: string
  title: string
  total?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="mt-12 first:mt-0">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight">
          {title}
        </h2>
        {total && <span className="text-[13px] font-medium tabular-nums">{total}</span>}
      </div>
      {children}
    </section>
  )
}

function Quiet({ children }: { children: ReactNode }): React.JSX.Element {
  return <p className="text-[13px] text-ink-faint">{children}</p>
}

const rowClass =
  'flex w-full items-center gap-3 rounded-card px-3 py-2 text-left text-[13px] transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'

function RenewRow({
  item,
  onOpen
}: {
  item: FinanceOverview['renovar'][number]
  onOpen: () => void
}): React.JSX.Element {
  const renew = useRenewPackage({ id: item.patient_id, nome: item.patient_nome })
  return (
    <li className="flex items-center gap-2">
      <button type="button" className={rowClass} onClick={onOpen}>
        <Avatar name={item.patient_nome} size="sm" />
        <span className="min-w-0 flex-1 truncate font-medium">{item.patient_nome}</span>
        <span className="text-xs text-ink-soft">
          {item.nome} · {RENOVACAO_LABELS[item.situacao]}
        </span>
      </button>
      <Button
        variant="secondary"
        size="sm"
        className="mr-3 shrink-0"
        loading={renew.isPending}
        title={renew.error?.message}
        onClick={() => renew.mutate(item)}
      >
        Renovar
      </Button>
    </li>
  )
}

function Overview({ data, month }: { data: FinanceOverview; month: Date }): React.JSX.Element {
  const navigate = useNavigate()
  const open = (id: number): void => void navigate(`/pacientes/${id}/financeiro`)
  const totalAberto = data.abertos.reduce((sum, a) => sum + a.saldo_centavos, 0)
  const formas = FORMAS_PAGAMENTO.filter((f) => data.por_forma[f] > 0)
  return (
    <>
      <div className="mb-12">
        <p className="text-[13px] text-ink-soft">Recebido em {monthName(month)}</p>
        <p className="mt-1 text-[26px] leading-tight font-semibold tracking-tight tabular-nums">
          {formatBRL(data.total_centavos)}
        </p>
        {formas.length > 0 && (
          <p className="mt-1.5 text-xs text-ink-soft tabular-nums">
            {formas
              .map((f) => `${FORMA_PAGAMENTO_LABELS[f]} ${formatBRL(data.por_forma[f])}`)
              .join(' · ')}
          </p>
        )}
      </div>

      <Section
        id="aberto"
        title="Em aberto"
        total={totalAberto > 0 ? formatBRL(totalAberto) : undefined}
      >
        {data.abertos.length === 0 ? (
          <Quiet>Nenhum paciente com valor a receber.</Quiet>
        ) : (
          <ul className="-mx-3 flex flex-col">
            {data.abertos.map((a) => (
              <li key={a.patient_id}>
                <button type="button" className={rowClass} onClick={() => open(a.patient_id)}>
                  <Avatar name={a.nome} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">{a.nome}</span>
                  {a.desde && (
                    <span className="text-xs text-ink-soft tabular-nums">
                      desde {formatShortDay(a.desde)}
                    </span>
                  )}
                  <span className="w-28 text-right font-medium tabular-nums">
                    {formatBRL(a.saldo_centavos)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {data.renovar.length > 0 && (
        <Section id="renovar" title="Pacotes a renovar">
          <ul className="-mx-3 flex flex-col">
            {data.renovar.map((r) => (
              <RenewRow key={r.patient_id} item={r} onOpen={() => open(r.patient_id)} />
            ))}
          </ul>
        </Section>
      )}

      {data.convenios.length > 0 && (
        <Section id="convenios" title="Convênios a receber">
          <ul className="flex flex-col">
            {data.convenios.map((c) => (
              <li key={c.insurer_id} className="flex items-center gap-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                <span className="w-28 text-right font-medium tabular-nums">
                  {formatBRL(c.saldo_centavos)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        id="recebimentos"
        title={`Recebimentos de ${format(month, 'MMMM', { locale: ptBR })}`}
      >
        {data.recebimentos.length === 0 ? (
          <Quiet>Nenhum pagamento registrado neste mês.</Quiet>
        ) : (
          <ul className="-mx-3 flex flex-col">
            {data.recebimentos.map((r) => (
              <li key={r.id}>
                <button type="button" className={rowClass} onClick={() => open(r.patient_id)}>
                  <span className="w-12 shrink-0 text-ink-soft tabular-nums">
                    {formatShortDay(r.data)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{r.patient_nome}</span>
                    <span className="truncate text-xs text-ink-soft">
                      {[FORMA_PAGAMENTO_LABELS[r.forma], r.insurer_nome, r.observacao]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="w-28 text-right font-medium tabular-nums">
                    {formatBRL(r.valor_centavos)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

export function FinancePage(): React.JSX.Element {
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [paying, setPaying] = useState(false)
  const reception = useReception()
  const de = toIsoDate(month)
  const ate = toIsoDate(endOfMonth(month))
  const overview = useQuery(financeOverviewQuery(de, ate))
  const catalog = useQuery(financeCatalogQuery())
  const firstUse =
    catalog.data &&
    catalog.data.services.length + catalog.data.plans.length + catalog.data.insurers.length === 0

  return (
    <Page
      trail={[{ label: 'Financeiro' }]}
      toolbar={
        <div
          role="group"
          aria-label="Mês"
          className="flex items-center rounded-control bg-fill p-0.5"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mês anterior"
            title="Mês anterior"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-36 px-1 text-center text-xs font-medium first-letter:uppercase">
            {monthName(month)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próximo mês"
            title="Próximo mês"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      }
      actions={
        <>
          {!reception && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Valores e convênios"
              title="Valores e convênios"
              onClick={() => void navigate('/financeiro/valores')}
            >
              <Tags />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Registrar pagamento"
            title="Registrar pagamento"
            onClick={() => setPaying(true)}
          >
            <Plus />
          </Button>
        </>
      }
    >
      {overview.error ? (
        <ErrorState
          title="Não foi possível abrir o financeiro"
          detail={overview.error.message}
          onRetry={() => void overview.refetch()}
        >
          Tente de novo. Se o problema continuar, feche e abra o Auri.
        </ErrorState>
      ) : !overview.data || !catalog.data ? (
        <Loading />
      ) : firstUse ? (
        <EmptyState
          icon={<Wallet />}
          title={reception ? 'Nenhum valor cadastrado' : 'Comece pelos valores'}
          action={
            !reception && (
              <Button variant="secondary" onClick={() => void navigate('/financeiro/valores')}>
                Cadastrar valores
              </Button>
            )
          }
        >
          {reception && 'Cadastre no computador do consultório.'}
        </EmptyState>
      ) : (
        <div className="mx-auto max-w-[840px] px-8 pt-6 pb-20">
          <Overview data={overview.data} month={month} />
        </div>
      )}
      <PaymentDialog open={paying} onOpenChange={setPaying} />
    </Page>
  )
}
