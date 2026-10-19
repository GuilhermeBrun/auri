import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Plus, Undo2, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister
} from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { formatAge, toIsoDate } from '@shared/dates'
import { formatCpf, formatPhone } from '@shared/masks'
import {
  CONTATO_DO_PAPEL,
  contatoPrincipal,
  isAdult,
  PARENTESCO_LABEL,
  pessoasDaFicha
} from '@shared/responsavel'
import {
  ATIVIDADES_MAX,
  emptyPatientInput,
  PARENTESCOS,
  PATIENT_FIELDS,
  patientInputSchema,
  SERIE_ETAPAS,
  SERIE_TIPOS,
  UFS,
  type ContatoPrincipal,
  type Patient,
  type PatientField,
  type PatientInput,
  type ResponsavelTipo
} from '@shared/schemas'
import { formatSerie, SERIE_ETAPA_LABEL, SERIE_TIPO_LABEL } from '@shared/serie'
import { Page } from '@renderer/components/Layout'
import { PATIENT_COLUMN, PatientHeader } from '@renderer/components/PatientHeader'
import { PrintButton } from '@renderer/components/PrintButton'
import { Loading } from '@renderer/components/ui/loading'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ErrorState } from '@renderer/components/ui/error'
import { DateField } from '@renderer/components/ui/date-field'
import { Field, Input, Textarea } from '@renderer/components/ui/input'
import { ErrorText, FormSection } from '@renderer/components/ui/section'
import { Segmented } from '@renderer/components/ui/segmented'
import { Select } from '@renderer/components/ui/select'
import { TimeField } from '@renderer/components/ui/time-field'
import { useDraft } from '@renderer/lib/drafts'
import { patientQuery } from '@renderer/lib/queries'
import { PATIENTS_CRUMB } from '@renderer/lib/session'
import { useToast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

function toInput(patient: Patient): PatientInput {
  return {
    ...(Object.fromEntries(PATIENT_FIELDS.map((f) => [f, patient[f]])) as Omit<
      PatientInput,
      'atividades'
    >),
    atividades: patient.atividades.map(({ atividade, dia_semana, inicio, fim }) => ({
      atividade,
      dia_semana,
      inicio,
      fim
    }))
  }
}

function MaskedInput({
  control,
  name,
  mask,
  placeholder,
  className,
  label
}: {
  control: Control<PatientInput>
  name: PatientField
  mask: (value: string) => string
  placeholder?: string
  className?: string
  label?: string
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          {...field}
          onChange={(e) => field.onChange(mask(e.target.value))}
          inputMode="numeric"
          placeholder={placeholder}
          className={className}
          aria-label={label}
          aria-invalid={fieldState.invalid}
        />
      )}
    />
  )
}

const RESPONSAVEL_OPCOES = [
  ['mae', 'Mãe'],
  ['pai', 'Pai'],
  ['outro', 'Outra pessoa']
] as const satisfies readonly (readonly [ResponsavelTipo, string])[]

const PARENTESCO_OPCOES = PARENTESCOS.map((value) => ({ value, label: PARENTESCO_LABEL[value] }))

