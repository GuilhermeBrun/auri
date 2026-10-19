import { useMutation, useQuery } from '@tanstack/react-query'
import { addDays } from 'date-fns'
import { useId, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { isIsoDate, parseIsoDate, toIsoDate } from '@shared/dates'
import {
  billingInputSchema,
  chargeInputSchema,
  FORMA_COBRANCA_LABELS,
  FORMA_PAGAMENTO_LABELS,
  FORMAS_COBRANCA,
  FORMAS_PAGAMENTO,
  paymentInputSchema,
  type Billing,
  type FinanceCatalog,
  type FormaCobranca,
  type FormaPagamento,
  type Lancamento,
  type PendingSession
} from '@shared/finance'
import { centavosToInput, formatBRL, maskBRL, parseBRL } from '@shared/money'
import { PatientCombobox, type PatientOption } from '@renderer/components/PatientCombobox'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { DateField } from '@renderer/components/ui/date-field'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input, Textarea } from '@renderer/components/ui/input'
import { ErrorText } from '@renderer/components/ui/section'
import { Segmented } from '@renderer/components/ui/segmented'
import { Select } from '@renderer/components/ui/select'
import { formatDay, formatShortDay, plural, useComputador } from '@renderer/lib/finance'
import { financeCatalogQuery, patientFinanceQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'
import { shortName } from '@shared/names'

type Errors = Partial<Record<string, string>>

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }): Errors {
  const result: Errors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    result[key] ??= issue.message
  }
  return result
}

export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  autoFocus
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  autoFocus?: boolean
}): React.JSX.Element {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-ink-soft"
      >
        R$
      </span>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(maskBRL(e.target.value))}
        inputMode="numeric"
        placeholder="0,00"
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        className="pl-9 tabular-nums"
      />
    </div>
  )
}

function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {open && (
        <div onSubmit={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </Dialog>
  )
}

function Footer({
  onCancel,
  submit,
  loading,
  disabled,
  danger
}: {
  onCancel: () => void
  submit: ReactNode
  loading: boolean
  disabled?: boolean
  danger?: boolean
}): React.JSX.Element {
  return (
    <DialogFooter>
      <span />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant={danger ? 'danger' : 'primary'}
          loading={loading}
          disabled={disabled}
        >
          {submit}
        </Button>
      </div>
    </DialogFooter>
  )
}

const today = (): string => toIsoDate(new Date())

const PAGAMENTO_OPTIONS = FORMAS_PAGAMENTO.map((f) => [f, FORMA_PAGAMENTO_LABELS[f]] as const)

export function PaymentDialog({
  open,
  onOpenChange,
  patient
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: PatientOption
}): React.JSX.Element {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pagamento"
      description={patient ? patient.nome : 'O que entrou, de quem e como.'}
    >
      <PaymentForm fixed={patient ?? null} onClose={() => onOpenChange(false)} />
    </FormDialog>
  )
}

