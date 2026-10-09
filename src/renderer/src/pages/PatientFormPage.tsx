import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
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
import { Avatar } from '@renderer/components/ui/avatar'
import { Loading } from '@renderer/components/ui/bars'
import { Button } from '@renderer/components/ui/button'
import { ErrorState } from '@renderer/components/ui/error'
import { Field, Input, Textarea } from '@renderer/components/ui/input'

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
    <section
      aria-labelledby={id}
      className="grid grid-cols-[200px_1fr] gap-x-8 border-t border-line py-6"
    >
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

/** Botão de voltar da barra da página. */
function BackLink(): React.JSX.Element {
  return (
    <Link
      to="/pacientes"
      aria-label="Voltar para pacientes"
      title="Voltar para pacientes"
      className="no-drag grid size-8 place-items-center rounded-control bg-surface text-ink-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors hover:bg-canvas hover:text-ink pointer-coarse:size-11 [&_svg]:size-4 [&_svg]:stroke-[1.75]"
    >
      <ChevronLeft aria-hidden="true" />
    </Link>
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
  const isNew = patientId === null

  const {
    data: patient,
    error: loadError,
    refetch
  } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => window.api.patients.get(patientId!),
    enabled: !isNew
  })

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<PatientInput>({
    resolver: zodResolver(patientInputSchema),
    defaultValues: { ...emptyPatientInput(), data_entrada: toIsoDate(new Date()) }
  })

  useEffect(() => {
    if (patient) reset(toInput(patient))
  }, [patient, reset])

  const save = useMutation({
    mutationFn: (input: PatientInput) =>
      isNew ? window.api.patients.create(input) : window.api.patients.update(patientId, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(['patient', saved.id], saved)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      navigate('/pacientes')
    }
  })

  const toggleAtivo = useMutation({
    mutationFn: () => window.api.patients.setAtivo(patientId!, !patient!.ativo),
    onSuccess: (saved) => {
      queryClient.setQueryData(['patient', saved.id], saved)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    }
  })

  const nome = useWatch({ control, name: 'nome' })
  const nascimento = useWatch({ control, name: 'data_nascimento' })
  const idade = formatAge(nascimento)

  // Ficha existente ainda não carregada (ou com falha): só o cabeçalho e o estado, nunca o
  // formulário vazio com o título "Novo paciente".
  if (!isNew && !patient) {
    return (
      <Page lead={<BackLink />} title="Ficha do paciente">
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
        lead={<BackLink />}
        title={isNew ? 'Novo paciente' : 'Ficha do paciente'}
        actions={
          <>
            {!isNew && patient && (
              <Button
                variant="outline"
                onClick={() => toggleAtivo.mutate()}
                loading={toggleAtivo.isPending}
              >
                {patient.ativo ? 'Inativar' : 'Reativar'}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/pacientes')}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!isNew && !isDirty}>
              {isNew ? 'Cadastrar paciente' : 'Salvar alterações'}
            </Button>
          </>
        }
      >
        <div className="mx-auto max-w-[840px] px-8 pt-6 pb-16">
          <header className="mb-6 flex items-center gap-4">
            <Avatar name={nomeAtual} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[26px] leading-tight font-semibold tracking-tight">
                {nomeAtual || 'Novo paciente'}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {idade && (
                  <span className="rounded-chip bg-fill px-2 py-0.5 font-medium text-ink-soft tabular-nums">
                    {idade}
                  </span>
                )}
                {patient && !patient.ativo && (
                  <span className="rounded-chip bg-danger/8 px-2 py-0.5 font-medium text-danger">
                    Inativo
                  </span>
                )}
                {isNew && !idade && (
                  <span className="text-[13px] text-ink-soft">
                    Preencha a ficha de entrada. Só o nome é obrigatório.
                  </span>
                )}
              </div>
            </div>
          </header>

          {(save.error || toggleAtivo.error) && (
            <p className="mb-5 rounded-card bg-danger/8 p-3 text-xs text-danger" role="alert">
              {(save.error ?? toggleAtivo.error)!.message}
            </p>
          )}

          <div className="flex flex-col">
            <Section id="secao-paciente" title="Paciente" description="Dados de identificação.">
              <Field label="Nome completo" error={err('nome')} className="col-span-6">
                <Input {...register('nome')} aria-invalid={invalid('nome')} autoFocus={isNew} />
              </Field>
              <Field
                label="Data de nascimento"
                error={err('data_nascimento')}
                hint={idade}
                className="col-span-3"
              >
                <Input
                  type="date"
                  {...register('data_nascimento')}
                  aria-invalid={invalid('data_nascimento')}
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
              <Field label="Data de entrada" error={err('data_entrada')} className="col-span-2">
                <Input
                  type="date"
                  {...register('data_entrada')}
                  aria-invalid={invalid('data_entrada')}
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
