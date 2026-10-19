import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronRight, FileSignature, ImagePlus, Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Controller, useForm, type Control, type FieldErrors } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import {
  DIAS_DA_SEMANA_NOMES,
  horarios,
  NO_DIA,
  type DiaSemana,
  type Funcionamento,
  type Horario
} from '@shared/agenda'
import { logoDataUrl } from '@shared/clinic'
import { formatPhone } from '@shared/masks'
import { clinicInputSchema, funcionamentoSchema, type Clinic } from '@shared/schemas'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ErrorState } from '@renderer/components/ui/error'
import { Field, Input } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import { ErrorText, FormSection } from '@renderer/components/ui/section'
import { Switch } from '@renderer/components/ui/switch'
import { TimeField } from '@renderer/components/ui/time-field'
import { clinicQuery, termModelsQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'

const TRAIL = [{ label: 'Clínica' }]

const formSchema = clinicInputSchema.extend({ funcionamento: funcionamentoSchema })

type ClinicValues = z.input<typeof formSchema>

function toInput({ updated_at: _, ...input }: Clinic): ClinicValues {
  return input
}

const ORDEM: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0]
const HORAS = horarios('05:00', '23:59', 30)
const HORARIO_NOVO: Horario = { abre: '07:00', fecha: '20:00' }

function HoursField({
  value,
  onChange,
  errors
}: {
  value: Funcionamento
  onChange: (value: Funcionamento) => void
  errors?: FieldErrors<Record<string, Horario>>
}): React.JSX.Element {
  const remembered = useRef<Funcionamento>({})
  const set = (dia: DiaSemana, horario: Horario | undefined): void => {
    const next = { ...value }
    if (horario) next[dia] = horario
    else delete next[dia]
    onChange(next)
  }
  return (
    <div className="col-span-6 flex flex-col">
      {ORDEM.map((dia) => {
        const horario = value[dia]
        const nome = DIAS_DA_SEMANA_NOMES[dia]
        const erro = errors?.[dia]?.fecha?.message ?? errors?.[dia]?.abre?.message
        return (
          <div key={dia} className="flex flex-col py-1">
            <div className="flex h-9 items-center gap-3">
              <Switch
                aria-label={`Abre ${NO_DIA[dia]}`}
                checked={horario !== undefined}
                onCheckedChange={(on) => {
                  if (!on && horario) remembered.current[dia] = horario
                  set(dia, on ? (remembered.current[dia] ?? HORARIO_NOVO) : undefined)
                }}
              />
              <span
                className={
                  horario ? 'w-20 text-[13px] font-medium' : 'w-20 text-[13px] text-ink-soft'
                }
              >
                {nome}
              </span>
              {horario ? (
                <div className="flex items-center gap-2">
                  <div className="w-28">
                    <TimeField
                      aria-label={`${nome}, abre às`}
                      value={horario.abre}
                      onChange={(abre) => set(dia, { ...horario, abre })}
                      slots={HORAS}
                      invalid={Boolean(errors?.[dia]?.abre)}
                    />
                  </div>
                  <span className="text-xs text-ink-soft">às</span>
                  <div className="w-28">
                    <TimeField
                      aria-label={`${nome}, fecha às`}
                      value={horario.fecha}
                      onChange={(fecha) => set(dia, { ...horario, fecha })}
                      slots={HORAS}
                      invalid={Boolean(errors?.[dia]?.fecha)}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-[13px] text-ink-faint">Fechado</span>
              )}
            </div>
            {erro && <ErrorText className="mt-1 ml-[136px]">{erro}</ErrorText>}
          </div>
        )
      })}
    </div>
  )
}

function PhoneInput({
  control,
  name
}: {
  control: Control<ClinicValues>
  name: 'telefone' | 'whatsapp'
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          {...field}
          onChange={(e) => field.onChange(formatPhone(e.target.value))}
          inputMode="numeric"
          placeholder="(00) 00000-0000"
          aria-invalid={fieldState.invalid}
        />
      )}
    />
  )
}

