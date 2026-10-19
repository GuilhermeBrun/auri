import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMinutes, differenceInMinutes, format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { CalendarCheck2, CalendarPlus, Trash2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { FUNCIONAMENTO_PADRAO, foraDoFuncionamento, horariosDoDia } from '@shared/agenda'
import {
  COMMITMENT_LABELS,
  COMMITMENT_TIPOS,
  commitmentInputSchema,
  commitmentName,
  type Commitment,
  type CommitmentInput,
  type CommitmentTipo
} from '@shared/commitments'
import { isIsoDate, parseIsoLocalDateTime, toIsoLocalDateTime } from '@shared/dates'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { DateField } from '@renderer/components/ui/date-field'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input, Textarea } from '@renderer/components/ui/input'
import { Segmented } from '@renderer/components/ui/segmented'
import { Select } from '@renderer/components/ui/select'
import { TimeField } from '@renderer/components/ui/time-field'
import { clinicQuery } from '@renderer/lib/queries'
import { duracaoTexto, quando } from '@renderer/lib/commitments'
import { useToast } from '@renderer/lib/toast'

export type CommitmentDraft =
  | { mode: 'create'; inicio: Date; duracao: number }
  | { mode: 'edit'; commitment: Commitment }

const TIPO_OPTIONS = COMMITMENT_TIPOS.map((t) => [t, COMMITMENT_LABELS[t]] as const)

const DURATIONS = [30, 45, 60, 90, 120, 180, 240, 300, 360, 480]

const PLACEHOLDERS: Record<CommitmentTipo, string> = {
  palestra: 'Ex.: Escola Municipal Fictícia',
  curso: 'Ex.: Curso de motricidade orofacial',
  hospital: 'Ex.: Hospital Fictício, leito 12',
  reuniao: 'Ex.: Reunião com a escola',
  reserva: 'Ex.: Encaixe para paciente novo'
}

type Values = {
  tipo: CommitmentTipo
  titulo: string
  data: string
  hora: string
  duracao: number
  observacao: string
}

function initialValues(draft: CommitmentDraft): Values {
  if (draft.mode === 'create') {
    return {
      tipo: 'reuniao',
      titulo: '',
      data: format(draft.inicio, 'yyyy-MM-dd'),
      hora: format(draft.inicio, 'HH:mm'),
      duracao: draft.duracao,
      observacao: ''
    }
  }
  const c = draft.commitment
  const inicio = parseIsoLocalDateTime(c.inicio)
  return {
    tipo: c.tipo,
    titulo: c.titulo,
    data: format(inicio, 'yyyy-MM-dd'),
    hora: format(inicio, 'HH:mm'),
    duracao: differenceInMinutes(parseIsoLocalDateTime(c.fim), inicio),
    observacao: c.observacao
  }
}

function toInput(values: Values): CommitmentInput | null {
  const inicio = parseIsoLocalDateTime(`${values.data}T${values.hora}`)
  if (Number.isNaN(inicio.getTime())) return null
  return {
    tipo: values.tipo,
    titulo: values.titulo,
    inicio: toIsoLocalDateTime(inicio),
    fim: toIsoLocalDateTime(addMinutes(inicio, values.duracao)),
    observacao: values.observacao
  }
}

function summary(values: Values): string | null {
  const input = toInput(values)
  if (!input) return null
  const inicio = parseIsoLocalDateTime(input.inicio)
  const dia = format(inicio, "EEEE, d 'de' MMMM", { locale: ptBR })
  const fim = format(parseIsoLocalDateTime(input.fim), 'HH:mm')
  return `${COMMITMENT_LABELS[values.tipo]} de ${duracaoTexto(values.duracao)} na ${dia}, das ${format(inicio, 'HH:mm')} às ${fim}. O horário fica bloqueado na agenda.`
}

type FormProps = {
  draft: CommitmentDraft
  onClose: () => void
  onScheduleReserve?: (reserve: Commitment) => void
}

