import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import {
  CATEGORIA_LABELS,
  CATEGORIAS,
  DURACOES,
  etiquetaInputSchema,
  tipoInputSchema,
  type Categoria,
  type Cor,
  type Etiqueta,
  type TipoAtendimento
} from '@shared/tipos'
import { Button } from '@renderer/components/ui/button'
import { CorEscolha, CorPonto } from '@renderer/components/ui/cor'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input } from '@renderer/components/ui/input'
import { ErrorText, FormSection } from '@renderer/components/ui/section'
import { Segmented } from '@renderer/components/ui/segmented'
import { Select } from '@renderer/components/ui/select'
import { etiquetasQuery, tiposQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'

type Item = { id: number; nome: string; cor: Cor; arquivado: boolean }

function Lista<T extends Item>({
  items,
  detalhe,
  vazio,
  novo,
  arquivadoLabel,
  erro,
  onEdit
}: {
  items: T[]
  detalhe: (item: T) => string
  vazio: string
  novo: string
  arquivadoLabel: string
  erro?: string
  onEdit: (item: T | null) => void
}): React.JSX.Element {
  return (
    <div className="col-span-6 flex flex-col gap-2">
      {erro && <p className="text-xs text-danger">{erro}</p>}
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-faint">{vazio}</p>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <CorPonto cor={item.cor} className={item.arquivado ? 'opacity-40' : undefined} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={
                      item.arquivado
                        ? 'truncate text-[13px] text-ink-soft'
                        : 'truncate text-[13px] font-medium'
                    }
                  >
                    {item.nome}
                  </span>
                  {(item.arquivado || detalhe(item)) && (
                    <span className="text-xs text-ink-soft tabular-nums">
                      {[item.arquivado ? arquivadoLabel : '', detalhe(item)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 text-ink-faint" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="secondary" onClick={() => onEdit(null)}>
          <Plus /> {novo}
        </Button>
      </div>
    </div>
  )
}

function useEditing<T>(): {
  editing: T | null | undefined
  shown: T | null | undefined
  open: (item: T | null) => void
  close: () => void
} {
  const [editing, setEditing] = useState<T | null | undefined>(undefined)
  const [shown, setShown] = useState(editing)
  if (editing !== undefined && editing !== shown) setShown(editing)
  return { editing, shown, open: setEditing, close: () => setEditing(undefined) }
}

const detalheTipo = (t: TipoAtendimento): string =>
  `${CATEGORIA_LABELS[t.categoria]} · ${t.duracao} min`

export function TiposSection(): React.JSX.Element {
  const tipos = useQuery(tiposQuery())
  const { editing, shown, open, close } = useEditing<TipoAtendimento>()
  return (
    <FormSection
      id="tipos"
      title="Tipos de atendimento"
      description="Sessão, avaliação e exame. A categoria define as regras: só sessão conta na frequência e usa pacote."
    >
      <Lista
        items={tipos.data ?? []}
        detalhe={detalheTipo}
        vazio="Nenhum tipo ainda."
        novo="Novo tipo"
        arquivadoLabel="Arquivado"
        erro={tipos.error?.message}
        onEdit={open}
      />
      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && close()}
        title={shown ? `Tipo · ${shown.nome}` : 'Novo tipo'}
      >
        {editing !== undefined && (
          <TipoForm key={editing?.id ?? 'novo'} tipo={editing} onClose={close} />
        )}
      </Dialog>
    </FormSection>
  )
}

const CATEGORIA_OPTIONS = CATEGORIAS.map((c) => [c, CATEGORIA_LABELS[c]]) as [Categoria, string][]

const COR_PADRAO: Record<Categoria, Cor> = {
  sessao: 'grafite',
  avaliacao: 'azul',
  exame: 'violeta'
}

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const next: Record<string, string> = {}
  for (const issue of error.issues) next[String(issue.path[0])] ??= issue.message
  return next
}

function Rodape({
  arquivado,
  arquivando,
  salvando,
  onArquivar,
  onClose
}: {
  arquivado: boolean | null
  arquivando: boolean
  salvando: boolean
  onArquivar: () => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <DialogFooter>
      {arquivado === null ? (
        <span />
      ) : (
        <Button variant="ghost" loading={arquivando} onClick={onArquivar}>
          {arquivado ? 'Reativar' : 'Arquivar'}
        </Button>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={salvando}>
          Salvar
        </Button>
      </div>
    </DialogFooter>
  )
}

function TipoForm({
  tipo,
  onClose
}: {
  tipo: TipoAtendimento | null
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const [nome, setNome] = useState(tipo?.nome ?? '')
  const [categoria, setCategoria] = useState<Categoria>(tipo?.categoria ?? 'exame')
  const [cor, setCor] = useState<Cor>(tipo?.cor ?? COR_PADRAO[tipo?.categoria ?? 'exame'])
  const [duracao, setDuracao] = useState(tipo?.duracao ?? 60)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: (input: Parameters<typeof window.api.tipos.save>[1]) =>
      window.api.tipos.save(tipo?.id ?? null, input),
    onSuccess: (saved) => {
      toast({ title: 'Tipo salvo', description: saved.nome })
      onClose()
    }
  })
  const archive = useMutation({
    mutationFn: () => window.api.tipos.archive(tipo!.id, !tipo!.arquivado),
    onSuccess: (saved) => {
      toast({ title: saved.arquivado ? 'Arquivado' : 'Reativado', description: saved.nome })
      onClose()
    }
  })
  const duracoes = [...new Set([...DURACOES, duracao])].sort((a, b) => a - b)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const parsed = tipoInputSchema.safeParse({ nome, categoria, cor, duracao })
        if (!parsed.success) return setErrors(issues(parsed.error))
        setErrors({})
        save.mutate(parsed.data)
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        <Field label="Nome" error={errors.nome}>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-invalid={Boolean(errors.nome) || undefined}
            placeholder="Audiometria"
            autoFocus
          />
        </Field>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="flex flex-col gap-1">
            <span aria-hidden="true" className="text-xs font-medium text-ink">
              Categoria
            </span>
            {tipo ? (
              <span className="flex h-8 items-center text-[13px] text-ink-soft">
                {CATEGORIA_LABELS[tipo.categoria]}
              </span>
            ) : (
              <Segmented
                label="Categoria"
                value={categoria}
                options={CATEGORIA_OPTIONS}
                onChange={(c) => {
                  setCategoria(c)
                  setCor(COR_PADRAO[c])
                }}
              />
            )}
          </div>
          <Field label="Duração padrão" htmlFor={`${ids}-duracao`} className="w-36">
            <Select
              id={`${ids}-duracao`}
              value={String(duracao)}
              onValueChange={(v) => setDuracao(Number(v))}
              options={duracoes.map((d) => ({ value: String(d), label: `${d} min` }))}
            />
          </Field>
        </div>
        {!tipo && (
          <p className="-mt-2 text-xs text-ink-soft">
            A categoria não muda depois: avaliação e exame não usam pacote nem contam na frequência.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-xs font-medium text-ink">
            Cor
          </span>
          <CorEscolha label="Cor" value={cor} onChange={setCor} />
        </div>
        {(save.error ?? archive.error) && (
          <ErrorText>{(save.error ?? archive.error)!.message}</ErrorText>
        )}
      </DialogBody>
      <Rodape
        arquivado={tipo ? tipo.arquivado : null}
        arquivando={archive.isPending}
        salvando={save.isPending}
        onArquivar={() => archive.mutate()}
        onClose={onClose}
      />
    </form>
  )
}

export function EtiquetasSection(): React.JSX.Element {
  const etiquetas = useQuery(etiquetasQuery())
  const { editing, shown, open, close } = useEditing<Etiqueta>()
  return (
    <FormSection
      id="etiquetas"
      title="Etiquetas"
      description="Marcas livres para os agendamentos, como convênio ou primeira vez. A agenda filtra por elas."
    >
      <Lista
        items={etiquetas.data ?? []}
        detalhe={() => ''}
        vazio="Nenhuma etiqueta ainda."
        novo="Nova etiqueta"
        arquivadoLabel="Arquivada"
        erro={etiquetas.error?.message}
        onEdit={open}
      />
      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && close()}
        title={shown ? `Etiqueta · ${shown.nome}` : 'Nova etiqueta'}
      >
        {editing !== undefined && (
          <EtiquetaForm key={editing?.id ?? 'nova'} etiqueta={editing} onClose={close} />
        )}
      </Dialog>
    </FormSection>
  )
}

function EtiquetaForm({
  etiqueta,
  onClose
}: {
  etiqueta: Etiqueta | null
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const [nome, setNome] = useState(etiqueta?.nome ?? '')
  const [cor, setCor] = useState<Cor>(etiqueta?.cor ?? 'ardosia')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: (input: Parameters<typeof window.api.etiquetas.save>[1]) =>
      window.api.etiquetas.save(etiqueta?.id ?? null, input),
    onSuccess: (saved) => {
      toast({ title: 'Etiqueta salva', description: saved.nome })
      onClose()
    }
  })
  const archive = useMutation({
    mutationFn: () => window.api.etiquetas.archive(etiqueta!.id, !etiqueta!.arquivado),
    onSuccess: (saved) => {
      toast({ title: saved.arquivado ? 'Arquivada' : 'Reativada', description: saved.nome })
      onClose()
    }
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const parsed = etiquetaInputSchema.safeParse({ nome, cor })
        if (!parsed.success) return setErrors(issues(parsed.error))
        setErrors({})
        save.mutate(parsed.data)
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-4">
        <Field label="Nome" error={errors.nome}>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-invalid={Boolean(errors.nome) || undefined}
            placeholder="Convênio"
            autoFocus
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-xs font-medium text-ink">
            Cor
          </span>
          <CorEscolha label="Cor" value={cor} onChange={setCor} />
        </div>
        {(save.error ?? archive.error) && (
          <ErrorText>{(save.error ?? archive.error)!.message}</ErrorText>
        )}
      </DialogBody>
      <Rodape
        arquivado={etiqueta ? etiqueta.arquivado : null}
        arquivando={archive.isPending}
        salvando={save.isPending}
        onArquivar={() => archive.mutate()}
        onClose={onClose}
      />
    </form>
  )
}