function PaymentForm({
  fixed,
  onClose
}: {
  fixed: PatientOption | null
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const computador = useComputador()
  const [patient, setPatient] = useState<PatientOption | null>(fixed)
  const [valor, setValor] = useState('')
  const [data, setData] = useState(today)
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [pagador, setPagador] = useState('familia')
  const [observacao, setObservacao] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const finance = useQuery({
    ...patientFinanceQuery(patient?.id ?? 0),
    enabled: patient !== null
  })
  const [prefilled, setPrefilled] = useState<number | null>(null)
  if (finance.data && prefilled !== finance.data.patient_id) {
    setPrefilled(finance.data.patient_id)
    if (valor === '' && finance.data.saldo_centavos > 0)
      setValor(centavosToInput(finance.data.saldo_centavos))
  }

  const insurers = new Map<number, string>()
  const billingInsurer = finance.data?.billing?.insurer
  if (finance.data?.billing?.insurer_id && billingInsurer)
    insurers.set(finance.data.billing.insurer_id, billingInsurer.nome)
  for (const c of finance.data?.convenios ?? []) insurers.set(c.insurer_id, c.nome)
  const pagadores = [
    ['familia', 'Família'] as const,
    ...[...insurers].map(([id, nome]) => [String(id), nome] as const)
  ]

  const pay = useMutation({
    mutationFn: (input: Parameters<typeof window.api.finance.pay>[1]) =>
      window.api.finance.pay(patient!.id, input, computador),
    onSuccess: (_, input) => {
      toast({
        title: 'Pagamento registrado',
        description: `${shortName(patient!.nome)} · ${formatBRL(input.valor_centavos)} · ${FORMA_PAGAMENTO_LABELS[input.forma]}`
      })
      onClose()
    }
  })

  const submit = (): void => {
    const next: Errors = {}
    if (!patient) next.patient = 'Escolha o paciente'
    const parsed = paymentInputSchema.safeParse({
      valor_centavos: parseBRL(valor) ?? 0,
      data,
      forma,
      insurer_id: pagador === 'familia' ? null : Number(pagador),
      observacao
    })
    if (!parsed.success) Object.assign(next, issues(parsed.error))
    setErrors(next)
    if (parsed.success && patient) pay.mutate(parsed.data)
  }

  const saldo = finance.data?.saldo_centavos ?? 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        {!fixed && (
          <Field label="Paciente" as="group" error={errors.patient}>
            <PatientCombobox
              value={patient}
              onChange={(p) => {
                setPatient(p)
                setPagador('familia')
              }}
              invalid={Boolean(errors.patient)}
              autoFocus
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Valor"
            htmlFor={`${ids}-valor`}
            error={errors.valor_centavos}
            hint={
              finance.data && saldo !== 0
                ? saldo > 0
                  ? `Em aberto ${formatBRL(saldo)}`
                  : `Crédito ${formatBRL(-saldo)}`
                : undefined
            }
          >
            <MoneyInput
              id={`${ids}-valor`}
              value={valor}
              onChange={setValor}
              invalid={Boolean(errors.valor_centavos)}
              autoFocus={Boolean(fixed)}
            />
          </Field>
          <Field label="Data" htmlFor={`${ids}-data`} error={errors.data}>
            <DateField
              id={`${ids}-data`}
              value={data}
              onChange={setData}
              invalid={Boolean(errors.data)}
            />
          </Field>
        </div>
        <Field label="Forma" as="group">
          <div className="self-start">
            <Segmented
              label="Forma"
              value={forma}
              options={PAGAMENTO_OPTIONS}
              onChange={setForma}
            />
          </div>
        </Field>
        {pagadores.length > 1 && (
          <Field label="Quem pagou" as="group">
            <div className="self-start">
              <Segmented
                label="Quem pagou"
                value={pagador}
                options={pagadores}
                onChange={setPagador}
              />
            </div>
          </Field>
        )}
        <Field label="Observação" error={errors.observacao}>
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Field>
        {pay.error && <ErrorText>{pay.error.message}</ErrorText>}
      </DialogBody>
      <Footer onCancel={onClose} submit="Registrar" loading={pay.isPending} />
    </form>
  )
}

export type VoidTarget = { kind: Lancamento; id: number; resumo: string }

export function VoidDialog({
  target,
  onClose
}: {
  target: VoidTarget | null
  onClose: () => void
}): React.JSX.Element {
  const [shown, setShown] = useState(target)
  if (target && target !== shown) setShown(target)
  return (
    <FormDialog
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Estornar lançamento"
      description={shown?.resumo}
    >
      {shown && <VoidForm key={`${shown.kind}${shown.id}`} target={shown} onClose={onClose} />}
    </FormDialog>
  )
}

function VoidForm({
  target,
  onClose
}: {
  target: VoidTarget
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const computador = useComputador()
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string>()
  const run = useMutation({
    mutationFn: () => window.api.finance.void(target.kind, target.id, motivo, computador),
    onSuccess: () => {
      toast({ title: 'Lançamento estornado', description: target.resumo })
      onClose()
    }
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (motivo.trim() === '') return setError('Diga por que está estornando')
        run.mutate()
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-soft">
          O lançamento continua no extrato, riscado, com o motivo. Nada é apagado.
        </p>
        <Field label="Motivo" error={error}>
          <Textarea
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              setError(undefined)
            }}
            aria-invalid={Boolean(error) || undefined}
            autoFocus
            placeholder="Lançado em dobro, pagamento devolvido…"
          />
        </Field>
        {run.error && <ErrorText>{run.error.message}</ErrorText>}
      </DialogBody>
      <Footer onCancel={onClose} submit="Estornar" loading={run.isPending} danger />
    </form>
  )
}

function serviceOptions(
  catalog: FinanceCatalog,
  keep: number | null
): { value: string; label: string }[] {
  return catalog.services
    .filter((s) => !s.arquivado || s.id === keep)
    .map((s) => ({ value: String(s.id), label: `${s.nome} · ${formatBRL(s.valor_centavos)}` }))
}

function MissingCatalog({ what }: { what: string }): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <Callout
      title={`Nenhum ${what} cadastrado`}
      action={
        <Button variant="secondary" size="sm" onClick={() => void navigate('/financeiro/valores')}>
          Cadastrar
        </Button>
      }
    >
      Os valores, pacotes e convênios ficam em Financeiro / Valores e convênios.
    </Callout>
  )
}

