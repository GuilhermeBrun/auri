import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import {
  CATEGORIA_LABELS,
  CATEGORIAS,
  COR_PADRAO,
  DURACOES,
  tipoInputSchema,
  type CategoriaEtiqueta,
  type TipoAtendimento
} from '@shared/tipos'
import { Button } from '@renderer/components/ui/button'
import { CorEscolha, CorPonto } from '@renderer/components/ui/cor'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input } from '@renderer/components/ui/input'
import { ErrorText, FormSection } from '@renderer/components/ui/section'
import { Select } from '@renderer/components/ui/select'
import { tiposQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'

const GRUPOS: Record<CategoriaEtiqueta, string> = {
  sessao: 'Sessões',
  avaliacao: 'Avaliações',
  exame: 'Exames',
  compromisso: 'Compromissos',
  marca: 'Marcas'
}

function Linha({
  item,
  onEdit
}: {
  item: TipoAtendimento
  onEdit: (item: TipoAtendimento) => void
}): React.JSX.Element {
  const detalhe = [item.arquivado ? 'Arquivada' : '', item.duracao ? `${item.duracao} min` : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-left transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        <CorPonto cor={item.cor} className={item.arquivado ? 'opacity-40' : undefined} />
        <span
          className={
            item.arquivado
              ? 'min-w-0 flex-1 truncate text-[13px] text-ink-soft'
              : 'min-w-0 flex-1 truncate text-[13px] font-medium'
          }
        >
          {item.nome}
        </span>
        {detalhe && <span className="text-xs text-ink-soft tabular-nums">{detalhe}</span>}
        <ChevronRight className="size-4 text-ink-faint" aria-hidden />
      </button>
    </li>
  )
}

export function EtiquetasSection(): React.JSX.Element {
  const tipos = useQuery(tiposQuery())
  const [editing, setEditing] = useState<TipoAtendimento | null | undefined>(undefined)
  const [shown, setShown] = useState(editing)
  if (editing !== undefined && editing !== shown) setShown(editing)
  const close = (): void => setEditing(undefined)
  const lista = tipos.data ?? []
  return (
    <FormSection id="etiquetas" title="Etiquetas">
      <div className="col-span-6 flex flex-col gap-5">
        {tipos.error && <p className="text-xs text-danger">{tipos.error.message}</p>}
        {CATEGORIAS.map((categoria) => {
          const itens = lista.filter((t) => t.categoria === categoria)
          if (itens.length === 0) return null
          return (
            <div key={categoria} className="flex flex-col gap-1">
              <h3 id={`etiquetas-${categoria}`} className="text-xs font-medium text-ink-soft">
                {GRUPOS[categoria]}
              </h3>
              <ul aria-labelledby={`etiquetas-${categoria}`} className="-mx-3 flex flex-col">
                {itens.map((item) => (
                  <Linha key={item.id} item={item} onEdit={setEditing} />
                ))}
              </ul>
            </div>
          )
        })}
        <div>
          <Button variant="secondary" onClick={() => setEditing(null)}>
            <Plus /> Nova etiqueta
          </Button>
        </div>
      </div>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && close()}
        title={shown ? shown.nome : 'Nova etiqueta'}
      >
        {editing !== undefined && (
          <EtiquetaForm key={editing?.id ?? 'nova'} etiqueta={editing} onClose={close} />
        )}
      </Dialog>
    </FormSection>
  )
}

const CATEGORIA_OPTIONS = CATEGORIAS.map((c) => ({ value: c, label: CATEGORIA_LABELS[c] }))

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const next: Record<string, string> = {}
  for (const issue of error.issues) next[String(issue.path[0])] ??= issue.message
  return next
}

function EtiquetaForm({
  etiqueta,
  onClose
}: {
  etiqueta: TipoAtendimento | null
  onClose: () => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const [nome, setNome] = useState(etiqueta?.nome ?? '')
  const [categoria, setCategoria] = useState<CategoriaEtiqueta>(etiqueta?.categoria ?? 'marca')
  const [cor, setCor] = useState(etiqueta?.cor ?? COR_PADRAO.marca)
  const [corEscolhida, setCorEscolhida] = useState(etiqueta !== null)
  const [duracao, setDuracao] = useState(etiqueta?.duracao ?? 60)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: (input: Parameters<typeof window.api.tipos.save>[1]) =>
      window.api.tipos.save(etiqueta?.id ?? null, input),
    onSuccess: (saved) => {
      toast({ title: 'Etiqueta salva', description: saved.nome })
      onClose()
    }
  })
  const archive = useMutation({
    mutationFn: () => window.api.tipos.archive(etiqueta!.id, !etiqueta!.arquivado),
    onSuccess: (saved) => {
      toast({ title: saved.arquivado ? 'Arquivada' : 'Reativada', description: saved.nome })
      onClose()
    }
  })
  const duracoes = [...new Set([...DURACOES, duracao])].sort((a, b) => a - b)
  const reserva = etiqueta?.sistema === 'reserva'
  const erro = (save.error ?? archive.error)?.message
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const parsed = tipoInputSchema.safeParse({
          nome,
          categoria,
          cor,
          duracao: categoria === 'marca' ? null : duracao
        })
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
        <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
          <Field
            label="Categoria"
            htmlFor={reserva ? undefined : `${ids}-categoria`}
            as="group"
            className="w-44"
          >
            {reserva ? (
              <span className="flex h-9 items-center text-[13px] text-ink-soft">
                {CATEGORIA_LABELS.compromisso}
              </span>
            ) : (
              <Select
                id={`${ids}-categoria`}
                value={categoria}
                onValueChange={(v) => {
                  const nova = v as CategoriaEtiqueta
                  setCategoria(nova)
                  if (!corEscolhida) setCor(COR_PADRAO[nova])
                }}
                options={CATEGORIA_OPTIONS}
              />
            )}
          </Field>
          {categoria !== 'marca' && (
            <Field label="Duração padrão" htmlFor={`${ids}-duracao`} className="w-36">
              <Select
                id={`${ids}-duracao`}
                value={String(duracao)}
                onValueChange={(v) => setDuracao(Number(v))}
                options={duracoes.map((d) => ({ value: String(d), label: `${d} min` }))}
              />
            </Field>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-xs font-medium text-ink">
            Cor
          </span>
          <CorEscolha
            label="Cor"
            value={cor}
            onChange={(c) => {
              setCor(c)
              setCorEscolhida(true)
            }}
          />
        </div>
        {erro && <ErrorText>{erro}</ErrorText>}
      </DialogBody>
      <DialogFooter>
        {etiqueta === null ? (
          <span />
        ) : (
          <Button variant="ghost" loading={archive.isPending} onClick={() => archive.mutate()}>
            {etiqueta.arquivado ? 'Reativar' : 'Arquivar'}
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
