import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import {
  insurerInputSchema,
  planInputSchema,
  serviceInputSchema,
  type FinanceCatalog,
  type FinanceInsurer,
  type FinancePlan,
  type FinanceService
} from '@shared/finance'
import { centavosToInput, formatBRL, parseBRL } from '@shared/money'
import { MoneyInput } from '@renderer/components/FinanceDialogs'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { ErrorState } from '@renderer/components/ui/error'
import { Field, Input } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import { ErrorText, FormSection } from '@renderer/components/ui/section'
import { FINANCE_CRUMB, plural } from '@renderer/lib/finance'
import { financeCatalogQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'

const TRAIL = [FINANCE_CRUMB, { label: 'Valores e convênios' }]

type Kind = 'service' | 'plan' | 'insurer'

type Editing = { kind: Kind; item: FinanceService | FinancePlan | FinanceInsurer | null }

const NAMES: Record<Kind, { novo: string; titulo: string; salvo: string }> = {
  service: { novo: 'Novo valor', titulo: 'Valor', salvo: 'Valor salvo' },
  plan: { novo: 'Novo pacote', titulo: 'Pacote', salvo: 'Pacote salvo' },
  insurer: { novo: 'Novo convênio', titulo: 'Convênio', salvo: 'Convênio salvo' }
}

function detail(kind: Kind, item: FinanceService | FinancePlan | FinanceInsurer): string {
  if (kind === 'service') return formatBRL((item as FinanceService).valor_centavos)
  if (kind === 'insurer')
    return `${formatBRL((item as FinanceInsurer).valor_sessao_centavos)} por sessão`
  const plan = item as FinancePlan
  const validade = plan.validade_dias ? ` · vale ${plan.validade_dias} dias` : ''
  return `${plural(plan.sessoes, 'sessão', 'sessões')} por ${formatBRL(plan.valor_centavos)}${validade}`
}

function CatalogList({
  kind,
  items,
  empty,
  onEdit
}: {
  kind: Kind
  items: (FinanceService | FinancePlan | FinanceInsurer)[]
  empty: string
  onEdit: (editing: Editing) => void
}): React.JSX.Element {
  return (
    <div className="col-span-6 flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-faint">{empty}</p>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onEdit({ kind, item })}
                className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={
                      item.arquivado
                        ? 'truncate text-[13px] text-ink-soft'
                        : 'truncate text-[13px] font-medium'
                    }
                  >
                    {item.nome}
                  </span>
                  <span className="text-xs text-ink-soft tabular-nums">
                    {item.arquivado ? 'Arquivado · ' : ''}
                    {detail(kind, item)}
                  </span>
                </span>
                <ChevronRight className="size-4 text-ink-faint" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="secondary" onClick={() => onEdit({ kind, item: null })}>
          <Plus /> {NAMES[kind].novo}
        </Button>
      </div>
    </div>
  )
}