const COBRANCA_OPTIONS = FORMAS_COBRANCA.map((f) =>
  f === 'particular'
    ? (['particular', 'Particular'] as const)
    : ([f, FORMA_COBRANCA_LABELS[f]] as const)
)

const SERVICE_LABEL: Record<FormaCobranca, string> = {
  particular: 'Valor da sessão',
  pacote: 'Sessão fora do pacote',
  convenio: 'Falta e sessão particular'
}

const NENHUM = 'nenhum'

export function BillingDialog({
  open,
  onOpenChange,
  patientId,
  billing
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: number
  billing: Billing | null
}): React.JSX.Element {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Forma de cobrança"
      description="Como as sessões deste paciente são cobradas."
    >
      <BillingForm patientId={patientId} billing={billing} onClose={() => onOpenChange(false)} />
    </FormDialog>
  )
}

function BillingForm({
  patientId,
  billing,
  onClose
}: {
  patientId: number
  billing: Billing | null
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const catalog = useQuery(financeCatalogQuery())
  const [forma, setForma] = useState<FormaCobranca>(billing?.forma ?? 'particular')
  const [service, setService] = useState(billing?.service_id ? String(billing.service_id) : '')
  const [insurer, setInsurer] = useState(billing?.insurer_id ? String(billing.insurer_id) : '')
  const [carteirinha, setCarteirinha] = useState(billing?.carteirinha ?? '')
  const [desde, setDesde] = useState(billing?.desde ?? today())
  const [errors, setErrors] = useState<Errors>({})

  const save = useMutation({
    mutationFn: (input: Parameters<typeof window.api.finance.setBilling>[1]) =>
      window.api.finance.setBilling(patientId, input, billing?.updated_at),
    onSuccess: (saved) => {
      toast({ title: 'Forma de cobrança salva', description: FORMA_COBRANCA_LABELS[saved.forma] })
      onClose()
    }
  })

  const services = catalog.data ? serviceOptions(catalog.data, billing?.service_id ?? null) : []
  const insurers = (catalog.data?.insurers ?? [])
    .filter((i) => !i.arquivado || i.id === billing?.insurer_id)
    .map((i) => ({
      value: String(i.id),
      label: `${i.nome} · ${formatBRL(i.valor_sessao_centavos)} por sessão`
    }))

  const submit = (): void => {
    const parsed = billingInputSchema.safeParse({
      forma,
      service_id: service === '' || service === NENHUM ? null : Number(service),
      insurer_id: forma === 'convenio' && insurer !== '' ? Number(insurer) : null,
      carteirinha: forma === 'convenio' ? carteirinha : '',
      desde
    })
    setErrors(parsed.success ? {} : issues(parsed.error))
    if (parsed.success) save.mutate(parsed.data)
  }

  const missing =
    catalog.data &&
    (forma === 'convenio' ? insurers.length === 0 && 'convênio' : services.length === 0 && 'valor')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        <div className="self-start">
          <Segmented
            label="Forma de cobrança"
            value={forma}
            options={COBRANCA_OPTIONS}
            onChange={setForma}
          />
        </div>
        {missing && <MissingCatalog what={missing} />}
        {forma === 'convenio' && (
          <div className="grid animate-fade-in grid-cols-2 gap-3">
            <Field label="Convênio" htmlFor={`${ids}-conv`} error={errors.insurer_id}>
              <Select
                id={`${ids}-conv`}
                value={insurer}
                onValueChange={setInsurer}
                options={insurers}
                invalid={Boolean(errors.insurer_id)}
              />
            </Field>
            <Field label="Carteirinha" error={errors.carteirinha}>
              <Input value={carteirinha} onChange={(e) => setCarteirinha(e.target.value)} />
            </Field>
          </div>
        )}
        <Field
          label={SERVICE_LABEL[forma]}
          htmlFor={`${ids}-servico`}
          error={errors.service_id}
          hint={forma === 'pacote' ? 'quando não houver pacote em vigor' : undefined}
        >
          <Select
            id={`${ids}-servico`}
            value={service}
            onValueChange={setService}
            options={
              forma === 'convenio'
                ? [{ value: NENHUM, label: 'Não cobrar' }, ...services]
                : services
            }
            invalid={Boolean(errors.service_id)}
          />
        </Field>
        <Field
          label="Lançar sessões a partir de"
          htmlFor={`${ids}-desde`}
          error={errors.desde}
          hint="as anteriores ficam de fora"
        >
          <DateField
            id={`${ids}-desde`}
            value={desde}
            onChange={setDesde}
            invalid={Boolean(errors.desde)}
          />
        </Field>
        {save.error && <ErrorText>{save.error.message}</ErrorText>}
      </DialogBody>
      <Footer onCancel={onClose} submit="Salvar" loading={save.isPending} />
    </form>
  )
}