function ResponsavelFields({
  control,
  register,
  err,
  invalid,
  adulto
}: {
  control: Control<PatientInput>
  register: UseFormRegister<PatientInput>
  err: (field: keyof PatientInput) => string | undefined
  invalid: (field: keyof PatientInput) => boolean
  adulto: boolean
}): React.JSX.Element {
  const ids = useId()
  const [tipo, maeNome, paiNome, parentesco] = useWatch({
    control,
    name: ['resp_tipo', 'mae_nome', 'pai_nome', 'resp_parentesco']
  })

  if (adulto) {
    return (
      <p className="col-span-6 text-[13px] text-ink-soft">
        Paciente maior de idade: ele mesmo assina os termos e a presença. O celular dele fica nos
        dados do paciente.
      </p>
    )
  }

  const efetivo: ResponsavelTipo | '' =
    tipo || (maeNome.trim() ? 'mae' : paiNome.trim() ? 'pai' : '')
  const escolhido = efetivo === 'mae' ? maeNome.trim() : efetivo === 'pai' ? paiNome.trim() : ''

  return (
    <>
      <div className="col-span-6 flex flex-wrap items-center gap-3">
        <Controller
          control={control}
          name="resp_tipo"
          render={({ field }) => (
            <Segmented
              label="Responsável pelo paciente"
              value={efetivo}
              options={RESPONSAVEL_OPCOES}
              onChange={field.onChange}
            />
          )}
        />
        {efetivo === 'mae' || efetivo === 'pai' ? (
          <span className="text-[13px] text-ink-soft">
            {escolhido
              ? `Assina: ${escolhido}`
              : `Preencha o nome ${efetivo === 'mae' ? 'da mãe' : 'do pai'} acima.`}
          </span>
        ) : (
          efetivo === '' && (
            <span className="text-[13px] text-ink-soft">Escolha quem assina pelo paciente.</span>
          )
        )}
      </div>

      {efetivo === 'outro' && (
        <>
          <Field label="Nome do responsável" error={err('resp_nome')} className="col-span-4">
            <Input {...register('resp_nome')} aria-invalid={invalid('resp_nome')} />
          </Field>
          <Field
            label="Parentesco"
            htmlFor={`${ids}-parentesco`}
            error={err('resp_parentesco')}
            className="col-span-2"
          >
            <Controller
              control={control}
              name="resp_parentesco"
              render={({ field, fieldState }) => (
                <Select
                  id={`${ids}-parentesco`}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={PARENTESCO_OPCOES}
                  invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
          {parentesco === 'outro' && (
            <Field
              label="Qual parentesco?"
              error={err('resp_parentesco_outro')}
              className="col-span-6"
            >
              <Input
                {...register('resp_parentesco_outro')}
                aria-invalid={invalid('resp_parentesco_outro')}
                placeholder="Madrinha, padrasto, tutora…"
              />
            </Field>
          )}
          <Field label="Celular" error={err('resp_celular')} className="col-span-3">
            <MaskedInput
              control={control}
              name="resp_celular"
              mask={formatPhone}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="E-mail" error={err('resp_email')} className="col-span-3">
            <Input type="email" {...register('resp_email')} aria-invalid={invalid('resp_email')} />
          </Field>
          <Field label="CPF" error={err('resp_cpf')} className="col-span-3">
            <MaskedInput
              control={control}
              name="resp_cpf"
              mask={formatCpf}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="RG" error={err('resp_rg')} className="col-span-3">
            <Input {...register('resp_rg')} />
          </Field>
          <Callout title="Guarda ou tutela" className="col-span-6">
            Avó, avô, tios e outras pessoas só respondem pelo paciente menor de idade quando têm a
            guarda ou a tutela dele.
          </Callout>
        </>
      )}
    </>
  )
}

const SERIE_TIPO_OPCOES = SERIE_TIPOS.map(
  (t) => [t, SERIE_TIPO_LABEL[t][0].toUpperCase() + SERIE_TIPO_LABEL[t].slice(1)] as const
)
const SERIE_ETAPA_OPCOES = SERIE_ETAPAS.map((e) => [e, SERIE_ETAPA_LABEL[e]] as const)
const UF_OPCOES = UFS.map((uf) => ({ value: uf, label: uf }))

function SerieFields({
  control,
  register,
  err,
  invalid,
  textoAntigo
}: {
  control: Control<PatientInput>
  register: UseFormRegister<PatientInput>
  err: (field: keyof PatientInput) => string | undefined
  invalid: (field: keyof PatientInput) => boolean
  textoAntigo: boolean
}): React.JSX.Element {
  const [numero, tipo, etapa] = useWatch({
    control,
    name: ['serie_numero', 'serie_tipo', 'serie_etapa']
  })
  const resumo = formatSerie({
    serie_numero: numero,
    serie_tipo: tipo,
    serie_etapa: etapa,
    serie: ''
  })

  return (
    <>
      <Field
        label="Série"
        as="group"
        hint={resumo}
        error={err('serie_numero') ?? err('serie_tipo')}
        className="col-span-3"
      >
        <div className="flex items-center gap-2">
          <MaskedInput
            control={control}
            name="serie_numero"
            mask={(v) => v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 2)}
            placeholder="Nº"
            className="w-14 text-center tabular-nums"
            label="Número da série"
          />
          <Controller
            control={control}
            name="serie_tipo"
            render={({ field }) => (
              <Segmented
                label="Ano, série ou grau"
                value={field.value}
                options={SERIE_TIPO_OPCOES}
                onChange={(v) => field.onChange(v === field.value ? '' : v)}
              />
            )}
          />
        </div>
      </Field>
      <Field label="Etapa" as="group" className="col-span-3">
        <Controller
          control={control}
          name="serie_etapa"
          render={({ field }) => (
            <div className="flex h-9 items-center">
              <Segmented
                label="Etapa"
                value={field.value}
                options={SERIE_ETAPA_OPCOES}
                onChange={(v) => field.onChange(v === field.value ? '' : v)}
              />
            </div>
          )}
        />
      </Field>
      {textoAntigo && (
        <Field
          label="Série como estava escrita"
          hint="Não deu para converter. Preencha acima e apague este texto."
          error={err('serie')}
          className="col-span-6"
        >
          <Input {...register('serie')} aria-invalid={invalid('serie')} />
        </Field>
      )}
    </>
  )
}

const CONTATO_LABEL: Record<ContatoPrincipal, string> = {
  mae: 'Mãe',
  pai: 'Pai',
  responsavel: 'Responsável',
  paciente: 'Paciente'
}

const FICHA_CONTATO = [
  'nome',
  'data_nascimento',
  'cpf',
  'celular',
  'email',
  'mae_nome',
  'mae_cpf',
  'mae_celular',
  'mae_email',
  'pai_nome',
  'pai_cpf',
  'pai_celular',
  'pai_email',
  'resp_tipo',
  'resp_nome',
  'resp_parentesco',
  'resp_parentesco_outro',
  'resp_cpf',
  'resp_celular',
  'resp_email',
  'contato_principal'
] as const satisfies readonly PatientField[]

function ContatoFields({ control }: { control: Control<PatientInput> }): React.JSX.Element {
  const values = useWatch({ control, name: FICHA_CONTATO })
  const ficha = Object.fromEntries(FICHA_CONTATO.map((f, i) => [f, values[i]])) as Pick<
    PatientInput,
    (typeof FICHA_CONTATO)[number]
  >
  const pessoas = pessoasDaFicha(ficha)
  const atual = contatoPrincipal(ficha)
  const opcoes = pessoas
    .filter((p) => p.papel !== 'paciente' || ficha.nome.trim() !== '')
    .map((p) => {
      const valor = CONTATO_DO_PAPEL[p.papel]
      return [valor, p.papel === 'outro' ? p.parentesco : CONTATO_LABEL[valor]] as const
    })

  return (
    <div className="col-span-6 flex flex-col gap-2">
      {opcoes.length > 0 && (
        <Controller
          control={control}
          name="contato_principal"
          render={({ field }) => (
            <div className="flex">
              <Segmented
                label="Contato principal"
                value={atual ? CONTATO_DO_PAPEL[atual.papel] : ''}
                options={opcoes}
                onChange={field.onChange}
              />
            </div>
          )}
        />
      )}
      <p className="text-[13px] text-ink-soft">
        {!atual
          ? 'Cadastre a mãe, o pai, outro responsável ou o celular do paciente.'
          : atual.celular
            ? `Mensagens para ${atual.nome || 'o paciente'} · ${atual.celular}`
            : `${atual.nome || 'O paciente'} está sem celular na ficha.`}
      </p>
    </div>
  )
}

const DIAS_OPCOES = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
  value: String(d),
  label: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d]
}))