export function CommitmentForm({
  draft,
  onClose,
  onScheduleReserve
}: FormProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const toast = useToast()
  const ids = useId()
  const editing = draft.mode === 'edit' ? draft.commitment : null
  const [values, setValues] = useState(() => initialValues(draft))
  const [invalid, setInvalid] = useState<{ field: keyof Values; message: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [now] = useState(() => new Date())
  const clinic = useQuery(clinicQuery())
  const funcionamento = clinic.data?.funcionamento ?? FUNCIONAMENTO_PADRAO
  const set = <K extends keyof Values>(key: K, value: Values[K]): void => {
    setValues((v) => ({ ...v, [key]: value }))
    setInvalid(null)
  }

  const slots = useMemo(() => {
    const day = isIsoDate(values.data) ? parseIsoLocalDateTime(`${values.data}T00:00`) : now
    return horariosDoDia(funcionamento, day)
  }, [values.data, funcionamento, now])

  const done = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['commitments'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: (input: CommitmentInput) =>
      editing
        ? window.api.commitments.update(editing.id, input, editing.updated_at)
        : window.api.commitments.create(input),
    onSuccess: (saved) => {
      toast({
        title: editing ? 'Compromisso atualizado' : 'Horário bloqueado',
        description: `${commitmentName(saved)} · ${quando(saved.inicio)}`
      })
      done()
    }
  })

  const remove = useMutation({
    mutationFn: () => window.api.commitments.remove(editing!.id),
    onSuccess: () => {
      toast({
        title: 'Compromisso excluído',
        description: `${commitmentName(editing!)} · ${quando(editing!.inicio)}`,
        icon: <Trash2 />
      })
      done()
    }
  })

  const submit = (): void => {
    const input = toInput(values)
    if (!input) return setInvalid({ field: 'data', message: 'Data ou hora inválida' })
    const original = editing && initialValues(draft)
    const moved =
      !original ||
      original.data !== values.data ||
      original.hora !== values.hora ||
      original.duracao !== values.duracao
    const fora = moved
      ? foraDoFuncionamento(
          funcionamento,
          parseIsoLocalDateTime(input.inicio),
          parseIsoLocalDateTime(input.fim)
        )
      : null
    if (fora) return setInvalid({ field: 'hora', message: fora })
    const parsed = commitmentInputSchema.safeParse(input)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return setInvalid({
        field: (issue?.path[0] as keyof Values) ?? 'titulo',
        message: issue?.message ?? 'Dados inválidos'
      })
    }
    save.mutate(input)
  }

  const durations = DURATIONS.includes(values.duracao)
    ? DURATIONS
    : [...DURATIONS, values.duracao].sort((a, b) => a - b)
  const error = (save.error ?? remove.error)?.message
  const fieldError = (field: keyof Values): string | undefined =>
    invalid?.field === field ? invalid.message : undefined
  const resumo = summary(values)

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
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="text-xs font-medium text-ink">
            Tipo
          </span>
          <Segmented
            label="Tipo de compromisso"
            value={values.tipo}
            options={TIPO_OPTIONS}
            onChange={(v) => set('tipo', v)}
          />
        </div>
        <Field label="Título" hint="Opcional" error={fieldError('titulo')}>
          <Input
            value={values.titulo}
            onChange={(e) => set('titulo', e.target.value)}
            placeholder={PLACEHOLDERS[values.tipo]}
            aria-invalid={Boolean(fieldError('titulo'))}
          />
        </Field>
        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
          <Field label="Data" htmlFor={`${ids}-data`} error={fieldError('data')}>
            <DateField
              id={`${ids}-data`}
              value={values.data}
              onChange={(v) => set('data', v)}
              invalid={Boolean(fieldError('data'))}
            />
          </Field>
          <Field label="Hora" htmlFor={`${ids}-hora`} error={fieldError('hora')}>
            <TimeField
              id={`${ids}-hora`}
              value={values.hora}
              onChange={(v) => set('hora', v)}
              slots={slots}
              invalid={Boolean(fieldError('hora'))}
            />
          </Field>
          <Field label="Duração" htmlFor={`${ids}-duracao`}>
            <Select
              id={`${ids}-duracao`}
              value={String(values.duracao)}
              onValueChange={(v) => set('duracao', Number(v))}
              options={durations.map((d) => ({ value: String(d), label: duracaoTexto(d) }))}
            />
          </Field>
        </div>
        <Field label="Observação" error={fieldError('observacao')}>
          <Textarea
            value={values.observacao}
            onChange={(e) => set('observacao', e.target.value)}
            rows={2}
            className="min-h-14"
            placeholder="Opcional"
          />
        </Field>

        {resumo && (
          <p className="flex items-start gap-2 rounded-control bg-canvas px-3 py-2 text-xs text-ink-soft">
            <CalendarCheck2
              className="mt-0.5 size-4 shrink-0 stroke-[1.75] text-ink-soft"
              aria-hidden="true"
            />
            <span aria-live="polite">{resumo}</span>
          </p>
        )}

        {error && (
          <Callout
            tone="danger"
            title={remove.error ? 'Não foi possível excluir' : 'Não foi possível salvar'}
          >
            {error}
          </Callout>
        )}
      </DialogBody>

      <DialogFooter>
        <div className="flex gap-1">
          {editing &&
            (confirmDelete ? (
              <Button
                variant="danger"
                className="animate-fade-in"
                onClick={() => remove.mutate()}
                loading={remove.isPending}
              >
                <Trash2 /> Confirmar exclusão
              </Button>
            ) : (
              <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Excluir
              </Button>
            ))}
          {editing?.tipo === 'reserva' && onScheduleReserve && !confirmDelete && (
            <Button variant="ghost" onClick={() => onScheduleReserve(editing)}>
              <CalendarPlus /> Agendar paciente
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {editing ? 'Salvar alterações' : 'Bloquear horário'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

type DialogProps = {
  draft: CommitmentDraft | null
  onClose: () => void
  onScheduleReserve?: (reserve: Commitment) => void
}

export function CommitmentDialog({
  draft,
  onClose,
  onScheduleReserve
}: DialogProps): React.JSX.Element {
  const [shown, setShown] = useState({ draft, opening: 0 })
  if (draft && draft !== shown.draft) setShown({ draft, opening: shown.opening + 1 })
  const current = shown.draft
  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => !open && onClose()}
      title={current?.mode === 'edit' ? 'Compromisso' : 'Novo compromisso'}
    >
      {current && (
        <CommitmentForm
          key={shown.opening}
          draft={current}
          onClose={onClose}
          onScheduleReserve={onScheduleReserve}
        />
      )}
    </Dialog>
  )
}