export function ChargeDialog({
  open,
  onOpenChange,
  patient
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientOption
}): React.JSX.Element {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cobrar"
      description="Um serviço fora das sessões, como avaliação ou relatório."
    >
      <ChargeForm patient={patient} onClose={() => onOpenChange(false)} />
    </FormDialog>
  )
}

function ChargeForm({
  patient,
  onClose
}: {
  patient: PatientOption
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const computador = useComputador()
  const catalog = useQuery(financeCatalogQuery())
  const [service, setService] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(today)
  const [errors, setErrors] = useState<Errors>({})
  const charge = useMutation({
    mutationFn: (input: Parameters<typeof window.api.finance.charge>[1]) =>
      window.api.finance.charge(patient.id, input, computador),
    onSuccess: (_, input) => {
      toast({
        title: 'Cobrança lançada',
        description: `${input.descricao} · ${formatBRL(input.valor_centavos)}`
      })
      onClose()
    }
  })
  const services = catalog.data ? serviceOptions(catalog.data, null) : []
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = chargeInputSchema.safeParse({
          descricao,
          valor_centavos: parseBRL(valor) ?? 0,
          data
        })
        setErrors(parsed.success ? {} : issues(parsed.error))
        if (parsed.success) charge.mutate(parsed.data)
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        {services.length > 0 && (
          <Field label="Serviço" htmlFor={`${ids}-servico`}>
            <Select
              id={`${ids}-servico`}
              value={service}
              onValueChange={(value) => {
                setService(value)
                const s = catalog.data?.services.find((x) => String(x.id) === value)
                if (s) {
                  setDescricao(s.nome)
                  setValor(centavosToInput(s.valor_centavos))
                }
              }}
              options={services}
            />
          </Field>
        )}
        <Field label="Descrição" error={errors.descricao}>
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            aria-invalid={Boolean(errors.descricao) || undefined}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor" htmlFor={`${ids}-valor`} error={errors.valor_centavos}>
            <MoneyInput
              id={`${ids}-valor`}
              value={valor}
              onChange={setValor}
              invalid={Boolean(errors.valor_centavos)}
            />
          </Field>
          <Field label="Data" htmlFor={`${ids}-data`} error={errors.data}>
            <DateField id={`${ids}-data`} value={data} onChange={setData} />
          </Field>
        </div>
        {charge.error && <ErrorText>{charge.error.message}</ErrorText>}
      </DialogBody>
      <Footer onCancel={onClose} submit="Lançar cobrança" loading={charge.isPending} />
    </form>
  )
}

export function PackageDialog({
  open,
  onOpenChange,
  patient
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientOption
}): React.JSX.Element {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Contratar pacote"
      description={patient.nome}
    >
      <PackageForm patient={patient} onClose={() => onOpenChange(false)} />
    </FormDialog>
  )
}