const ACTIVITY_SLOTS: readonly string[] = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

function AtividadesFields({
  control,
  register,
  errors
}: {
  control: Control<PatientInput>
  register: UseFormRegister<PatientInput>
  errors: FieldErrors<PatientInput>
}): React.JSX.Element {
  const ids = useId()
  const { fields, append, remove } = useFieldArray({ control, name: 'atividades' })
  const rowClass = 'grid grid-cols-[minmax(0,1fr)_7.5rem_6.25rem_6.25rem_2rem] items-start gap-x-3'

  return (
    <div className="col-span-6 flex flex-col gap-2">
      {fields.length > 0 && (
        <div aria-hidden="true" className={cn(rowClass, 'text-xs font-medium text-ink')}>
          <span>Atividade</span>
          <span>Dia</span>
          <span>Início</span>
          <span>Término</span>
        </div>
      )}
      {fields.map((item, i) => {
        const rowErrors = errors.atividades?.[i]
        const message =
          rowErrors?.atividade?.message ??
          rowErrors?.fim?.message ??
          rowErrors?.inicio?.message ??
          rowErrors?.dia_semana?.message
        const n = i + 1
        return (
          <div key={item.id} className="flex flex-col">
            <div className={rowClass}>
              <Input
                {...register(`atividades.${i}.atividade`)}
                aria-label={`Atividade ${n}`}
                aria-invalid={Boolean(rowErrors?.atividade)}
                placeholder="Natação, balé, inglês…"
                autoFocus={item.atividade === ''}
              />
              <Controller
                control={control}
                name={`atividades.${i}.dia_semana`}
                render={({ field }) => (
                  <>
                    <label htmlFor={`${ids}-${i}-dia`} className="sr-only">
                      Dia da atividade {n}
                    </label>
                    <Select
                      id={`${ids}-${i}-dia`}
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                      options={DIAS_OPCOES}
                    />
                  </>
                )}
              />
              {(['inicio', 'fim'] as const).map((campo) => (
                <Controller
                  key={campo}
                  control={control}
                  name={`atividades.${i}.${campo}`}
                  render={({ field, fieldState }) => (
                    <div>
                      <label htmlFor={`${ids}-${i}-${campo}`} className="sr-only">
                        {campo === 'inicio' ? 'Início' : 'Término'} da atividade {n}
                      </label>
                      <TimeField
                        id={`${ids}-${i}-${campo}`}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        slots={ACTIVITY_SLOTS}
                        invalid={fieldState.invalid}
                      />
                    </div>
                  )}
                />
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="mt-0.5"
                aria-label={`Remover atividade ${n}`}
                onClick={() => remove(i)}
              >
                <X />
              </Button>
            </div>
            {message && <ErrorText>{message}</ErrorText>}
          </div>
        )
      })}
      {fields.length < ATIVIDADES_MAX && (
        <div className={cn(fields.length > 0 && 'mt-1')}>
          <Button
            variant="ghost"
            className="-ml-3.5"
            onClick={() => append({ atividade: '', dia_semana: 1, inicio: '', fim: '' })}
          >
            <Plus /> Adicionar atividade
          </Button>
        </div>
      )}
    </div>
  )
}

export function PatientFormRoute(): React.JSX.Element {
  const { id } = useParams()
  const patientId = id ? Number(id) : null
  return <PatientFormPage key={patientId ?? 'novo'} patientId={patientId} />
}

function PatientFormPage({ patientId }: { patientId: number | null }): React.JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const ids = useId()
  const isNew = patientId === null
  const [entryDate] = useState(() => toIsoDate(new Date()))

  const {
    data: patient,
    error: loadError,
    refetch
  } = useQuery({ ...patientQuery(patientId ?? 0), enabled: !isNew })

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty }
  } = useForm<PatientInput>({
    resolver: zodResolver(patientInputSchema),
    defaultValues: { ...emptyPatientInput(), data_entrada: entryDate }
  })

  const draft = useDraft<PatientInput>(
    isNew ? null : `patient:${patientId}`,
    patient?.updated_at,
    isDirty,
    () => getValues()
  )

  useEffect(() => {
    if (!patient) return
    reset(toInput(patient))
    const restored = draft.take()
    if (restored) reset(restored, { keepDefaultValues: true })
  }, [patient, reset, draft])

  const save = useMutation({
    mutationFn: (input: PatientInput) =>
      isNew
        ? window.api.patients.create(input)
        : window.api.patients.update(patientId, input, patient?.updated_at),
    onSuccess: (saved) => {
      draft.discard()
      queryClient.setQueryData(['patient', saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ['patients'] })
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast({ title: isNew ? 'Paciente cadastrado' : 'Alterações salvas', description: saved.nome })
      void navigate('/pacientes', { state: { saved: saved.id } })
    }
  })

  const toggleAtivo = useMutation({
    mutationFn: () => window.api.patients.setAtivo(patientId!, !patient!.ativo),
    onSuccess: (saved) => {
      queryClient.setQueryData(['patient', saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast(
        saved.ativo
          ? { title: 'Paciente reativado', description: saved.nome }
          : {
              title: 'Paciente inativado',
              description: saved.nome,
              icon: <Archive />,
              action: {
                label: 'Desfazer',
                icon: <Undo2 />,
                altText: 'Para desfazer, use Reativar na ficha do paciente.',
                onClick: () => {
                  void window.api.patients.setAtivo(saved.id, true).then((back) => {
                    queryClient.setQueryData(['patient', back.id], back)
                    void queryClient.invalidateQueries({ queryKey: ['patients'] })
                    toast({ title: 'Paciente reativado', description: back.nome })
                  })
                }
              }
            }
      )
    }
  })

  const nome = useWatch({ control, name: 'nome' })
  const nascimento = useWatch({ control, name: 'data_nascimento' })
  const [celularPaciente, emailPaciente] = useWatch({ control, name: ['celular', 'email'] })
  const idade = formatAge(nascimento)
  const adulto = isAdult(nascimento)
  const contatoPaciente = celularPaciente !== '' || emailPaciente !== ''

  if (!isNew && !patient) {
    return (
      <Page trail={[PATIENTS_CRUMB, { label: 'Ficha do paciente' }]}>
        {loadError ? (
          <ErrorState
            title="Não foi possível abrir a ficha"
            detail={loadError.message}
            onRetry={() => void refetch()}
          >
            Tente de novo. Se o problema continuar, feche e abra o Auri.
          </ErrorState>
        ) : (
          <Loading />
        )}
      </Page>
    )
  }

  const err = (field: keyof PatientInput): string | undefined => errors[field]?.message
  const invalid = (field: keyof PatientInput): boolean => Boolean(errors[field])

  const nomeAtual = nome.trim() || (isNew ? '' : (patient?.nome ?? ''))

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="h-full">
      <Page
        trail={[
          PATIENTS_CRUMB,
          { label: isNew ? 'Novo paciente' : (patient?.nome ?? 'Ficha do paciente') }
        ]}
        actions={
          <>
            {!isNew && patient && (
              <PrintButton
                label="Imprimir ficha"
                blocked={isDirty ? 'Salve as alterações para imprimir' : undefined}
                print={() => window.api.documents.patientPdf(patient.id)}
              />
            )}
            {!isNew && patient && (
              <Button
                variant="secondary"
                onClick={() => toggleAtivo.mutate()}
                loading={toggleAtivo.isPending}
              >
                {patient.ativo ? 'Inativar' : 'Reativar'}
              </Button>
            )}
            <Button type="submit" loading={save.isPending} disabled={!isNew && !isDirty}>
              {isNew ? 'Cadastrar paciente' : 'Salvar alterações'}
            </Button>
          </>
        }
      >
        <div className={PATIENT_COLUMN}>
          <PatientHeader
            nome={nomeAtual}
            nascimento={nascimento}
            inativo={patient ? !patient.ativo : false}
            placeholder="Novo paciente"
            tabs={isNew ? undefined : { patientId, value: 'ficha' }}
          >
            {isNew && !idade && (
              <span className="text-[13px] text-ink-soft">
                Preencha a ficha de entrada. Só o nome é obrigatório.
              </span>
            )}
          </PatientHeader>

          {(save.error || toggleAtivo.error) && (
            <Callout
              tone="danger"
              title={
                save.error ? 'Não foi possível salvar a ficha' : 'Não foi possível mudar o cadastro'
              }
              className="mb-5"
            >
              {(save.error ?? toggleAtivo.error)!.message}
            </Callout>
          )}

          <div className="flex flex-col">
            <FormSection id="secao-paciente" title="Paciente" description="Dados de identificação.">
              <Field label="Nome completo" error={err('nome')} className="col-span-6">
                <Input {...register('nome')} aria-invalid={invalid('nome')} autoFocus={isNew} />
              </Field>
              <Field
                label="Data de nascimento"
                htmlFor={`${ids}-nascimento`}
                error={err('data_nascimento')}
                className="col-span-2"
              >
                <Controller
                  control={control}
                  name="data_nascimento"
                  render={({ field, fieldState }) => (
                    <DateField
                      id={`${ids}-nascimento`}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={fieldState.invalid}
                    />
                  )}
                />
              </Field>
              <Field label="CPF" error={err('cpf')} className="col-span-2">
                <MaskedInput
                  control={control}
                  name="cpf"
                  mask={formatCpf}
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="RG" error={err('rg')} className="col-span-2">
                <Input {...register('rg')} aria-invalid={invalid('rg')} />
              </Field>
              {(adulto || contatoPaciente) && (
                <>
                  <Field label="Celular" error={err('celular')} className="col-span-3">
                    <MaskedInput
                      control={control}
                      name="celular"
                      mask={formatPhone}
                      placeholder="(00) 00000-0000"
                    />
                  </Field>
                  <Field label="E-mail" error={err('email')} className="col-span-3">
                    <Input type="email" {...register('email')} aria-invalid={invalid('email')} />
                  </Field>
                </>
              )}
            </FormSection>

            <FormSection id="secao-escola" title="Escola" description="Onde estuda e com quem.">
              <Field label="Escola" error={err('escola')} className="col-span-4">
                <Input {...register('escola')} />
              </Field>
              <Field label="Professora" error={err('professora')} className="col-span-2">
                <Input {...register('professora')} />
              </Field>
              <SerieFields
                control={control}
                register={register}
                err={err}
                invalid={invalid}
                textoAntigo={Boolean(patient?.serie)}
              />
            </FormSection>

            <FormSection
              id="secao-atividades"
              title="Atividades"
              description="Atividades fora da escola, com dia e horário."
            >
              <AtividadesFields control={control} register={register} errors={errors} />
            </FormSection>

            <FormSection id="secao-mae" title="Mãe">
              <Field label="Nome da mãe" error={err('mae_nome')} className="col-span-6">
                <Input {...register('mae_nome')} />
              </Field>
              <Field label="Celular" error={err('mae_celular')} className="col-span-3">
                <MaskedInput
                  control={control}
                  name="mae_celular"
                  mask={formatPhone}
                  placeholder="(00) 00000-0000"
                />
              </Field>
              <Field label="E-mail" error={err('mae_email')} className="col-span-3">
                <Input
                  type="email"
                  {...register('mae_email')}
                  aria-invalid={invalid('mae_email')}
                />
              </Field>
              <Field label="CPF" error={err('mae_cpf')} className="col-span-2">
                <MaskedInput
                  control={control}
                  name="mae_cpf"
                  mask={formatCpf}
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="RG" error={err('mae_rg')} className="col-span-2">
                <Input {...register('mae_rg')} />
              </Field>
              <Field label="Profissão" error={err('mae_profissao')} className="col-span-2">
                <Input {...register('mae_profissao')} />
              </Field>
            </FormSection>

            <FormSection id="secao-pai" title="Pai">
              <Field label="Nome do pai" error={err('pai_nome')} className="col-span-6">
                <Input {...register('pai_nome')} aria-invalid={invalid('pai_nome')} />
              </Field>
              <Field label="Celular" error={err('pai_celular')} className="col-span-3">
                <MaskedInput
                  control={control}
                  name="pai_celular"
                  mask={formatPhone}
                  placeholder="(00) 00000-0000"
                />
              </Field>
              <Field label="E-mail" error={err('pai_email')} className="col-span-3">
                <Input
                  type="email"
                  {...register('pai_email')}
                  aria-invalid={invalid('pai_email')}
                />
              </Field>
              <Field label="CPF" error={err('pai_cpf')} className="col-span-2">
                <MaskedInput
                  control={control}
                  name="pai_cpf"
                  mask={formatCpf}
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="RG" error={err('pai_rg')} className="col-span-2">
                <Input {...register('pai_rg')} />
              </Field>
              <Field label="Profissão" error={err('pai_profissao')} className="col-span-2">
                <Input {...register('pai_profissao')} />
              </Field>
            </FormSection>

            <FormSection
              id="secao-responsavel"
              title="Responsável"
              description="Quem assina os termos e a presença nas sessões."
            >
              <ResponsavelFields
                control={control}
                register={register}
                err={err}
                invalid={invalid}
                adulto={adulto}
              />
            </FormSection>

            <FormSection
              id="secao-contato"
              title="Contato principal"
              description="Quem recebe as mensagens e confirmações da clínica."
            >
              <ContatoFields control={control} />
            </FormSection>

            <FormSection id="secao-endereco" title="Endereço">
              <Field label="Rua e número" error={err('endereco')} className="col-span-6">
                <Input {...register('endereco')} />
              </Field>
              <Field label="Bairro" error={err('bairro')} className="col-span-3">
                <Input {...register('bairro')} />
              </Field>
              <Field label="Cidade" error={err('cidade')} className="col-span-2">
                <Input {...register('cidade')} placeholder="Sinop" />
              </Field>
              <Field label="UF" htmlFor={`${ids}-uf`} error={err('uf')} className="col-span-1">
                <Controller
                  control={control}
                  name="uf"
                  render={({ field, fieldState }) => (
                    <Select
                      id={`${ids}-uf`}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={UF_OPCOES}
                      invalid={fieldState.invalid}
                    />
                  )}
                />
              </Field>
            </FormSection>

            <FormSection
              id="secao-outros"
              title="Outros"
              description="Como chegou à clínica e observações gerais."
            >
              <Field label="Indicação" error={err('indicacao')} className="col-span-2">
                <Input {...register('indicacao')} />
              </Field>
              <Field label="Pediatra" error={err('pediatra')} className="col-span-2">
                <Input {...register('pediatra')} />
              </Field>
              <Field
                label="Data de entrada"
                htmlFor={`${ids}-entrada`}
                error={err('data_entrada')}
                className="col-span-2"
              >
                <Controller
                  control={control}
                  name="data_entrada"
                  render={({ field, fieldState }) => (
                    <DateField
                      id={`${ids}-entrada`}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={fieldState.invalid}
                    />
                  )}
                />
              </Field>
              <Field label="Observações" error={err('observacoes')} className="col-span-6">
                <Textarea {...register('observacoes')} rows={4} />
              </Field>
            </FormSection>
          </div>
        </div>
      </Page>
    </form>
  )
}
