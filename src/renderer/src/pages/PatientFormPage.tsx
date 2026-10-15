import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Undo2 } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { formatAge, toIsoDate } from '@shared/dates'
import { formatCpf, formatPhone } from '@shared/masks'
import {
  emptyPatientInput,
  PATIENT_FIELDS,
  patientInputSchema,
  type Patient,
  type PatientInput
} from '@shared/schemas'
import { Page } from '@renderer/components/Layout'
import { PatientHeader, PatientTabs } from '@renderer/components/PatientHeader'
import { Loading } from '@renderer/components/ui/loading'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ErrorState } from '@renderer/components/ui/error'
import { DateField } from '@renderer/components/ui/date-field'
import { Field, Input, Textarea } from '@renderer/components/ui/input'
import { useDraft } from '@renderer/lib/drafts'
import { patientQuery } from '@renderer/lib/queries'
import { PATIENTS_CRUMB } from '@renderer/lib/session'
import { useToast } from '@renderer/lib/toast'

function toInput(patient: Patient): PatientInput {
  return Object.fromEntries(PATIENT_FIELDS.map((f) => [f, patient[f]])) as PatientInput
}

/**
 * Uma seção da ficha: título e descrição à esquerda (fixos enquanto a seção rola), campos à
 * direita. Sem cartões: um filete separa as seções e o espaço faz o agrupamento.
 */
function Section({
  id,
  title,
  description,
  children
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="grid grid-cols-[200px_1fr] gap-x-8 py-7">
      <div>
        <div className="sticky top-4">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-1 text-xs text-ink-soft">{description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-6 gap-x-3 gap-y-4">{children}</div>
    </section>
  )
}

function MaskedInput({
  control,
  name,
  mask,
  placeholder
}: {
  control: Control<PatientInput>
  name: keyof PatientInput
  mask: (value: string) => string
  placeholder?: string
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
          aria-invalid={fieldState.invalid}
        />
      )}
    />
  )
}

export function PatientFormRoute(): React.JSX.Element {
  const { id } = useParams()
  const patientId = id ? Number(id) : null
  // key: trocar de paciente recria o formulário do zero
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

  // o que foi digitado e não salvo volta ao trocar de aba (anamnese, sessões) e retornar
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
        : // recusa se a ficha foi salva em outro computador depois de aberta aqui
          window.api.patients.update(patientId, input, patient?.updated_at),
    onSuccess: (saved) => {
      draft.discard()
      queryClient.setQueryData(['patient', saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ['patients'] })
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast({ title: isNew ? 'Paciente cadastrado' : 'Alterações salvas', description: saved.nome })
      // `saved`: a lista destaca (e rola até) a linha deste paciente
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
  const idade = formatAge(nascimento)
  const tabs = isNew ? undefined : <PatientTabs patientId={patientId} value="ficha" />

  // Ficha existente ainda não carregada (ou com falha): só o cabeçalho e o estado, nunca o
  // formulário vazio com o título "Novo paciente".
  if (!isNew && !patient) {
    return (
      <Page trail={[PATIENTS_CRUMB, { label: 'Ficha do paciente' }]} toolbar={tabs}>
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
          // o nome salvo, não o que está sendo digitado (esse aparece grande no corpo)
          { label: isNew ? 'Novo paciente' : (patient?.nome ?? 'Ficha do paciente') }
        ]}
        toolbar={tabs}
        actions={
          <>
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
        <div className="mx-auto max-w-[840px] px-8 pt-6 pb-16">
          <PatientHeader
            nome={nomeAtual}
            nascimento={nascimento}
            inativo={patient ? !patient.ativo : false}
            placeholder="Novo paciente"
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
            <Section id="secao-paciente" title="Paciente" description="Dados de identificação.">
              <Field label="Nome completo" error={err('nome')} className="col-span-6">
                <Input {...register('nome')} aria-invalid={invalid('nome')} autoFocus={isNew} />
              </Field>
              <Field
                label="Data de nascimento"
                htmlFor={`${ids}-nascimento`}
                error={err('data_nascimento')}
                hint={idade}
                className="col-span-3"
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
              <Field label="CPF" error={err('cpf')} className="col-span-3">
                <MaskedInput
                  control={control}
                  name="cpf"
                  mask={formatCpf}
                  placeholder="000.000.000-00"
                />
              </Field>
            </Section>

            <Section id="secao-escola" title="Escola" description="Onde estuda e com quem.">
              <Field label="Escola" error={err('escola')} className="col-span-3">
                <Input {...register('escola')} />
              </Field>
              <Field label="Série" error={err('serie')} className="col-span-1">
                <Input {...register('serie')} />
              </Field>
              <Field label="Professora" error={err('professora')} className="col-span-2">
                <Input {...register('professora')} />
              </Field>
            </Section>

            <Section id="secao-mae" title="Mãe" description="Contato principal da família.">
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
            </Section>

            <Section id="secao-pai" title="Pai">
              <Field label="Nome do pai" error={err('pai_nome')} className="col-span-4">
                <Input {...register('pai_nome')} />
              </Field>
              <Field label="Profissão" error={err('pai_profissao')} className="col-span-2">
                <Input {...register('pai_profissao')} />
              </Field>
            </Section>

            <Section id="secao-endereco" title="Endereço">
              <Field label="Rua e número" error={err('endereco')} className="col-span-6">
                <Input {...register('endereco')} />
              </Field>
              <Field label="Bairro" error={err('bairro')} className="col-span-3">
                <Input {...register('bairro')} />
              </Field>
              <Field label="Cidade" error={err('cidade')} className="col-span-3">
                <Input {...register('cidade')} placeholder="Sinop-MT" />
              </Field>
            </Section>

            <Section
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
            </Section>
          </div>
        </div>
      </Page>
    </form>
  )
}
