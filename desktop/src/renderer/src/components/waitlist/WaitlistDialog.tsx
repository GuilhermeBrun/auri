import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Hourglass, LogOut } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { shortName } from '@shared/names'
import type { Periodo } from '@shared/encaixe'
import { waitlistInputSchema, type WaitlistEntry, type WaitlistInput } from '@shared/waitlist'
import { TipoSelect } from '@renderer/components/TipoSelect'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ConfirmAction } from '@renderer/components/ui/confirm-action'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Textarea } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { SwitchField } from '@renderer/components/ui/switch'
import { ToggleGroup } from '@renderer/components/ui/toggle-group'
import { useToast } from '@renderer/lib/toast'
import { DIAS_ESPERA, DURACOES_ESPERA, PERIODO_OPTIONS, resumoEspera } from '@renderer/lib/waitlist'
import { useTipos } from '@renderer/lib/tipos'

export type WaitlistTarget = {
  patient: { id: number; nome: string }
  entry: WaitlistEntry | null
}

type Props = { target: WaitlistTarget | null; onClose: () => void }

export function WaitlistDialog({ target, onClose }: Props): React.JSX.Element {
  const [shown, setShown] = useState({ target, opening: 0 })
  if (target && target !== shown.target) setShown({ target, opening: shown.opening + 1 })
  const current = shown.target
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={current?.entry ? 'Lista de espera' : 'Pôr na lista de espera'}
      description={current?.patient.nome}
    >
      {current && <WaitlistForm key={shown.opening} target={current} onClose={onClose} />}
    </Dialog>
  )
}

type Values = {
  tipo_id: number | undefined
  duracao: number
  dias: number[]
  periodos: Periodo[]
  prioridade: boolean
  observacao: string
}

function Caption({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="text-xs font-medium text-ink">
        {label}
        {hint && <span className="ml-2 text-ink-soft">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

function initialValues(entry: WaitlistEntry | null): Values {
  return {
    tipo_id: entry?.tipo_id,
    duracao: entry?.duracao ?? 30,
    dias: entry?.dias ?? [],
    periodos: entry?.periodos ?? [],
    prioridade: entry?.prioridade === 'alta',
    observacao: entry?.observacao ?? ''
  }
}

function toInput(values: Values, tipoId: number | undefined): WaitlistInput {
  return { ...values, tipo_id: tipoId, prioridade: values.prioridade ? 'alta' : 'normal' }
}

function WaitlistForm({
  target: { patient, entry },
  onClose
}: {
  target: WaitlistTarget
  onClose: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const toast = useToast()
  const ids = useId()
  const [values, setValues] = useState(() => initialValues(entry))
  const [invalid, setInvalid] = useState<string | null>(null)
  const set = <K extends keyof Values>(key: K, value: Values[K]): void =>
    setValues((v) => ({ ...v, [key]: value }))
  const { tipos, porId } = useTipos(entry?.tipo_id)
  const tipoId = values.tipo_id ?? (tipos.find((t) => t.categoria === 'sessao') ?? tipos.at(0))?.id
  const tipoNome = (tipoId === undefined ? undefined : porId(tipoId)?.nome) ?? 'Sessão'

  const done = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['waitlist'] })
    void queryClient.invalidateQueries({ queryKey: ['encaixe'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: (input: WaitlistInput) =>
      entry
        ? window.api.waitlist.update(entry.id, input, entry.updated_at)
        : window.api.waitlist.add({ ...input, patient_id: patient.id }),
    onSuccess: () => {
      toast({
        title: entry ? 'Lista de espera atualizada' : 'Na lista de espera',
        description: shortName(patient.nome),
        icon: entry ? undefined : <Hourglass />
      })
      done()
    }
  })

  const remove = useMutation({
    mutationFn: () => window.api.waitlist.close(entry!.id, { motivo: 'removido' }),
    onSuccess: () => {
      toast({
        title: 'Saiu da lista de espera',
        description: shortName(patient.nome),
        icon: <LogOut />
      })
      done()
    }
  })

  const submit = (): void => {
    const input = toInput(values, tipoId)
    const parsed = waitlistInputSchema.safeParse(input)
    if (!parsed.success) {
      setInvalid(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }
    setInvalid(null)
    save.mutate(input)
  }

  const durations = DURACOES_ESPERA.includes(values.duracao)
    ? DURACOES_ESPERA
    : [...DURACOES_ESPERA, values.duracao].sort((a, b) => a - b)
  const error = invalid ?? (save.error ?? remove.error)?.message ?? null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        submit()
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Field label="Etiqueta" htmlFor={`${ids}-tipo`} className="w-48">
            <TipoSelect
              id={`${ids}-tipo`}
              value={tipoId}
              tipos={tipos}
              onChange={(tipo) =>
                setValues((v) => ({ ...v, tipo_id: tipo.id, duracao: tipo.duracao ?? v.duracao }))
              }
            />
          </Field>
          <Field label="Duração" htmlFor={`${ids}-duracao`} className="w-32">
            <Select
              id={`${ids}-duracao`}
              value={String(values.duracao)}
              onValueChange={(v) => set('duracao', Number(v))}
              options={durations.map((d) => ({ value: String(d), label: `${d} min` }))}
            />
          </Field>
        </div>

        <Caption label="Dias" hint="Nenhum marcado: qualquer dia">
          <ToggleGroup
            label="Dias"
            value={values.dias}
            options={DIAS_ESPERA}
            onChange={(v) => set('dias', v)}
          />
        </Caption>

        <Caption label="Período" hint="Nenhum marcado: qualquer horário">
          <ToggleGroup
            label="Período"
            value={values.periodos}
            options={PERIODO_OPTIONS}
            onChange={(v) => set('periodos', v)}
          />
        </Caption>

        <SwitchField
          label="Prioridade"
          checked={values.prioridade}
          onCheckedChange={(v) => set('prioridade', v)}
        />

        <Field label="Observação">
          <Textarea
            value={values.observacao}
            onChange={(e) => set('observacao', e.target.value)}
            placeholder="Ex.: só depois da escola, pode vir em cima da hora."
          />
        </Field>

        <p className="rounded-control bg-canvas px-3 py-2 text-xs text-ink-soft" aria-live="polite">
          {resumoEspera(tipoNome, values.duracao, values.dias, values.periodos)}
        </p>

        {error && (
          <Callout
            tone="danger"
            title={remove.error ? 'Não foi possível tirar da lista' : 'Não foi possível salvar'}
          >
            {error}
          </Callout>
        )}
      </DialogBody>

      <DialogFooter>
        <div>
          {entry && (
            <ConfirmAction
              size="md"
              question="Tirar da lista?"
              confirmLabel="Tirar"
              onConfirm={() => remove.mutate()}
              loading={remove.isPending}
            >
              Tirar da lista
            </ConfirmAction>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {entry ? 'Salvar alterações' : 'Pôr na lista'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
