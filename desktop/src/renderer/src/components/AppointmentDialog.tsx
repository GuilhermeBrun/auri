import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMinutes, differenceInMinutes, format, isSameDay } from 'date-fns'
import { CalendarCheck2, Check, PenLine, Trash2, Undo2 } from 'lucide-react'
import { ptBR } from 'date-fns/locale/pt-BR'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import {
  FUNCIONAMENTO_PADRAO,
  horarioDoDia,
  horariosDoDia,
  minutesOf,
  noDia,
  type Funcionamento
} from '@shared/agenda'
import { isIsoDate, parseIsoLocalDateTime, toIsoLocalDateTime } from '@shared/dates'
import { shortName } from '@shared/names'
import { PRESENCAS, type Appointment, type AppointmentInput } from '@shared/schemas'
import { ArrivalSignature } from '@renderer/components/ArrivalSignature'
import { EtiquetasEscolha } from '@renderer/components/EtiquetasEscolha'
import { PatientCombobox } from '@renderer/components/PatientCombobox'
import { TipoSelect } from '@renderer/components/TipoSelect'
import { SessionPayment } from '@renderer/components/SessionPayment'
import { SignatureImage } from '@renderer/components/SignatureImage'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { DateField } from '@renderer/components/ui/date-field'
import { Field, Textarea } from '@renderer/components/ui/input'
import { Kbd } from '@renderer/components/ui/kbd'
import { Segmented } from '@renderer/components/ui/segmented'
import { Select } from '@renderer/components/ui/select'
import { SwitchField } from '@renderer/components/ui/switch'
import { TimeField } from '@renderer/components/ui/time-field'
import { useConnection } from '@renderer/lib/connection'
import { MOD_KEY } from '@renderer/lib/platform'
import { clinicQuery, patientAttendanceQuery } from '@renderer/lib/queries'
import { PRESENCA_OPTIONS } from '@renderer/lib/session'
import { useToast } from '@renderer/lib/toast'
import { useTipos } from '@renderer/lib/tipos'

export type AppointmentDraft =
  | {
      mode: 'create'
      inicio: Date
      duracao: number
      patient?: { id: number; nome: string }
      tipo_id?: number
    }
  | { mode: 'edit'; appointment: Appointment }

const DURATIONS = [30, 45, 60, 90]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const baseSchema = z.object({
  patient: z
    .object({ id: z.number(), nome: z.string() })
    .nullable()
    .refine((p) => p !== null, 'Escolha o paciente'),
  data: z.string().refine(isIsoDate, 'Data inválida'),
  hora: z.string().regex(TIME, 'Hora inválida'),
  duracao: z.number().int().min(5).max(600),
  observacao: z.string().trim().max(1000, 'Use no máximo 1000 caracteres'),
  tipo_id: z.number().int().optional(),
  etiquetas: z.array(z.number().int()),
  presenca: z.enum([...PRESENCAS, '']),
  evolucao: z.string().trim().max(10000, 'Use no máximo 10000 caracteres'),
  confirmado: z.boolean()
})

type Horario = Pick<z.input<typeof baseSchema>, 'data' | 'hora' | 'duracao'>

function formSchema(funcionamento: Funcionamento | null, original: Horario | null) {
  return baseSchema.superRefine((v, ctx) => {
    if (!funcionamento || !isIsoDate(v.data) || !TIME.test(v.hora)) return
    if (
      original &&
      v.data === original.data &&
      v.hora === original.hora &&
      v.duracao === original.duracao
    ) {
      return
    }
    const date = parseIsoLocalDateTime(`${v.data}T${v.hora}`)
    const horario = horarioDoDia(funcionamento, date)
    const issue = (path: string, message: string): void => {
      ctx.addIssue({ code: 'custom', path: [path], message })
    }
    if (!horario) return issue('data', `A clínica não abre ${noDia(date)}`)
    const start = minutesOf(v.hora)
    if (start < minutesOf(horario.abre) || start >= minutesOf(horario.fecha)) {
      return issue('hora', `Use entre ${horario.abre} e ${horario.fecha}`)
    }
    if (start + v.duracao > minutesOf(horario.fecha)) issue('duracao', `Passa das ${horario.fecha}`)
  })
}

type FormValues = z.input<typeof baseSchema>
type ValidValues = z.output<typeof baseSchema>