function LogoField({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const choose = useMutation({
    mutationFn: () => window.api.clinic.chooseLogo(),
    onSuccess: (logo) => {
      if (logo !== null) onChange(logo)
    }
  })
  return (
    <div className="col-span-2 flex flex-col gap-1">
      <span className="text-xs font-medium">Logo</span>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-44 shrink-0 items-center justify-center rounded-control bg-fill p-2">
          {value ? (
            <img
              src={logoDataUrl(value)}
              alt="Logo da clínica"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-ink-faint">Sem logo</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <div className="flex gap-1">
            <Button variant="secondary" loading={choose.isPending} onClick={() => choose.mutate()}>
              <ImagePlus /> {value ? 'Trocar logo' : 'Escolher logo'}
            </Button>
            {value && (
              <Button variant="ghost" onClick={() => onChange('')}>
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-soft">
            {choose.error ? (
              <span className="text-danger">{choose.error.message}</span>
            ) : (
              'PNG ou JPG. Fundo transparente fica melhor.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

function ClinicForm({ clinic }: { clinic: Clinic }): React.JSX.Element {
  const queryClient = useQueryClient()
  const toast = useToast()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<ClinicValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toInput(clinic)
  })

  useEffect(() => reset(toInput(clinic)), [clinic, reset])

  const save = useMutation({
    mutationFn: (input: ClinicValues) => window.api.clinic.save(input, clinic.updated_at),
    onSuccess: (saved) => {
      queryClient.setQueryData(['clinic'], saved)
      toast({ title: 'Dados da clínica salvos', description: saved.nome || undefined })
    }
  })

  const err = (field: keyof ClinicValues): string | undefined => errors[field]?.message
  const invalid = (field: keyof ClinicValues): boolean => Boolean(errors[field])

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="h-full">
      <Page
        trail={TRAIL}
        actions={
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Salvar alterações
          </Button>
        }
      >
        <div className="mx-auto max-w-[840px] px-8 pt-6 pb-16">
          {save.error && (
            <Callout tone="danger" title="Não foi possível salvar" className="mb-6">
              {save.error.message}
            </Callout>
          )}

          <p className="text-[13px] text-ink-soft">
            Como a clínica aparece nos documentos e quando ela atende.
          </p>
          <div className="mt-8 flex flex-col">
            <FormSection
              id="documentos"
              title="Nos documentos"
              description="O logo e o nome vão no cabeçalho do relatório de presença e dos termos."
              className="grid-cols-2"
            >
              <Controller
                control={control}
                name="logo"
                render={({ field }) => <LogoField value={field.value} onChange={field.onChange} />}
              />
              <Field label="Nome da clínica" error={err('nome')} className="col-span-2">
                <Input {...register('nome')} aria-invalid={invalid('nome')} />
              </Field>
              <Field label="CNPJ ou CPF" error={err('documento')}>
                <Input {...register('documento')} aria-invalid={invalid('documento')} />
              </Field>
              <Field label="Telefone" error={err('telefone')}>
                <PhoneInput control={control} name="telefone" />
              </Field>
              <Field label="Endereço" error={err('endereco')} className="col-span-2">
                <Input {...register('endereco')} aria-invalid={invalid('endereco')} />
              </Field>
            </FormSection>

            <FormSection
              id="profissional"
              title="Profissional responsável"
              description="Aparece nos relatórios, ao lado dos dados do paciente."
              className="grid-cols-2"
            >
              <Field label="Nome" error={err('profissional')}>
                <Input {...register('profissional')} aria-invalid={invalid('profissional')} />
              </Field>
              <Field label="Registro" hint="CRFa, CRP…" error={err('registro')}>
                <Input {...register('registro')} aria-invalid={invalid('registro')} />
              </Field>
            </FormSection>

            <FormSection
              id="funcionamento"
              title="Horário de funcionamento"
              description="A agenda mostra só os dias abertos e não deixa marcar fora deste horário."
            >
              <Controller
                control={control}
                name="funcionamento"
                render={({ field }) => (
                  <HoursField
                    value={field.value}
                    onChange={field.onChange}
                    errors={
                      errors.funcionamento as FieldErrors<Record<string, Horario>> | undefined
                    }
                  />
                )}
              />
            </FormSection>
            <FormSection
              id="termos"
              title="Termos assinados pelo celular"
              description="O responsável envia o termo assinado para este WhatsApp."
              className="grid-cols-2"
            >
              <Field label="WhatsApp da clínica" error={err('whatsapp')}>
                <PhoneInput control={control} name="whatsapp" />
              </Field>
            </FormSection>
            <TermModels />
          </div>
        </div>
      </Page>
    </form>
  )
}

function TermModels(): React.JSX.Element {
  const navigate = useNavigate()
  const models = useQuery(termModelsQuery())
  const list = [...(models.data ?? [])].sort((a, b) => Number(a.arquivado) - Number(b.arquivado))
  return (
    <FormSection
      id="modelos"
      title="Modelos de termo"
      description="Os termos que a clínica envia para a família ler e assinar pelo celular."
      className="grid-cols-1 gap-y-2"
    >
      {models.error && <p className="text-xs text-danger">{models.error.message}</p>}
      {models.data && list.length === 0 && (
        <p className="text-[13px] text-ink-faint">
          Nenhum modelo ainda. O texto é da clínica: o Auri só leva até a família e guarda o que
          voltar assinado.
        </p>
      )}
      {list.length > 0 && (
        <ul className="-mx-3 flex flex-col">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => void navigate(`/clinica/termos/${m.id}`)}
                className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <FileSignature
                  className={m.arquivado ? 'size-4 text-ink-faint' : 'size-4 text-ink-soft'}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={
                      m.arquivado
                        ? 'truncate text-[13px] text-ink-soft'
                        : 'truncate text-[13px] font-medium'
                    }
                  >
                    {m.titulo}
                  </span>
                  <span className="text-xs text-ink-faint">
                    {m.arquivado ? 'Arquivado · ' : ''}Versão {m.versao} · atualizado em{' '}
                    {format(new Date(m.atualizado_em), 'dd/MM/yyyy')}
                  </span>
                </span>
                <ChevronRight className="size-4 text-ink-faint" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="secondary" onClick={() => void navigate('/clinica/termos/novo')}>
          <Plus /> Novo modelo
        </Button>
      </div>
    </FormSection>
  )
}

export function ClinicPage(): React.JSX.Element {
  const clinic = useQuery(clinicQuery())
  if (clinic.data) return <ClinicForm clinic={clinic.data} />
  return (
    <Page trail={TRAIL}>
      {clinic.error ? (
        <ErrorState
          title="Não foi possível abrir os dados da clínica"
          detail={clinic.error.message}
          onRetry={() => void clinic.refetch()}
        >
          Tente de novo. Se o problema continuar, feche e abra o Auri.
        </ErrorState>
      ) : (
        <Loading />
      )}
    </Page>
  )
}
