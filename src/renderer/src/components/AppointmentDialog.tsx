import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addMinutes, differenceInMinutes, format } from 'date-fns'
import { CalendarCheck2, Trash2 } from 'lucide-react'
import { ptBR } from 'date-fns/locale/pt-BR'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { isIsoDate, parseIsoLocalDateTime, toIsoLocalDateTime } from '@shared/dates'
import type { Appointment, AppointmentInput } from '@shared/schemas'
import { PatientCombobox } from '@renderer/components/PatientCombobox'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/input'
import { Kbd } from '@renderer/components/ui/kbd'
import { MOD_KEY } from '@renderer/lib/platform'

/** O que abriu o diálogo: um horário livre na agenda ou um agendamento existente. */
export type AppointmentDraft =
  { mode: 'create'; inicio: Date; duracao: number } | { mode: 'edit'; appointment: Appointment }

const DURATIONS = [30, 45, 60, 90]

const formSchema = z.object({
  patient: z
    .object({ id: z.number(), nome: z.string() })
    .nullable()
    .refine((p) => p !== null, 'Escolha o paciente'),
  data: z.string().refine(isIsoDate, 'Data inválida'),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida'),
  duracao: z.number().int().min(5).max(600),
  observacao: z.string().trim().max(1000, 'Use no máximo 1000 caracteres')
})

type FormValues = z.input<typeof formSchema>
type ValidValues = z.output<typeof formSchema>

function initialValues(draft: AppointmentDraft): FormValues {
  if (draft.mode === 'create') {
    return {
      patient: null,
      data: format(draft.inicio, 'yyyy-MM-dd'),
      hora: format(draft.inicio, 'HH:mm'),
      duracao: draft.duracao,
      observacao: ''
    }
  }
  const { appointment: a } = draft
  const inicio = parseIsoLocalDateTime(a.inicio)
  return {
    patient: { id: a.patient_id, nome: a.patient_nome },
    data: format(inicio, 'yyyy-MM-dd'),
    hora: format(inicio, 'HH:mm'),
    duracao: differenceInMinutes(parseIsoLocalDateTime(a.fim), inicio),
    observacao: a.observacao
  }
}

function toInput(values: ValidValues): AppointmentInput {
  const inicio = `${values.data}T${values.hora}`
  return {
    patient_id: values.patient.id,
    inicio,
    fim: toIsoLocalDateTime(addMinutes(parseIsoLocalDateTime(inicio), values.duracao)),
    observacao: values.observacao
  }
}

/** Frase que confirma o que vai ser agendado, ou null se data/hora ainda não são válidas. */
function summary(values: FormValues): string | null {
  if (!isIsoDate(values.data ?? '') || !/^\d{2}:\d{2}$/.test(values.hora ?? '')) return null
  const inicio = parseIsoLocalDateTime(`${values.data}T${values.hora}`)
  const fim = addMinutes(inicio, values.duracao)
  const dia = format(inicio, "EEEE, d 'de' MMMM", { locale: ptBR })
  const quem = values.patient ? ` com ${values.patient.nome}` : ''
  return `Sessão de ${values.duracao} min${quem} na ${dia}, das ${format(inicio, 'HH:mm')} às ${format(fim, 'HH:mm')}.`
}

type Props = { draft: AppointmentDraft | null; onClose: () => void }

export function AppointmentDialog({ draft, onClose }: Props): React.JSX.Element {
  // Ao fechar, `draft` vira null mas o diálogo ainda anima a saída: ele continua mostrando o último
  // rascunho (e não uma folha vazia) até sumir. `opening` conta as aberturas: cada uma é um
  // formulário novo, mesmo que reabra o mesmo horário durante a saída.
  const [shown, setShown] = useState({ draft, opening: 0 })
  if (draft && draft !== shown.draft) setShown({ draft, opening: shown.opening + 1 })
  const current = shown.draft
  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => !open && onClose()}
      title={current?.mode === 'edit' ? 'Editar agendamento' : 'Novo agendamento'}
    >
      {current && <AppointmentForm key={shown.opening} draft={current} onClose={onClose} />}
    </Dialog>
  )
}

function AppointmentForm({
  draft,
  onClose
}: {
  draft: AppointmentDraft
  onClose: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const editing = draft.mode === 'edit' ? draft.appointment : null
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues, unknown, ValidValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues(draft)
  })

  const done = (): void => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: (input: AppointmentInput) =>
      editing
        ? window.api.appointments.update(editing.id, input)
        : window.api.appointments.create(input),
    onSuccess: done
  })

  const remove = useMutation({
    mutationFn: () => window.api.appointments.remove(editing!.id),
    onSuccess: done
  })

  const initialDuration = initialValues(draft).duracao
  const durations = DURATIONS.includes(initialDuration)
    ? DURATIONS
    : [...DURATIONS, initialDuration].sort((a, b) => a - b)

  const error = save.error ?? remove.error
  const resumo = summary(useWatch({ control }) as FormValues)

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(toInput(values)))}
      onKeyDown={(e) => {
        // ⌘/Ctrl + Enter confirma de qualquer campo
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          e.currentTarget.requestSubmit()
        }
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        <Field label="Paciente" as="group" error={errors.patient?.message}>
          <Controller
            control={control}
            name="patient"
            render={({ field, fieldState }) => (
              <PatientCombobox
                value={field.value}
                onChange={field.onChange}
                invalid={fieldState.invalid}
                autoFocus={!editing}
              />
            )}
          />
        </Field>
        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
          <Field label="Data" error={errors.data?.message}>
            <Input type="date" {...register('data')} aria-invalid={Boolean(errors.data)} />
          </Field>
          <Field label="Hora" error={errors.hora?.message}>
            <Input
              type="time"
              step={300}
              {...register('hora')}
              aria-invalid={Boolean(errors.hora)}
            />
          </Field>
          <Field label="Duração" error={errors.duracao?.message}>
            <Select {...register('duracao', { valueAsNumber: true })}>
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Observação" error={errors.observacao?.message}>
          <Textarea
            {...register('observacao')}
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
          <p className="rounded-control bg-danger/8 px-3 py-2 text-xs text-danger" role="alert">
            {error.message}
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        <div>
          {editing ? (
            confirmDelete ? (
              <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
                <Trash2 /> Confirmar exclusão
              </Button>
            ) : (
              <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Excluir
              </Button>
            )
          ) : (
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              <Kbd>{MOD_KEY}</Kbd>
              <Kbd>↵</Kbd>
              <span className="ml-0.5">para agendar</span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {editing ? 'Salvar alterações' : 'Agendar'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