function initialValues(draft: AppointmentDraft): FormValues {
  if (draft.mode === 'create') {
    return {
      patient: draft.patient ?? null,
      data: format(draft.inicio, 'yyyy-MM-dd'),
      hora: format(draft.inicio, 'HH:mm'),
      duracao: draft.duracao,
      observacao: '',
      tipo_id: draft.tipo_id,
      etiquetas: [],
      presenca: '',
      evolucao: '',
      confirmado: false
    }
  }
  const { appointment: a } = draft
  const inicio = parseIsoLocalDateTime(a.inicio)
  return {
    patient: { id: a.patient_id, nome: a.patient_nome },
    data: format(inicio, 'yyyy-MM-dd'),
    hora: format(inicio, 'HH:mm'),
    duracao: differenceInMinutes(parseIsoLocalDateTime(a.fim), inicio),
    observacao: a.observacao,
    tipo_id: a.tipo_id,
    etiquetas: a.etiquetas.map((e) => e.id),
    presenca: a.presenca,
    evolucao: a.evolucao,
    confirmado: a.confirmado_em !== null
  }
}

function hasStarted(data: string | undefined, hora: string | undefined, now: Date): boolean {
  if (!isIsoDate(data ?? '') || !TIME.test(hora ?? '')) return false
  return parseIsoLocalDateTime(`${data}T${hora}`) <= now
}

const AUSENCIA_OPTIONS = PRESENCA_OPTIONS.filter(([value]) => value !== 'presente')

function toInput(values: ValidValues, now: Date, signed: boolean): AppointmentInput {
  const inicio = `${values.data}T${values.hora}`
  return {
    patient_id: values.patient.id,
    inicio,
    fim: toIsoLocalDateTime(addMinutes(parseIsoLocalDateTime(inicio), values.duracao)),
    observacao: values.observacao,
    tipo_id: values.tipo_id,
    etiquetas: values.etiquetas,
    presenca: signed || hasStarted(values.data, values.hora, now) ? values.presenca : '',
    evolucao: values.evolucao,
    confirmado: values.confirmado
  }
}

function clock(iso: string): string {
  return format(new Date(iso), 'HH:mm')
}

function when(inicio: string): string {
  const date = parseIsoLocalDateTime(inicio)
  const weekday = format(date, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)
  const day = format(date, "d 'de' MMM", { locale: ptBR }).replace('.', '')
  return `${weekday}, ${day} às ${format(date, 'HH:mm')}`
}

function summary(values: FormValues, tipoNome: string): string | null {
  if (!isIsoDate(values.data ?? '') || !/^\d{2}:\d{2}$/.test(values.hora ?? '')) return null
  const inicio = parseIsoLocalDateTime(`${values.data}T${values.hora}`)
  const fim = addMinutes(inicio, values.duracao)
  const dia = format(inicio, "EEEE, d 'de' MMMM", { locale: ptBR })
  const quem = values.patient ? ` com ${values.patient.nome}` : ''
  return `${tipoNome} de ${values.duracao} min${quem} na ${dia}, das ${format(inicio, 'HH:mm')} às ${format(fim, 'HH:mm')}.`
}

function title(draft: AppointmentDraft | null): string {
  if (draft?.mode !== 'edit') return 'Novo agendamento'
  return parseIsoLocalDateTime(draft.appointment.inicio) <= new Date()
    ? 'Registro da sessão'
    : 'Editar agendamento'
}

type Props = {
  draft: AppointmentDraft | null
  onClose: () => void
  onSaved?: (appointment: Appointment) => void
}

