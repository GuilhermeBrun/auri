import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addMinutes, differenceInMinutes, format } from 'date-fns'
import { CalendarCheck2, Trash2 } from 'lucide-react'
import { ptBR } from 'date-fns/locale/pt-BR'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  DAY_END_LABEL,
  DAY_START_LABEL,
  endsWithinAgenda,
  startsWithinAgenda
} from '@shared/agenda'
import { TIME_SLOTS } from '@shared/agenda'
import { isIsoDate, parseIsoLocalDateTime, toIsoLocalDateTime } from '@shared/dates'
import { shortName } from '@shared/names'
import type { Appointment, AppointmentInput } from '@shared/schemas'
import { PatientCombobox } from '@renderer/components/PatientCombobox'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { DateField } from '@renderer/components/ui/date-field'
import { Field, Textarea } from '@renderer/components/ui/input'
import { Kbd } from '@renderer/components/ui/kbd'
import { Select } from '@renderer/components/ui/select'
import { TimeField } from '@renderer/components/ui/time-field'
import { MOD_KEY } from '@renderer/lib/platform'
import { useToast } from '@renderer/lib/toast'

/** O que abriu o diálogo: um horário livre na agenda ou um agendamento existente. */
export type AppointmentDraft =
  { mode: 'create'; inicio: Date; duracao: number } | { mode: 'edit'; appointment: Appointment }

const DURATIONS = [30, 45, 60, 90]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const formSchema = z
  .object({
    patient: z
      .object({ id: z.number(), nome: z.string() })
      .nullable()
      .refine((p) => p !== null, 'Escolha o paciente'),
    data: z.string().refine(isIsoDate, 'Data inválida'),
    hora: z
      .string()
      .regex(TIME, 'Hora inválida')
      .refine(startsWithinAgenda, `Use entre ${DAY_START_LABEL} e ${DAY_END_LABEL}`),
    duracao: z.number().int().min(5).max(600),
    observacao: z.string().trim().max(1000, 'Use no máximo 1000 caracteres')
  })
  // a sessão também tem que caber na grade: 19:30 por 45 min terminaria às 20:15, fora dela
  .refine(
    (v) => !TIME.test(v.hora) || !startsWithinAgenda(v.hora) || endsWithinAgenda(v.hora, v.duracao),
    {
      message: `Passa das ${DAY_END_LABEL}`,
      path: ['duracao']
    }
  )

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

/** "qui, 9 de out às 14:00": o dia e a hora da sessão, curto o bastante para a segunda linha de um aviso. */
function when(inicio: string): string {
  const date = parseIsoLocalDateTime(inicio)
  // três letras no dia da semana, como na agenda: o 'EEE' do pt-BR devolve "sexta", "seg." e "ter." misturados
  const weekday = format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
  const day = format(date, "d 'de' MMM", { locale: ptBR }).replace('.', '')
  return `${weekday}, ${day} às ${format(date, 'HH:mm')}`
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

type Props = {
  draft: AppointmentDraft | null
  onClose: () => void
  /** Chamado com a sessão gravada (criada ou editada), antes de o diálogo fechar. */
  onSaved?: (appointment: Appointment) => void
}

export function AppointmentDialog({ draft, onClose, onSaved }: Props): React.JSX.Element {
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
      {current && (
        <AppointmentForm key={shown.opening} draft={current} onClose={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  )
}

function AppointmentForm({
  draft,
  onClose,
  onSaved
}: {
  draft: AppointmentDraft
  onClose: () => void
  onSaved?: (appointment: Appointment) => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const toast = useToast()
  const ids = useId()
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
        ? window.api.appointments.update(editing.id, input, editing.updated_at)
        : window.api.appointments.create(input),
    onSuccess: (saved) => {
      toast({
        title: editing ? 'Agendamento atualizado' : 'Sessão agendada',
        description: `${shortName(saved.patient_nome)} · ${when(saved.inicio)}`
      })
      onSaved?.(saved)
      done()
    }
  })

  const remove = useMutation({
    mutationFn: () => window.api.appointments.remove(editing!.id),
    onSuccess: () => {
      toast({
        title: 'Agendamento excluído',
        description: `${shortName(editing!.patient_nome)} · ${when(editing!.inicio)}`,
        icon: <Trash2 />
      })
      done()
    }
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
          <Field label="Data" htmlFor={`${ids}-data`} error={errors.data?.message}>
            <Controller
              control={control}
              name="data"
              render={({ field, fieldState }) => (
                <DateField
                  id={`${ids}-data`}
                  value={field.value}
                  onChange={field.onChange}
                  invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
          <Field label="Hora" htmlFor={`${ids}-hora`} error={errors.hora?.message}>
            <Controller
              control={control}
              name="hora"
              render={({ field, fieldState }) => (
                <TimeField
                  id={`${ids}-hora`}
                  value={field.value}
                  onChange={field.onChange}
                  slots={TIME_SLOTS}
                  invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
          <Field label="Duração" htmlFor={`${ids}-duracao`} error={errors.duracao?.message}>
            <Controller
              control={control}
              name="duracao"
              render={({ field, fieldState }) => (
                <Select
                  id={`${ids}-duracao`}
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                  options={durations.map((d) => ({ value: String(d), label: `${d} min` }))}
                  invalid={fieldState.invalid}
                />
              )}
            />
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
          <p
            className="animate-error-in rounded-control bg-danger/8 px-3 py-2 text-xs text-danger"
            role="alert"
          >
            {error.message}
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        <div>
          {editing ? (
            confirmDelete ? (
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
          <Button variant="secondary" onClick={onClose}>
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