function PackageForm({
  patient,
  onClose
}: {
  patient: PatientOption
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const computador = useComputador()
  const catalog = useQuery(financeCatalogQuery())
  const plans = (catalog.data?.plans ?? []).filter((p) => !p.arquivado)
  const [planId, setPlanId] = useState('')
  const [inicio, setInicio] = useState(today)
  const plan = plans.find((p) => String(p.id) === planId) ?? null
  const contract = useMutation({
    mutationFn: () =>
      window.api.finance.contractPackage(patient.id, { plan_id: plan!.id, inicio }, computador),
    onSuccess: () => {
      toast({
        title: 'Pacote contratado',
        description: `${shortName(patient.nome)} · ${plan!.nome}`
      })
      onClose()
    }
  })
  const validade =
    plan?.validade_dias && isIsoDate(inicio)
      ? formatDay(toIsoDate(addDays(parseIsoDate(inicio), plan.validade_dias - 1)))
      : null
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (plan && isIsoDate(inicio)) contract.mutate()
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        {catalog.data && plans.length === 0 ? (
          <MissingCatalog what="pacote" />
        ) : (
          <div className="grid grid-cols-[1fr_160px] gap-3">
            <Field label="Pacote" htmlFor={`${ids}-pacote`}>
              <Select
                id={`${ids}-pacote`}
                value={planId}
                onValueChange={setPlanId}
                options={plans.map((p) => ({
                  value: String(p.id),
                  label: `${p.nome} · ${formatBRL(p.valor_centavos)}`
                }))}
              />
            </Field>
            <Field label="Início" htmlFor={`${ids}-inicio`}>
              <DateField
                id={`${ids}-inicio`}
                value={inicio}
                onChange={setInicio}
                invalid={!isIsoDate(inicio)}
              />
            </Field>
          </div>
        )}
        {plan && (
          <p className="animate-fade-in text-[13px] text-ink-soft">
            {plural(plan.sessoes, 'sessão', 'sessões')} por {formatBRL(plan.valor_centavos)}
            {validade ? `, válido até ${validade}` : ', sem validade'}. A cobrança de{' '}
            {formatBRL(plan.valor_centavos)} entra no extrato.
          </p>
        )}
        {contract.error && <ErrorText>{contract.error.message}</ErrorText>}
      </DialogBody>
      <Footer
        onCancel={onClose}
        submit="Contratar"
        loading={contract.isPending}
        disabled={!plan || !isIsoDate(inicio)}
      />
    </form>
  )
}

export function LaunchDialog({
  session,
  onClose
}: {
  session: PendingSession | null
  onClose: () => void
}): React.JSX.Element {
  const [shown, setShown] = useState(session)
  if (session && session !== shown) setShown(session)
  return (
    <FormDialog
      open={session !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Lançar avaliação"
      description={shown ? `Avaliação de ${formatShortDay(shown.inicio.slice(0, 10))}` : undefined}
    >
      {shown && <LaunchForm key={shown.appointment_id} session={shown} onClose={onClose} />}
    </FormDialog>
  )
}

function LaunchForm({
  session,
  onClose
}: {
  session: PendingSession
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const computador = useComputador()
  const catalog = useQuery(financeCatalogQuery())
  const services = catalog.data ? serviceOptions(catalog.data, null) : []
  const [service, setService] = useState(() => {
    const avaliacao = catalog.data?.services.find((s) => !s.arquivado && /^avalia/i.test(s.nome))
    return avaliacao ? String(avaliacao.id) : ''
  })
  const launch = useMutation({
    mutationFn: () =>
      window.api.finance.launchSession(session.appointment_id, computador, Number(service)),
    onSuccess: () => {
      toast({ title: 'Avaliação lançada' })
      onClose()
    }
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (service !== '') launch.mutate()
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        <Field label="Serviço" htmlFor={`${ids}-servico`}>
          <Select
            id={`${ids}-servico`}
            value={service}
            onValueChange={setService}
            options={services}
          />
        </Field>
        {launch.error && <ErrorText>{launch.error.message}</ErrorText>}
      </DialogBody>
      <Footer
        onCancel={onClose}
        submit="Lançar"
        loading={launch.isPending}
        disabled={service === ''}
      />
    </form>
  )
}