export function AppointmentDialog({ draft, onClose, onSaved }: Props): React.JSX.Element {
  const [shown, setShown] = useState({ draft, opening: 0 })
  if (draft && draft !== shown.draft) setShown({ draft, opening: shown.opening + 1 })
  const current = shown.draft
  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => !open && onClose()}
      title={title(current)}
    >
      {current && (
        <AppointmentForm key={shown.opening} draft={current} onClose={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  )
}

function SegmentedField({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="text-xs font-medium text-ink">
        {label}
      </span>
      {children}
    </div>
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
  const [now] = useState(() => new Date())
  const [signing, setSigning] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [motivo, setMotivo] = useState('')
  const { info } = useConnection()
  const signed = editing?.assinatura ?? null
  const canSign =
    editing !== null && !signed && isSameDay(parseIsoLocalDateTime(editing.inicio), now)
  const records = useQuery({
    ...patientAttendanceQuery(editing?.patient_id ?? 0),
    enabled: signed !== null
  })
  const record = signed ? records.data?.find((r) => r.id === signed.id) : undefined

  const clinic = useQuery(clinicQuery())
  const funcionamento = clinic.data?.funcionamento ?? null
  const funcionamentoRef = useRef(funcionamento)
  useEffect(() => {
    funcionamentoRef.current = funcionamento
  }, [funcionamento])
  const [original] = useState(() => (editing ? initialValues(draft) : null))
  const resolver: Resolver<FormValues, unknown, ValidValues> = (values, context, options) =>
    zodResolver(formSchema(funcionamentoRef.current, original))(values, context, options)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FormValues, unknown, ValidValues>({
    resolver,
    defaultValues: initialValues(draft)
  })

  const done = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['appointments'] })
    onClose()
  }

  const save = useMutation({
    mutationFn: (input: AppointmentInput) =>
      editing
        ? window.api.appointments.update(editing.id, input, editing.updated_at)
        : window.api.appointments.create(input),
    onSuccess: (saved) => {
      toast({
        title: !editing
          ? 'Sessão agendada'
          : parseIsoLocalDateTime(editing.inicio) <= now
            ? 'Registro salvo'
            : 'Agendamento atualizado',
        description: `${shortName(saved.patient_nome)} · ${when(saved.inicio)}`
      })
      onSaved?.(saved)
      done()
    }
  })

  const voidSignature = useMutation({
    mutationFn: () =>
      window.api.attendance.void(signed!.id, motivo.trim(), info?.name || 'Este computador'),
    onSuccess: (saved) => {
      toast({
        title: 'Assinatura anulada',
        description: `${shortName(saved.patient_nome)} · ${when(saved.inicio)}`
      })
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      done()
    }
  })

  const remove = useMutation({
    mutationFn: () => window.api.appointments.remove(editing!.id),
    onSuccess: () => {
      const gone = editing!
      const description = `${shortName(gone.patient_nome)} · ${when(gone.inicio)}`
      toast({
        title: 'Agendamento excluído',
        description,
        icon: <Trash2 />,
        action: {
          label: 'Desfazer',
          icon: <Undo2 />,
          altText: 'Para desfazer, agende a sessão de novo.',
          onClick: () => {
            void window.api.appointments
              .create({
                patient_id: gone.patient_id,
                inicio: gone.inicio,
                fim: gone.fim,
                observacao: gone.observacao,
                tipo_id: gone.tipo_id,
                etiquetas: gone.etiquetas.map((e) => e.id),
                presenca: gone.presenca === 'presente' ? '' : gone.presenca,
                evolucao: gone.evolucao,
                ...(gone.confirmado_em ? { confirmado: true } : {})
              })
              .then(() => {
                void queryClient.invalidateQueries({ queryKey: ['appointments'] })
                toast({ title: 'Agendamento restaurado', description })
              })
          }
        }
      })
      done()
    }
  })

  const error = save.error ?? remove.error ?? voidSignature.error
  const values = useWatch({ control }) as FormValues
  const { tipos, porId } = useTipos(editing?.tipo_id)
  const tipoId = values.tipo_id ?? (tipos.find((t) => t.categoria === 'sessao') ?? tipos.at(0))?.id
  const tipoNome = (tipoId === undefined ? undefined : porId(tipoId)?.nome) ?? 'Sessão'
  const durations = [
    ...new Set([...DURATIONS, initialValues(draft).duracao, values.duracao ?? 30])
  ].sort((a, b) => a - b)
  const started = hasStarted(values.data, values.hora, now)
  const resumo = started ? null : summary(values, tipoNome)
  const slots = useMemo(() => {
    const day = isIsoDate(values.data ?? '') ? parseIsoLocalDateTime(`${values.data}T00:00`) : now
    return horariosDoDia(funcionamento ?? FUNCIONAMENTO_PADRAO, day)
  }, [values.data, funcionamento, now])

  return (
    <form
      onSubmit={handleSubmit((valid) =>
        save.mutate(toInput({ ...valid, tipo_id: valid.tipo_id ?? tipoId }, now, signed !== null))
      )}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          e.currentTarget.requestSubmit()
        }
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        {signed && editing ? (
          <div className="flex flex-col gap-1 rounded-control bg-canvas px-3 py-2.5">
            <span className="text-[13px] font-medium">{editing.patient_nome}</span>
            <span className="text-xs text-ink-soft tabular-nums">
              {when(editing.inicio)} · {values.duracao} min · {editing.tipo_nome}
            </span>
          </div>
        ) : (
          <>
            <Field label="Paciente" as="group" error={errors.patient?.message}>
              <Controller
                control={control}
                name="patient"
                render={({ field, fieldState }) => (
                  <PatientCombobox
                    value={field.value}
                    onChange={field.onChange}
                    invalid={fieldState.invalid}
                    autoFocus={!editing && !(draft.mode === 'create' && draft.patient)}
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
                      slots={slots}
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
          </>
        )}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {!signed && (
            <Field label="Tipo" htmlFor={`${ids}-tipo`} className="w-52">
              <Controller
                control={control}
                name="tipo_id"
                render={({ field }) => (
                  <TipoSelect
                    id={`${ids}-tipo`}
                    value={tipoId}
                    tipos={tipos}
                    onChange={(tipo) => {
                      field.onChange(tipo.id)
                      if (!started) setValue('duracao', tipo.duracao, { shouldValidate: true })
                    }}
                  />
                )}
              />
            </Field>
          )}
          {!signed && started && (
            <SegmentedField label="Presença">
              <Controller
                control={control}
                name="presenca"
                render={({ field }) => (
                  <Segmented
                    label="Presença"
                    value={field.value}
                    options={editing?.presenca === 'presente' ? PRESENCA_OPTIONS : AUSENCIA_OPTIONS}
                    onChange={(v) => field.onChange(v === field.value ? '' : v)}
                  />
                )}
              />
            </SegmentedField>
          )}
        </div>
        {!signed && !started && (
          <Controller
            control={control}
            name="confirmado"
            render={({ field }) => (
              <SwitchField
                label="Confirmado"
                description={
                  field.value && editing?.confirmado_em
                    ? `Confirmado em ${format(new Date(editing.confirmado_em), "dd/MM 'às' HH:mm")}.`
                    : 'Marque quando a família confirmar que vem.'
                }
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        )}
        {!signed && started && !canSign && editing?.presenca !== 'presente' && (
          <p className="-mt-2 text-xs text-ink-soft">
            Presente só com a assinatura de quem trouxe o paciente, no dia da sessão.
          </p>
        )}
        {canSign && (
          <div className="flex items-center justify-between gap-3 rounded-control bg-canvas px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-[13px] font-medium">Chegada</span>
              <span className="text-xs text-ink-soft">
                A presença só é marcada com a assinatura de quem trouxe o paciente, e fica travada.
              </span>
            </span>
            <Button variant="secondary" onClick={() => setSigning(true)}>
              <PenLine /> Assinar chegada
            </Button>
          </div>
        )}
        {signed && (
          <div className="flex flex-col gap-3 rounded-control bg-canvas px-3 py-3">
            <div className="flex items-start justify-between gap-4">
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[13px] font-medium [&_svg]:size-3.5 [&_svg]:stroke-[2]">
                  <Check /> Presente · chegada assinada às {clock(signed.assinado_em)}
                </span>
                <span className="text-xs text-ink-soft">
                  Por {signed.signer_nome} ({signed.signer_parentesco.toLowerCase()}). Paciente,
                  horário, tipo e presença não mudam mais.
                </span>
              </span>
              {!voiding && (
                <Button variant="ghost" size="sm" onClick={() => setVoiding(true)}>
                  Anular assinatura
                </Button>
              )}
            </div>
            {record && (
              <SignatureImage
                traco={record.traco}
                label={`Assinatura de ${signed.signer_nome}`}
                strokeWidth={2}
                className="h-20 self-start"
              />
            )}
            {voiding && (
              <div className="flex flex-col gap-2 animate-fade-in">
                <Field label="Por que anular?">
                  <Textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={2}
                    placeholder="Ex.: assinou na sessão de outro paciente."
                    autoFocus
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setVoiding(false)}>
                    Voltar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={motivo.trim() === ''}
                    loading={voidSignature.isPending}
                    onClick={() => voidSignature.mutate()}
                  >
                    Anular assinatura
                  </Button>
                </div>
                <p className="text-xs text-ink-soft">
                  A assinatura anulada continua guardada, com o motivo, e a sessão volta a poder ser
                  editada.
                </p>
              </div>
            )}
          </div>
        )}
        <Controller
          control={control}
          name="etiquetas"
          render={({ field }) => <EtiquetasEscolha value={field.value} onChange={field.onChange} />}
        />
        {editing && started && <SessionPayment appointment={editing} onLeave={onClose} />}
        <Field label="Observação" error={errors.observacao?.message}>
          <Textarea
            {...register('observacao')}
            rows={2}
            className="min-h-14"
            placeholder="Opcional"
          />
        </Field>
        {started && (
          <Field label="Evolução" error={errors.evolucao?.message} className="animate-fade-in">
            <Textarea
              {...register('evolucao')}
              rows={4}
              placeholder="O que foi feito na sessão e como o paciente respondeu."
            />
          </Field>
        )}

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
            title={
              remove.error
                ? 'Não foi possível excluir'
                : voidSignature.error
                  ? 'Não foi possível anular'
                  : 'Não foi possível salvar'
            }
          >
            {error.message}
          </Callout>
        )}
      </DialogBody>

      <DialogFooter>
        <div>
          {editing && signed ? null : editing ? (
            confirmDelete ? (
              <Button
                variant="danger"
                className="animate-fade-in"
                onClick={() => remove.mutate()}
                loading={remove.isPending}
              >
                <Trash2 /> {editing.evolucao ? 'Excluir com a evolução' : 'Confirmar exclusão'}
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
      {editing && (
        <ArrivalSignature
          appointment={editing}
          open={signing}
          onOpenChange={setSigning}
          onSigned={() => {
            setSigning(false)
            done()
          }}
        />
      )}
    </form>
  )
}
