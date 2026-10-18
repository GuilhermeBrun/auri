import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form'
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
import { PATIENT_COLUMN, PatientHeader } from '@renderer/components/PatientHeader'
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
import { cn } from '@renderer/lib/utils'

type Topic = {
  field: Exclude<keyof AnamneseInput, 'data'>
  title: string
  hint: string
  /** Perguntas para guiar a conversa; clicar põe a pergunta no texto, como começo de linha. */
  prompts: string[]
}

/** Os temas que aparecem nas anotações à mão das fichas de entrada, na ordem da conversa. */
const TOPICS: Topic[] = [
  {
    field: 'queixa',
    title: 'Queixa',
    hint: 'Por que a família procurou a clínica, nas palavras dela.',
    prompts: ['Quem percebeu?', 'Desde quando?', 'O que mais preocupa?', 'Já procuraram ajuda?']
  },
  {
    field: 'gestacao',
    title: 'Gestação e nascimento',
    hint: 'Semanas, peso, comprimento, tipo de parto, intercorrências.',
    prompts: ['Semanas:', 'Peso:', 'Comprimento:', 'Tipo de parto:', 'Intercorrências:']
  },
  {
    field: 'alimentacao',
    title: 'Alimentação',
    hint: 'Amamentação, pega, mamadeira, copinho, introdução alimentar.',
    prompts: ['Amamentação até:', 'Pega:', 'Mamadeira:', 'Copinho:', 'Introdução alimentar:']
  },
  {
    field: 'sono',
    title: 'Sono',
    hint: 'Rotina, quantas horas dorme, quando acorda e o que faz.',
    prompts: ['Horário de dormir:', 'Horas de sono:', 'Acorda à noite?', 'Ronca?']
  },
  {
    field: 'desenvolvimento',
    title: 'Desenvolvimento e fala',
    hint: 'Quando começou a falar e a andar, vocabulário, compreensão.',
    prompts: ['Primeiras palavras:', 'Andou com:', 'Frases com:', 'Entende ordens simples?']
  },
  {
    field: 'saude',
    title: 'Saúde',
    hint: 'Dores, cólicas, alergias, medicações, exames (ex.: teste da linguinha).',
    prompts: ['Otites:', 'Alergias:', 'Medicações:', 'Exames:', 'Teste da linguinha:']
  },
  {
    field: 'rotina',
    title: 'Escola e rotina',
    hint: 'Adaptação, repetências, socialização, atividades.',
    prompts: ['Escola e série:', 'Adaptação:', 'Repetências:', 'Com quem brinca?']
  },
  {
    field: 'terapias',
    title: 'Terapias',
    hint: 'Fono, ABA, psicologia e outras: onde, por quanto tempo, se continuam.',
    prompts: ['Fonoaudiologia:', 'ABA:', 'Psicologia:', 'Onde e por quanto tempo?']
  },
  {
    field: 'observacoes',
    title: 'Observações',
    hint: 'O que não coube nos outros temas.',
    prompts: []
  }
]

/**
 * O tema aberto por último em cada paciente, enquanto o Auri estiver aberto: quem sai para olhar a
 * ficha no meio da conversa volta para o mesmo tema.
 */
const lastTopic = new Map<number, number>()

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

  if (!patient.data || !anamnese.data) {
    const state = error ? (
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
    )
    return (
      <Page trail={[PATIENTS_CRUMB, { label: patient.data?.nome ?? 'Anamnese' }]}>
        {/* com o paciente já em mãos, nome e abas ficam no lugar enquanto a anamnese chega */}
        {patient.data ? (
          <div className={PATIENT_COLUMN}>
            <PatientHeader
              nome={patient.data.nome}
              nascimento={patient.data.data_nascimento}
              inativo={!patient.data.ativo}
              tabs={{ patientId, value: 'anamnese' }}
            />
            {state}
          </div>
        ) : (
          state
        )}
      </Page>
    )
  }

  return <AnamneseForm patient={patient.data} anamnese={anamnese.data} />
}

