import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Braces } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toIsoDate } from '@shared/dates'
import { termModelInputSchema, type TermModel } from '@shared/schemas'
import { CAMPOS, preencher, valoresDosCampos } from '@shared/terms'
import { Page } from '@renderer/components/Layout'
import { TermContent } from '@renderer/components/TermContent'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ErrorState } from '@renderer/components/ui/error'
import { Field, Input, Textarea } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import { clinicQuery, termModelsQuery } from '@renderer/lib/queries'
import { formatar } from '@renderer/lib/term-format'
import { useToast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

const CLINICA_CRUMB = { label: 'Clínica', to: '/clinica' }

const FERRAMENTA =
  'inline-flex h-6 min-w-6 items-center justify-center rounded-chip bg-fill text-ink-soft transition-colors hover:bg-fill-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const ESTRUTURA = `# Termo de consentimento

[Apresente a clínica e o atendimento. Os campos entre chaves se preenchem sozinhos: {paciente}, nascido(a) em {nascimento}, atendido(a) por {profissional} ({registro}).]

## 1. [Primeiro assunto]

[Explique o que a família precisa saber.]

- [Um item]
- [Outro item]

## 2. Da assinatura eletrônica

[Cláusula em que quem assina aceita a assinatura pelo celular como válida. Revise com o advogado da clínica.]`

const FORMATOS = [
  { nome: 'Título', dica: '# no começo da linha', linha: '# ' },
  { nome: 'Subtítulo', dica: '## no começo da linha', linha: '## ' },
  { nome: 'Lista', dica: '- no começo da linha', linha: '- ' },
  { nome: 'Negrito', dica: '**texto**', linha: null }
] as const

export function TermModelRoute(): React.JSX.Element {
  const { id } = useParams()
  const models = useQuery(termModelsQuery())
  const modelId = id === undefined ? null : Number(id)
  if (modelId === null) return <TermModelEditor key="novo" model={null} />
  const model = models.data?.find((m) => m.id === modelId)
  if (model) return <TermModelEditor key={model.id} model={model} />
  return (
    <Page trail={[CLINICA_CRUMB, { label: 'Modelo de termo' }]}>
      {models.error || (models.data && !model) ? (
        <ErrorState
          title="Não foi possível abrir o modelo"
          detail={models.error?.message ?? 'Modelo não encontrado'}
          onRetry={() => void models.refetch()}
        >
          Volte para a tela Clínica e abra de novo.
        </ErrorState>
      ) : (
        <Loading />
      )}
    </Page>
  )
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

function TermModelEditor({ model }: { model: TermModel | null }): React.JSX.Element {
  const ids = useId()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const clinic = useQuery(clinicQuery())
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [hoje] = useState(() => toIsoDate(new Date()))
  const [titulo, setTitulo] = useState(model?.titulo ?? '')
  const [texto, setTexto] = useState(model?.texto ?? '')
  const changed = !model || titulo !== model.titulo || texto !== model.texto
  const parsed = termModelInputSchema.safeParse({ titulo: titulo.trim(), texto })
  const medida = useDebounced(parsed.success ? parsed.data : null, 300)
  const measure = useQuery({
    queryKey: ['terms', 'measure', medida],
    queryFn: () => window.api.terms.measureModel(medida!),
    enabled: medida !== null,
    placeholderData: (previous) => previous
  })
  const uso = measure.data ? measure.data.tamanho / measure.data.limite : 0
  const cabe = uso <= 1

  const save = useMutation({
    mutationFn: () => window.api.terms.saveModel(model?.id ?? null, parsed.data!),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['terms'] })
      toast({
        title: model ? `Versão ${saved.versao} salva` : 'Modelo criado',
        description: saved.titulo
      })
      void navigate('/clinica')
    }
  })
  const archive = useMutation({
    mutationFn: () => window.api.terms.archiveModel(model!.id, !model!.arquivado),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['terms'] })
      toast({
        title: saved.arquivado ? 'Modelo arquivado' : 'Modelo de volta',
        description: saved.titulo
      })
    }
  })

  const inserir = (campo: string): void => {
    const el = textarea.current
    const start = el?.selectionStart ?? texto.length
    const end = el?.selectionEnd ?? texto.length
    const novo = `${texto.slice(0, start)}{${campo}}${texto.slice(end)}`
    setTexto(novo)
    requestAnimationFrame(() => {
      el?.focus()
      const pos = start + campo.length + 2
      el?.setSelectionRange(pos, pos)
    })
  }

  const aplicar = (formato: (typeof FORMATOS)[number]): void => {
    const el = textarea.current
    const result = formatar(
      texto,
      el?.selectionStart ?? texto.length,
      el?.selectionEnd ?? texto.length,
      formato.linha
    )
    setTexto(result.texto)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(result.start, result.end)
    })
  }

  const exemplo = preencher(
    texto,
    valoresDosCampos({
      paciente: 'Ana Beatriz Fictícia',
      nascimento: '2019-03-04',
      clinica: clinic.data?.nome || 'Clínica',
      profissional: clinic.data?.profissional || 'Profissional',
      registro: clinic.data?.registro || 'registro',
      data: hoje
    })
  )

  return (
    <Page
      trail={[CLINICA_CRUMB, { label: model?.titulo ?? 'Novo modelo' }]}
      actions={
        <>
          {model && (
            <Button
              variant="secondary"
              loading={archive.isPending}
              onClick={() => archive.mutate()}
            >
              {model.arquivado ? <ArchiveRestore /> : <Archive />}
              {model.arquivado ? 'Desarquivar' : 'Arquivar'}
            </Button>
          )}
          <Button
            loading={save.isPending}
            disabled={!changed || !parsed.success || !cabe}
            onClick={() => save.mutate()}
          >
            {model ? `Salvar versão ${model.versao + 1}` : 'Criar modelo'}
          </Button>
        </>
      }
    >
      <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_380px] gap-10 px-8 pt-8 pb-16">
        <div className="flex min-w-0 flex-col gap-4">
          {model && (
            <p className="text-[13px] text-ink-soft">
              Versão {model.versao}. Os termos já assinados ficam com o texto deles.
            </p>
          )}
          {(save.error ?? archive.error) && (
            <Callout tone="danger" title="Não foi possível salvar">
              {(save.error ?? archive.error)!.message}
            </Callout>
          )}
          <Field label="Título" htmlFor={`${ids}-titulo`}>
            <Input
              id={`${ids}-titulo`}
              value={titulo}
              maxLength={120}
              autoFocus={!model}
              placeholder="Termo de consentimento"
              onChange={(e) => setTitulo(e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <div className="flex h-7 items-center justify-between gap-3">
              <label htmlFor={`${ids}-texto`} className="text-xs font-medium">
                Texto
              </label>
              {!texto.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-2.5"
                  onClick={() => setTexto(ESTRUTURA)}
                >
                  Começar de uma estrutura
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1" role="group" aria-label="Formatar">
                {FORMATOS.map((formato) => (
                  <button
                    key={formato.nome}
                    type="button"
                    title={`${formato.nome} (${formato.dica})`}
                    onClick={() => aplicar(formato)}
                    className={cn(
                      FERRAMENTA,
                      'px-2 text-xs',
                      formato.linha === null && 'font-semibold'
                    )}
                  >
                    {formato.nome}
                  </button>
                ))}
              </div>
              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label="Inserir campo"
              >
                <Braces className="mr-1 size-3.5 text-ink-faint" aria-hidden />
                {CAMPOS.map(([campo, nome]) => (
                  <button
                    key={campo}
                    type="button"
                    title={`Inserir ${nome.toLowerCase()}`}
                    onClick={() => inserir(campo)}
                    className={cn(FERRAMENTA, 'px-2 font-mono text-[11px]')}
                  >
                    {`{${campo}}`}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              ref={textarea}
              id={`${ids}-texto`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={22}
              className="font-mono text-[12.5px] leading-relaxed"
              placeholder="# Título do termo&#10;&#10;Texto do primeiro parágrafo."
            />
            <p className="text-xs text-ink-soft">Uma linha em branco começa outro parágrafo.</p>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <div className="sticky top-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-medium">Como aparece no celular</h2>
              <span className="text-xs text-ink-faint">paciente fictício</span>
            </div>
            <div className="max-h-[560px] overflow-y-auto rounded-sheet bg-fill p-5">
              {texto.trim() ? (
                <TermContent texto={exemplo} />
              ) : (
                <p className="text-[13px] text-ink-faint">
                  O texto aparece aqui enquanto você escreve.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-200',
                    cabe ? 'bg-ink-soft' : 'bg-danger'
                  )}
                  style={{ width: `${Math.min(100, Math.round(uso * 100))}%` }}
                />
              </div>
              <p className={cn('text-xs', cabe ? 'text-ink-soft' : 'text-danger')}>
                {measure.data
                  ? cabe
                    ? `Usa ${Math.round(uso * 100)}% do que cabe no link do WhatsApp.`
                    : `Passou do que cabe no link do WhatsApp (${Math.round(uso * 100)}%).`
                  : ''}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Page>
  )
}
