import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { useEffect, useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useParams } from 'react-router'
import { toIsoDate } from '@shared/dates'
import {
  ANAMNESE_FIELDS,
  anamneseInputSchema,
  type Anamnese,
  type AnamneseInput,
  type Patient
} from '@shared/schemas'
import { Page } from '@renderer/components/Layout'
import { PatientHeader, PatientTabs } from '@renderer/components/PatientHeader'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { DateField } from '@renderer/components/ui/date-field'
import { ErrorState } from '@renderer/components/ui/error'
import { Field, Textarea } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import { useDraft } from '@renderer/lib/drafts'
import { anamneseQuery, patientQuery } from '@renderer/lib/queries'
import { PATIENTS_CRUMB } from '@renderer/lib/session'
import { useToast } from '@renderer/lib/toast'

type Topic = { field: Exclude<keyof AnamneseInput, 'data'>; title: string; hint: string }

/** Os temas que aparecem nas anotações à mão das fichas de entrada, na ordem da conversa. */
const TOPICS: Topic[] = [
  {
    field: 'queixa',
    title: 'Queixa',
    hint: 'Por que a família procurou a clínica, nas palavras dela.'
  },
  {
    field: 'gestacao',
    title: 'Gestação e nascimento',
    hint: 'Semanas, peso, comprimento, tipo de parto, intercorrências.'
  },
  {
    field: 'alimentacao',
    title: 'Alimentação',
    hint: 'Amamentação, pega, mamadeira, copinho, introdução alimentar.'
  },
  {
    field: 'sono',
    title: 'Sono',
    hint: 'Rotina, quantas horas dorme, quando acorda e o que faz.'
  },
  {
    field: 'desenvolvimento',
    title: 'Desenvolvimento e fala',
    hint: 'Quando começou a falar e a andar, vocabulário, compreensão.'
  },
  {
    field: 'saude',
    title: 'Saúde',
    hint: 'Dores, cólicas, alergias, medicações, exames (ex.: teste da linguinha).'
  },
  {
    field: 'rotina',
    title: 'Escola e rotina',
    hint: 'Adaptação, repetências, socialização, atividades.'
  },
  {
    field: 'terapias',
    title: 'Terapias',
    hint: 'Fono, ABA, psicologia e outras: onde, por quanto tempo, se continuam.'
  },
  { field: 'observacoes', title: 'Observações', hint: 'O que não coube nos outros temas.' }
]

function toInput(anamnese: Anamnese): AnamneseInput {
  return Object.fromEntries(ANAMNESE_FIELDS.map((f) => [f, anamnese[f]])) as AnamneseInput
}

export function PatientAnamneseRoute(): React.JSX.Element {
  const patientId = Number(useParams().id)
  return <PatientAnamnesePage key={patientId} patientId={patientId} />
}

function PatientAnamnesePage({ patientId }: { patientId: number }): React.JSX.Element {
  const patient = useQuery(patientQuery(patientId))
  const anamnese = useQuery(anamneseQuery(patientId))
  const error = patient.error ?? anamnese.error
  const tabs = <PatientTabs patientId={patientId} value="anamnese" />

  if (!patient.data || !anamnese.data) {
    return (
      <Page trail={[PATIENTS_CRUMB, { label: patient.data?.nome ?? 'Anamnese' }]} toolbar={tabs}>
        {error ? (
          <ErrorState
            title="Não foi possível abrir a anamnese"
            detail={error.message}
            onRetry={() => {
              void patient.refetch()
              void anamnese.refetch()
            }}
          >
            Tente de novo. Se o problema continuar, feche e abra o Auri.
          </ErrorState>
        ) : (
          <Loading />
        )}
      </Page>
    )
  }

  return <AnamneseForm patient={patient.data} anamnese={anamnese.data} tabs={tabs} />
}

function AnamneseForm({
  patient,
  anamnese,
  tabs
}: {
  patient: Patient
  anamnese: Anamnese
  tabs: React.ReactNode
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const toast = useToast()
  const ids = useId()

  // Ainda não escrita: a data sugerida é a da entrada na clínica (ou hoje), como na folha
  const [today] = useState(() => toIsoDate(new Date()))
  const initial = (a: Anamnese): AnamneseInput =>
    a.updated_at === null ? { ...toInput(a), data: patient.data_entrada || today } : toInput(a)

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty }
  } = useForm<AnamneseInput>({
    resolver: zodResolver(anamneseInputSchema),
    defaultValues: initial(anamnese)
  })

  // '' (e não null) quando ainda não existe: o rascunho vale enquanto ninguém criar a anamnese
  const draft = useDraft<AnamneseInput>(
    `anamnese:${patient.id}`,
    anamnese.updated_at ?? '',
    isDirty,
    () => getValues()
  )

  useEffect(() => {
    const restored = draft.take()
    if (restored) reset(restored, { keepDefaultValues: true })
  }, [draft, reset])

  const save = useMutation({
    mutationFn: (input: AnamneseInput) =>
      // recusa se a anamnese foi salva em outro computador depois de aberta aqui
      window.api.anamneses.save(patient.id, input, anamnese.updated_at ?? ''),
    onSuccess: (saved) => {
      draft.discard()
      queryClient.setQueryData(['anamnese', patient.id], saved)
      reset(toInput(saved))
      toast({ title: 'Anamnese salva', description: patient.nome })
    }
  })

  const savedAt =
    anamnese.updated_at &&
    format(new Date(anamnese.updated_at), "'Salva em' d 'de' MMM 'às' HH:mm", { locale: ptBR })

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="h-full">
      <Page
        trail={[PATIENTS_CRUMB, { label: patient.nome }]}
        toolbar={tabs}
        actions={
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Salvar anamnese
          </Button>
        }
      >
        <div className="mx-auto max-w-[720px] px-8 pt-6 pb-16">
          <PatientHeader
            nome={patient.nome}
            nascimento={patient.data_nascimento}
            inativo={!patient.ativo}
          >
            {savedAt && <span className="text-ink-soft">{savedAt.replace('.', '')}</span>}
          </PatientHeader>

          {save.error && (
            <Callout tone="danger" title="Não foi possível salvar a anamnese" className="mb-5">
              {save.error.message} O texto continua nos campos: tente de novo.
            </Callout>
          )}

          <Field
            label="Data da anamnese"
            htmlFor={`${ids}-data`}
            error={errors.data?.message}
            className="w-44"
          >
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

          <div className="mt-10 flex flex-col gap-9">
            {TOPICS.map((topic) => (
              <section key={topic.field} className="flex flex-col gap-2.5">
                <label htmlFor={`${ids}-${topic.field}`}>
                  <span className="block text-[15px] font-semibold tracking-tight">
                    {topic.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">{topic.hint}</span>
                </label>
                <Textarea
                  id={`${ids}-${topic.field}`}
                  {...register(topic.field)}
                  aria-invalid={Boolean(errors[topic.field])}
                  rows={3}
                  // cresce com o texto, como uma folha: sem rolagem dentro do campo
                  className="field-sizing-content min-h-20 resize-none leading-relaxed"
                />
                {errors[topic.field] && (
                  <span className="text-xs text-danger">{errors[topic.field]?.message}</span>
                )}
              </section>
            ))}
          </div>
        </div>
      </Page>
    </form>
  )
}