function Catalog({ catalog }: { catalog: FinanceCatalog }): React.JSX.Element {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [shown, setShown] = useState(editing)
  if (editing && editing !== shown) setShown(editing)
  return (
    <div className="mx-auto max-w-[840px] px-8 pt-6 pb-16">
      <p className="text-[13px] text-ink-soft">
        O que a clínica cobra. Cada lançamento guarda o valor do dia em que foi feito: mudar um
        valor aqui não muda o que já foi cobrado.
      </p>
      <div className="mt-8 flex flex-col">
        <FormSection
          id="valores"
          title="Valores"
          description="Sessão, avaliação, relatório. A ficha escolhe o valor da sessão de cada paciente."
        >
          <CatalogList
            kind="service"
            items={catalog.services}
            empty="Nenhum valor ainda. Comece pelo valor da sessão."
            onEdit={setEditing}
          />
        </FormSection>
        <FormSection
          id="pacotes"
          title="Pacotes"
          description="Um número de sessões por um preço fechado. Cada sessão com presença usa uma."
        >
          <CatalogList
            kind="plan"
            items={catalog.plans}
            empty="Nenhum pacote ainda."
            onEdit={setEditing}
          />
        </FormSection>
        <FormSection
          id="convenios"
          title="Convênios"
          description="O valor que o convênio paga por sessão. A carteirinha fica na ficha do paciente."
        >
          <CatalogList
            kind="insurer"
            items={catalog.insurers}
            empty="Nenhum convênio ainda."
            onEdit={setEditing}
          />
        </FormSection>
      </div>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          shown
            ? shown.item
              ? `${NAMES[shown.kind].titulo} · ${shown.item.nome}`
              : NAMES[shown.kind].novo
            : ''
        }
      >
        {editing && (
          <CatalogForm
            key={`${editing.kind}${editing.item?.id ?? 'novo'}`}
            editing={editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  )
}

type Saved = { nome: string; arquivado: boolean }

type Draft = { nome: string; valor: string; sessoes: string; validade: string }

function initialDraft({ kind, item }: Editing): Draft {
  if (!item) return { nome: '', valor: '', sessoes: '', validade: '' }
  if (kind === 'service')
    return {
      nome: item.nome,
      valor: centavosToInput((item as FinanceService).valor_centavos),
      sessoes: '',
      validade: ''
    }
  if (kind === 'insurer')
    return {
      nome: item.nome,
      valor: centavosToInput((item as FinanceInsurer).valor_sessao_centavos),
      sessoes: '',
      validade: ''
    }
  const plan = item as FinancePlan
  return {
    nome: plan.nome,
    valor: centavosToInput(plan.valor_centavos),
    sessoes: String(plan.sessoes),
    validade: plan.validade_dias ? String(plan.validade_dias) : ''
  }
}

const toInt = (text: string): number => (text.trim() === '' ? NaN : Number(text))

function parse(kind: Kind, draft: Draft) {
  const valor = parseBRL(draft.valor) ?? NaN
  if (kind === 'service')
    return serviceInputSchema.safeParse({ nome: draft.nome, valor_centavos: valor })
  if (kind === 'insurer')
    return insurerInputSchema.safeParse({ nome: draft.nome, valor_sessao_centavos: valor })
  return planInputSchema.safeParse({
    nome: draft.nome,
    sessoes: toInt(draft.sessoes),
    valor_centavos: valor,
    validade_dias: draft.validade.trim() === '' ? null : toInt(draft.validade)
  })
}

function CatalogForm({
  editing,
  onClose
}: {
  editing: Editing
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const { kind, item } = editing
  const [draft, setDraft] = useState(() => initialDraft(editing))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (field: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [field]: value }))

  const save = useMutation({
    mutationFn: (input: unknown): Promise<Saved> => {
      const id = item?.id ?? null
      if (kind === 'service')
        return window.api.finance.saveService(
          id,
          input as Parameters<typeof window.api.finance.saveService>[1]
        )
      if (kind === 'insurer')
        return window.api.finance.saveInsurer(
          id,
          input as Parameters<typeof window.api.finance.saveInsurer>[1]
        )
      return window.api.finance.savePlan(
        id,
        input as Parameters<typeof window.api.finance.savePlan>[1]
      )
    },
    onSuccess: (saved) => {
      toast({ title: NAMES[kind].salvo, description: saved.nome })
      onClose()
    }
  })

  const archive = useMutation({
    mutationFn: (): Promise<Saved> => {
      const arquivar = !item!.arquivado
      if (kind === 'service') return window.api.finance.archiveService(item!.id, arquivar)
      if (kind === 'insurer') return window.api.finance.archiveInsurer(item!.id, arquivar)
      return window.api.finance.archivePlan(item!.id, arquivar)
    },
    onSuccess: (saved) => {
      toast({ title: saved.arquivado ? 'Arquivado' : 'Reativado', description: saved.nome })
      onClose()
    }
  })

  const valorLabel =
    kind === 'insurer' ? 'Valor por sessão' : kind === 'plan' ? 'Valor do pacote' : 'Valor'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = parse(kind, draft)
        if (parsed.success) {
          setErrors({})
          save.mutate(parsed.data)
          return
        }
        const next: Record<string, string> = {}
        for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message
        setErrors(next)
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        <Field label="Nome" error={errors.nome}>
          <Input
            value={draft.nome}
            onChange={(e) => set('nome')(e.target.value)}
            aria-invalid={Boolean(errors.nome) || undefined}
            placeholder={kind === 'service' ? 'Sessão' : kind === 'plan' ? '8 sessões' : ''}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field
            label={valorLabel}
            htmlFor={`${ids}-valor`}
            error={errors.valor_centavos ?? errors.valor_sessao_centavos}
          >
            <MoneyInput
              id={`${ids}-valor`}
              value={draft.valor}
              onChange={set('valor')}
              invalid={Boolean(errors.valor_centavos ?? errors.valor_sessao_centavos)}
            />
          </Field>
          {kind === 'plan' && (
            <>
              <Field label="Sessões" error={errors.sessoes}>
                <Input
                  value={draft.sessoes}
                  onChange={(e) => set('sessoes')(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.sessoes) || undefined}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Validade" hint="dias" error={errors.validade_dias}>
                <Input
                  value={draft.validade}
                  onChange={(e) => set('validade')(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  placeholder="Sem validade"
                  aria-invalid={Boolean(errors.validade_dias) || undefined}
                  className="tabular-nums"
                />
              </Field>
            </>
          )}
        </div>
        {(save.error ?? archive.error) && (
          <ErrorText>{(save.error ?? archive.error)!.message}</ErrorText>
        )}
      </DialogBody>
      <DialogFooter>
        {item ? (
          <Button variant="ghost" loading={archive.isPending} onClick={() => archive.mutate()}>
            {item.arquivado ? 'Reativar' : 'Arquivar'}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

export function FinanceCatalogPage(): React.JSX.Element {
  const catalog = useQuery(financeCatalogQuery())
  return (
    <Page trail={TRAIL}>
      {catalog.data ? (
        <Catalog catalog={catalog.data} />
      ) : catalog.error ? (
        <ErrorState
          title="Não foi possível abrir os valores"
          detail={catalog.error.message}
          onRetry={() => void catalog.refetch()}
        >
          Tente de novo. Se o problema continuar, feche e abra o Auri.
        </ErrorState>
      ) : (
        <Loading />
      )}
    </Page>
  )
}
