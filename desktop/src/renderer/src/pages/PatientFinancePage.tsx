import { useMutation, useQuery } from '@tanstack/react-query'
import { Undo2, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import {
  FORMA_COBRANCA_LABELS,
  FORMA_PAGAMENTO_LABELS,
  type Billing,
  type ChargeEntry,
  type Estorno,
  type PackageUseEntry,
  type PatientFinance,
  type PatientPackage,
  type PaymentEntry,
  type PendingSession
} from '@shared/finance'
import { formatBRL } from '@shared/money'
import type { Patient } from '@shared/schemas'
import { consomePacote } from '@shared/tipos'
import {
  BillingDialog,
  ChargeDialog,
  LaunchDialog,
  PackageDialog,
  PaymentDialog,
  VoidDialog,
  type VoidTarget
} from '@renderer/components/FinanceDialogs'
import { Page } from '@renderer/components/Layout'
import { PATIENT_COLUMN, PatientHeader } from '@renderer/components/PatientHeader'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { EmptyState } from '@renderer/components/ui/empty'
import { ErrorState } from '@renderer/components/ui/error'
import { Loading } from '@renderer/components/ui/loading'
import { ErrorText } from '@renderer/components/ui/section'
import {
  formatDay,
  formatShortDay,
  plural,
  RENOVACAO_TITLES,
  SITUACAO_LABELS,
  useComputador,
  useRenewPackage
} from '@renderer/lib/finance'
import { patientFinanceQuery, patientQuery } from '@renderer/lib/queries'
import { PATIENTS_CRUMB } from '@renderer/lib/session'
import { useToast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

export function PatientFinanceRoute(): React.JSX.Element {
  const patientId = Number(useParams().id)
  return <PatientFinancePage key={patientId} patientId={patientId} />
}

type Dialogs = 'pay' | 'charge' | 'package' | 'billing' | null

function PatientFinancePage({ patientId }: { patientId: number }): React.JSX.Element {
  const patient = useQuery(patientQuery(patientId))
  const finance = useQuery(patientFinanceQuery(patientId))
  const [dialog, setDialog] = useState<Dialogs>(null)
  const [voiding, setVoiding] = useState<VoidTarget | null>(null)
  const [launching, setLaunching] = useState<PendingSession | null>(null)
  const error = patient.error ?? finance.error
  const option = patient.data ? { id: patient.data.id, nome: patient.data.nome } : null
  const dialogProps = (name: Exclude<Dialogs, null>) => ({
    open: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null)
  })

  return (
    <Page trail={[PATIENTS_CRUMB, { label: patient.data?.nome ?? 'Financeiro' }]}>
      <div className={PATIENT_COLUMN}>
        {patient.data && (
          <PatientHeader
            nome={patient.data.nome}
            nascimento={patient.data.data_nascimento}
            inativo={!patient.data.ativo}
            tabs={{ patientId, value: 'financeiro' }}
          />
        )}
        {error ? (
          <ErrorState
            title="Não foi possível abrir o financeiro"
            detail={error.message}
            onRetry={() => {
              void patient.refetch()
              void finance.refetch()
            }}
          >
            Tente de novo. Se o problema continuar, feche e abra o Auri.
          </ErrorState>
        ) : !patient.data || !finance.data ? (
          <Loading />
        ) : !finance.data.billing ? (
          <EmptyState
            icon={<Wallet />}
            title="Defina a forma de cobrança"
            action={
              <Button variant="secondary" onClick={() => setDialog('billing')}>
                Definir forma de cobrança
              </Button>
            }
          >
            Particular por sessão, pacote ou convênio. Depois, as sessões com presença aparecem aqui
            para lançar, junto com os pagamentos.
          </EmptyState>
        ) : (
          <FinanceBody
            patient={patient.data}
            finance={finance.data}
            billing={finance.data.billing}
            onDialog={setDialog}
            onVoid={setVoiding}
            onLaunch={setLaunching}
          />
        )}
      </div>
      {option && (
        <>
          <PaymentDialog {...dialogProps('pay')} patient={option} />
          <ChargeDialog {...dialogProps('charge')} patient={option} />
          <PackageDialog {...dialogProps('package')} patient={option} />
        </>
      )}
      <BillingDialog
        {...dialogProps('billing')}
        patientId={patientId}
        billing={finance.data?.billing ?? null}
      />
      <VoidDialog target={voiding} onClose={() => setVoiding(null)} />
      <LaunchDialog session={launching} onClose={() => setLaunching(null)} />
    </Page>
  )
}

function Section({
  id,
  title,
  action,
  children
}: {
  id: string
  title: string
  action?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="mt-12">
      <div className="mb-3 flex min-h-7 items-center justify-between gap-4">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function billingText(billing: Billing): string {
  if (billing.forma === 'convenio') {
    const carteirinha = billing.carteirinha ? ` · carteirinha ${billing.carteirinha}` : ''
    return `${billing.insurer?.nome ?? 'Convênio'} · ${formatBRL(billing.insurer?.valor_sessao_centavos ?? 0)} por sessão${carteirinha}`
  }
  const service = billing.service
    ? `${billing.service.nome} ${formatBRL(billing.service.valor_centavos)}`
    : ''
  if (billing.forma !== 'pacote') return service
  const plan = billing.plan ? `${formatBRL(billing.plan.valor_centavos)} · ` : ''
  return `${plan}Sessão fora do pacote: ${service}`
}

function FinanceBody({
  patient,
  finance,
  billing,
  onDialog,
  onVoid,
  onLaunch
}: {
  patient: Patient
  finance: PatientFinance
  billing: Billing
  onDialog: (dialog: Dialogs) => void
  onVoid: (target: VoidTarget) => void
  onLaunch: (session: PendingSession) => void
}): React.JSX.Element {
  const saldo = finance.saldo_centavos
  const current = finance.packages.filter((p) => p.em_vigor).reverse()
  const renew = useRenewPackage(patient)
  const showPackages = billing.forma === 'pacote' || finance.packages.length > 0
  return (
    <>
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[13px] text-ink-soft">
            {saldo > 0 ? 'Em aberto' : saldo < 0 ? 'Crédito' : 'Em dia'}
          </p>
          <p className="mt-1 text-[26px] leading-tight font-semibold tracking-tight tabular-nums">
            {formatBRL(Math.abs(saldo))}
          </p>
          {finance.convenios.map((c) => (
            <p key={c.insurer_id} className="mt-1 text-xs text-ink-soft tabular-nums">
              {c.saldo_centavos > 0 ? 'A receber de' : 'Crédito com'} {c.nome}:{' '}
              {formatBRL(Math.abs(c.saldo_centavos))}
            </p>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onDialog('charge')}>
            Cobrar
          </Button>
          <Button onClick={() => onDialog('pay')}>Registrar pagamento</Button>
        </div>
      </div>

      <Section
        id="forma"
        title="Forma de cobrança"
        action={
          <Button variant="ghost" size="sm" className="-mr-2.5" onClick={() => onDialog('billing')}>
            Alterar
          </Button>
        }
      >
        <p className="text-[13px] font-medium">
          {FORMA_COBRANCA_LABELS[billing.forma]}
          {billing.plan ? ` · ${billing.plan.nome}` : ''}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft tabular-nums">{billingText(billing)}</p>
      </Section>

      {showPackages && (
        <Section
          id="pacote"
          title="Pacote"
          action={
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2.5"
              onClick={() => onDialog('package')}
            >
              Contratar pacote
            </Button>
          }
        >
          {finance.renovacao && (
            <Callout
              className={current.length > 0 ? 'mb-4' : undefined}
              title={RENOVACAO_TITLES[finance.renovacao.situacao]}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  loading={renew.isPending}
                  onClick={() => finance.renovacao && renew.mutate(finance.renovacao)}
                >
                  Renovar
                </Button>
              }
            >
              {finance.renovacao.nome} · {formatBRL(finance.renovacao.valor_centavos)}
            </Callout>
          )}
          {renew.error && <ErrorText>{renew.error.message}</ErrorText>}
          {current.length > 0 ? (
            <div className="flex flex-col gap-6">
              {current.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          ) : finance.renovacao ? null : (
            <p className="text-[13px] text-ink-faint">
              Nenhum pacote em vigor
              {finance.packages[0] && !finance.packages[0].estorno
                ? `: o último (${finance.packages[0].nome}) ${
                    finance.packages[0].usadas >= finance.packages[0].sessoes
                      ? 'terminou'
                      : 'venceu'
                  }`
                : ''}
              . As sessões são cobradas avulsas até contratar outro.
            </p>
          )}
        </Section>
      )}

      {finance.pendentes.length > 0 && (
        <Pending patient={patient} pendentes={finance.pendentes} onLaunch={onLaunch} />
      )}

      <Section id="extrato" title="Extrato">
        <Statement finance={finance} onVoid={onVoid} />
      </Section>
    </>
  )
}

function PackageCard({ pkg }: { pkg: PatientPackage }): React.JSX.Element {
  return (
    <div>
      <p className="text-[13px] font-medium">
        {pkg.nome}{' '}
        <span className="font-normal text-ink-soft tabular-nums">
          · {pkg.usadas} de {pkg.sessoes} usadas ·{' '}
          {pkg.sessoes - pkg.usadas === 1 ? 'resta 1' : `restam ${pkg.sessoes - pkg.usadas}`}
        </span>
      </p>
      <ol
        aria-label={`${pkg.usadas} de ${plural(pkg.sessoes, 'sessão', 'sessões')} usadas`}
        className="mt-2 flex flex-wrap gap-1"
      >
        {Array.from({ length: pkg.sessoes }, (_, i) => (
          <li
            key={i}
            aria-hidden="true"
            className={cn(
              'size-3 rounded-[3px]',
              i < pkg.usadas ? 'bg-ink' : 'shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]'
            )}
          />
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-soft tabular-nums">
        {formatBRL(pkg.valor_centavos)} · desde {formatDay(pkg.inicio)}
        {pkg.validade ? ` · vale até ${formatDay(pkg.validade)}` : ''}
      </p>
    </div>
  )
}

function sessionText(s: PendingSession): string {
  return `${s.tipo_nome} de ${formatShortDay(s.inicio.slice(0, 10))}`
}

function Pending({
  patient,
  pendentes,
  onLaunch
}: {
  patient: Patient
  pendentes: PendingSession[]
  onLaunch: (session: PendingSession) => void
}): React.JSX.Element {
  const toast = useToast()
  const computador = useComputador()
  const sessoes = pendentes.filter((p) => consomePacote(p.categoria))
  const launch = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) await window.api.finance.launchSession(id, computador)
      return ids.length
    },
    onSuccess: (n) =>
      toast({
        title: n === 1 ? 'Sessão lançada' : `${n} sessões lançadas`,
        description: patient.nome
      })
  })
  return (
    <Section
      id="lancar"
      title="A lançar"
      action={
        sessoes.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2.5"
            loading={launch.isPending}
            onClick={() => launch.mutate(sessoes.map((s) => s.appointment_id))}
          >
            Lançar todas
          </Button>
        )
      }
    >
      <p className="mb-2 text-xs text-ink-soft">
        Sessões com presença que ainda não entraram no extrato.
      </p>
      <ul className="-mx-3 flex flex-col">
        {pendentes.map((s) => (
          <li
            key={s.appointment_id}
            className="flex items-center gap-3 rounded-card px-3 py-1.5 text-[13px]"
          >
            <span className="flex-1">{sessionText(s)}</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={launch.isPending}
              onClick={() =>
                !consomePacote(s.categoria) ? onLaunch(s) : launch.mutate([s.appointment_id])
              }
            >
              Lançar
            </Button>
          </li>
        ))}
      </ul>
      {launch.error && <ErrorText>{launch.error.message}</ErrorText>}
    </Section>
  )
}

type Row =
  | { kind: 'charge'; key: string; data: string; created_at: string; entry: ChargeEntry }
  | { kind: 'payment'; key: string; data: string; created_at: string; entry: PaymentEntry }
  | { kind: 'use'; key: string; data: string; created_at: string; entry: PackageUseEntry }

function rows(finance: PatientFinance): Row[] {
  const all: Row[] = [
    ...finance.charges.map((entry) => ({
      kind: 'charge' as const,
      key: `c${entry.id}`,
      data: entry.data,
      created_at: entry.created_at,
      entry
    })),
    ...finance.payments.map((entry) => ({
      kind: 'payment' as const,
      key: `p${entry.id}`,
      data: entry.data,
      created_at: entry.created_at,
      entry
    })),
    ...finance.uses.map((entry) => ({
      kind: 'use' as const,
      key: `u${entry.id}`,
      data: entry.inicio.slice(0, 10),
      created_at: entry.created_at,
      entry
    }))
  ]
  return all.sort((a, b) =>
    a.data !== b.data ? (a.data < b.data ? 1 : -1) : a.created_at < b.created_at ? 1 : -1
  )
}

function chargeDetail(c: ChargeEntry): string {
  if (!c.situacao) return ''
  const quem = c.insurer_nome && !c.descricao.includes(c.insurer_nome) ? `${c.insurer_nome} · ` : ''
  if (c.situacao === 'parcial')
    return `${quem}Parcial · falta ${formatBRL(c.valor_centavos - c.pago_centavos)}`
  return `${quem}${SITUACAO_LABELS[c.situacao]}`
}

function rowText(row: Row): { title: string; detail: string; valor: string } {
  if (row.kind === 'charge')
    return {
      title: row.entry.descricao,
      detail: chargeDetail(row.entry),
      valor: formatBRL(row.entry.valor_centavos)
    }
  if (row.kind === 'payment') {
    const e = row.entry
    return {
      title: `Pagamento · ${FORMA_PAGAMENTO_LABELS[e.forma]}`,
      detail: [e.insurer_nome, e.observacao].filter(Boolean).join(' · '),
      valor: formatBRL(-e.valor_centavos)
    }
  }
  const u = row.entry
  return {
    title: `Sessão de ${formatShortDay(u.inicio.slice(0, 10))}`,
    detail: u.numero
      ? `${u.numero}/${u.sessoes} do pacote ${u.package_nome}`
      : `Pacote ${u.package_nome}`,
    valor: ''
  }
}

function voidLabel(estorno: NonNullable<Estorno>): string {
  return `Estornado em ${formatDay(estorno.em.slice(0, 10))}: ${estorno.motivo}`
}

function Statement({
  finance,
  onVoid
}: {
  finance: PatientFinance
  onVoid: (target: VoidTarget) => void
}): React.JSX.Element {
  const list = rows(finance)
  const packageCharges = new Set(
    finance.charges.filter((c) => c.motivo === 'pacote').map((c) => c.id)
  )
  if (list.length === 0)
    return (
      <p className="text-[13px] text-ink-faint">
        Nada lançado ainda. As cobranças e os pagamentos aparecem aqui, do mais novo ao mais antigo.
      </p>
    )
  return (
    <ul className="-mx-3 flex flex-col">
      {list.map((row) => {
        const { title, detail, valor } = rowText(row)
        const estorno = row.entry.estorno
        const isPackage = row.kind === 'charge' && packageCharges.has(row.entry.id)
        const target: VoidTarget = {
          kind: isPackage ? 'package' : row.kind,
          id: isPackage ? (row.entry as ChargeEntry).package_id! : row.entry.id,
          resumo: valor ? `${title} · ${valor}` : title
        }
        return (
          <li
            key={row.key}
            className="group flex items-center gap-3 rounded-card px-3 py-2 text-[13px] hover:bg-canvas"
          >
            <span className="w-12 shrink-0 text-ink-soft tabular-nums">
              {formatShortDay(row.data)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn('truncate', estorno ? 'text-ink-faint line-through' : 'font-medium')}
              >
                {title}
              </span>
              {(estorno || detail) && (
                <span className="truncate text-xs text-ink-soft">
                  {estorno ? voidLabel(estorno) : detail}
                </span>
              )}
            </span>
            <span
              className={cn(
                'w-28 text-right tabular-nums',
                estorno ? 'text-ink-faint line-through' : 'font-medium'
              )}
            >
              {valor}
            </span>
            <span className="w-7 shrink-0">
              {!estorno && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Estornar ${target.resumo}`}
                  title="Estornar"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => onVoid(target)}
                >
                  <Undo2 />
                </Button>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