function AnamneseForm({
  patient,
  anamnese
}: {
  patient: Patient
  anamnese: Anamnese
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
    setValue,
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

  const [current, setCurrent] = useState(() => lastTopic.get(patient.id) ?? 0)
  const goTo = (index: number): void => {
    lastTopic.set(patient.id, index)
    setCurrent(index)
  }
  const topic = TOPICS[current]
  const fieldId = `${ids}-${topic.field}`

  // o que já foi escrito em cada tema, para a marca da lista
  const texts = useWatch({ control, name: TOPICS.map((t) => t.field) })
  const written = texts.map((text) => Boolean(text?.trim()))
  const writtenCount = written.filter(Boolean).length

  /** A pergunta entra no fim do texto, numa linha nova, com o cursor logo depois dela. */
  const ask = (prompt: string): void => {
    const text = getValues(topic.field).trimEnd()
    // o campo é não controlado: o setValue já escreve no elemento, então dá para focar na hora
    setValue(topic.field, `${text ? `${text}\n` : ''}${prompt} `, { shouldDirty: true })
    const textarea = document.getElementById(fieldId) as HTMLTextAreaElement | null
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }

  // erro num tema que não está na tela: abre o primeiro tema com erro
  const showFirstError = (invalid: FieldErrors<AnamneseInput>): void => {
    const index = TOPICS.findIndex((t) => invalid[t.field])
    if (index >= 0) goTo(index)
  }

  const savedAt =
    anamnese.updated_at &&
    format(new Date(anamnese.updated_at), "'Salva em' d 'de' MMM 'às' HH:mm", { locale: ptBR })

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values), showFirstError)}
      noValidate
      className="h-full"
    >
      <Page
        trail={[PATIENTS_CRUMB, { label: patient.nome }]}
        actions={
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Salvar anamnese
          </Button>
        }
      >
        <div className={PATIENT_COLUMN}>
          <PatientHeader
            nome={patient.nome}
            nascimento={patient.data_nascimento}
            inativo={!patient.ativo}
            tabs={{ patientId: patient.id, value: 'anamnese' }}
          >
            {savedAt && <span className="text-ink-soft">{savedAt.replace('.', '')}</span>}
          </PatientHeader>

          {save.error && (
            <Callout tone="danger" title="Não foi possível salvar a anamnese" className="mb-5">
              {save.error.message} O texto continua nos campos: tente de novo.
            </Callout>
          )}

          {/* roteiro da conversa: a lista dos temas ao lado e um tema por vez */}
          <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-x-10">
            <div className="flex flex-col gap-6">
              <Field label="Data da anamnese" htmlFor={`${ids}-data`} error={errors.data?.message}>
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

              <nav aria-label="Temas da anamnese" className="flex flex-col gap-0.5">
                {TOPICS.map((t, i) => (
                  <button
                    key={t.field}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === current ? 'step' : undefined}
                    className={cn(
                      'flex h-8 items-center gap-2.5 rounded-control px-2.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-fill hover:text-ink pointer-coarse:h-10',
                      i === current && 'bg-fill-hover font-medium text-ink hover:bg-fill-hover'
                    )}
                  >
                    {/* escrito = quadrado cheio, vazio = só o contorno: a forma diz, não a cor */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-2 shrink-0 rounded-[2px] border border-current',
                        written[i] ? 'bg-current' : 'opacity-60'
                      )}
                    />
                    <span className="truncate">{t.title}</span>
                    <span className="sr-only">{written[i] ? '(escrito)' : '(vazio)'}</span>
                    {errors[t.field] && (
                      <>
                        <CircleAlert
                          aria-hidden="true"
                          className="ml-auto size-3.5 shrink-0 stroke-[2] text-danger"
                        />
                        <span className="sr-only">(com erro)</span>
                      </>
                    )}
                  </button>
                ))}
              </nav>
              <p className="px-2.5 text-xs text-ink-soft tabular-nums">
                {writtenCount} de {TOPICS.length} temas escritos
              </p>
            </div>

            {/* key: o tema novo entra com um fade curto (em "Reduzir movimento" também é fade) */}
            <section
              key={topic.field}
              aria-labelledby={`${fieldId}-title`}
              className="animate-fade-in"
            >
              <p className="text-xs text-ink-soft tabular-nums">
                Tema {current + 1} de {TOPICS.length}
              </p>
              <h2 id={`${fieldId}-title`} className="mt-1 text-[17px] font-semibold tracking-tight">
                <label htmlFor={fieldId}>{topic.title}</label>
              </h2>
              <p className="mt-1 text-xs text-ink-soft">{topic.hint}</p>

              {topic.prompts.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-ink-soft">Perguntas para guiar a conversa</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topic.prompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="secondary"
                        size="sm"
                        onClick={() => ask(prompt)}
                        title="Pôr no texto"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Textarea
                id={fieldId}
                {...register(topic.field)}
                aria-invalid={Boolean(errors[topic.field])}
                aria-describedby={errors[topic.field] ? `${fieldId}-error` : undefined}
                placeholder="Anote do jeito que a família contar."
                rows={6}
                // cresce com o texto, como uma folha: sem rolagem dentro do campo
                className="mt-4 field-sizing-content min-h-40 resize-none leading-relaxed"
              />
              {errors[topic.field] && (
                <span id={`${fieldId}-error`} className="mt-1.5 block text-xs text-danger">
                  {errors[topic.field]?.message}
                </span>
              )}

              {/* -mx: o texto dos botões alinha com as bordas do campo */}
              <div className="-mx-3.5 mt-5 flex justify-between gap-3">
                {current > 0 ? (
                  <Button variant="ghost" onClick={() => goTo(current - 1)}>
                    <ChevronLeft /> {TOPICS[current - 1].title}
                  </Button>
                ) : (
                  <span />
                )}
                {current < TOPICS.length - 1 && (
                  <Button variant="ghost" onClick={() => goTo(current + 1)}>
                    {TOPICS[current + 1].title} <ChevronRight />
                  </Button>
                )}
              </div>
            </section>
          </div>
        </div>
      </Page>
    </form>
  )
}
