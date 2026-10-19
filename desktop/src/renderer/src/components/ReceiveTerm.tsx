import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FileText, ShieldCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { formatCpf } from '@shared/masks'
import { shortName } from '@shared/names'
import type { TermCheck } from '@shared/schemas'
import { SignatureImage } from '@renderer/components/SignatureImage'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Textarea } from '@renderer/components/ui/input'
import { Sensitive } from '@renderer/components/ui/sensitive'
import { useConnection } from '@renderer/lib/connection'
import { closeReceive, phoneOf, signedLocal, useReceiving } from '@renderer/lib/terms'
import { useToast } from '@renderer/lib/toast'

export function ReceiveTerm(): React.JSX.Element {
  const receiving = useReceiving()
  return (
    <Dialog
      open={receiving !== null}
      onOpenChange={(open) => !open && closeReceive()}
      title="Termo assinado"
      description="Confira o que chegou antes de guardar na ficha."
    >
      {receiving && <Receive key={receiving.id} initial={receiving.texto} />}
    </Dialog>
  )
}

function Receive({ initial }: { initial: string }): React.JSX.Element {
  const [texto, setTexto] = useState(initial)
  const [conferido, setConferido] = useState(initial)
  return conferido ? (
    <Conference texto={conferido} onBack={initial ? undefined : () => setConferido('')} />
  ) : (
    <Paste texto={texto} onChange={setTexto} onSubmit={() => setConferido(texto.trim())} />
  )
}

function Paste({
  texto,
  onChange,
  onSubmit
}: {
  texto: string
  onChange: (texto: string) => void
  onSubmit: () => void
}): React.JSX.Element {
  const id = useId()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (texto.trim()) onSubmit()
      }}
    >
      <DialogBody className="flex flex-col gap-2">
        <label htmlFor={id} className="text-xs font-medium">
          Resposta que chegou pelo WhatsApp
        </label>
        <Textarea
          id={id}
          value={texto}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          autoFocus
          placeholder="Cole aqui a mensagem inteira ou só o link."
        />
      </DialogBody>
      <DialogFooter>
        <span />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={closeReceive}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!texto.trim()}>
            Conferir
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

function Conference({ texto, onBack }: { texto: string; onBack?: () => void }): React.JSX.Element {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { info } = useConnection()
  const check = useQuery({
    queryKey: ['terms', 'check', texto],
    queryFn: () => window.api.terms.check(texto),
    staleTime: Infinity,
    gcTime: 0
  })
  const accept = useMutation({
    mutationFn: () => window.api.terms.accept(texto, info?.name || 'Este computador'),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['terms'] })
      toast({
        title: 'Termo guardado',
        description: `${saved.titulo} · ${saved.assinado?.nome ?? ''}`
      })
      closeReceive()
    }
  })
  const pdf = useMutation({ mutationFn: (id: number) => window.api.terms.openPdf(id) })

  const footer = (primary: React.ReactNode): React.JSX.Element => (
    <DialogFooter>
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          Colar outra
        </Button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">{primary}</div>
    </DialogFooter>
  )

  if (check.error || (check.data && !check.data.ok)) {
    const failed = check.data as Extract<TermCheck, { ok: false }> | undefined
    return (
      <>
        <DialogBody>
          <Callout
            tone={failed?.guardado ? 'neutral' : 'danger'}
            title={failed?.guardado ? 'Já está na ficha' : 'Não dá para guardar esta resposta'}
          >
            {failed?.erro ?? check.error?.message}
          </Callout>
          {pdf.error && <p className="mt-2 text-xs text-danger">{pdf.error.message}</p>}
        </DialogBody>
        {footer(
          failed?.guardado ? (
            <Button loading={pdf.isPending} onClick={() => pdf.mutate(failed.guardado!)}>
              <FileText /> Abrir PDF
            </Button>
          ) : (
            <Button variant="secondary" onClick={closeReceive}>
              Fechar
            </Button>
          )
        )}
      </>
    )
  }

  if (!check.data)
    return <DialogBody className="py-10 text-center text-ink-soft">Conferindo…</DialogBody>

  const { request, resposta, avisos, traco, patient_nome } = check.data
  const assinado = signedLocal(resposta.assinado_em, resposta.fuso_minutos)
  return (
    <>
      <DialogBody className="flex flex-col gap-4">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">{request.titulo}</p>
          <p className="text-[13px] text-ink-soft">
            {shortName(patient_nome)} · versão {request.versao}
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-card bg-fill p-4">
          <SignatureImage
            traco={traco}
            label={`Assinatura de ${resposta.nome}`}
            className="h-24 w-full rounded-control bg-surface"
          />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-ink-soft">Nome</dt>
            <dd className="font-medium">{resposta.nome}</dd>
            <dt className="text-ink-soft">CPF</dt>
            <dd>
              <Sensitive label="CPF" what="o CPF">
                {formatCpf(resposta.cpf)}
              </Sensitive>
            </dd>
            <dt className="text-ink-soft">Parentesco</dt>
            <dd>{resposta.parentesco}</dd>
            <dt className="text-ink-soft">Assinou</dt>
            <dd className="tabular-nums">{format(assinado, "dd/MM/yyyy 'às' HH:mm")}</dd>
          </dl>
        </div>
        {avisos.length > 0 && (
          <Callout tone="warning" title="Confira antes de guardar">
            <ul className="flex flex-col gap-1">
              {avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          </Callout>
        )}
        <p className="flex items-start gap-2 text-xs text-ink-soft">
          <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
          Enviado para {phoneOf(request.destino_numero)}: confira se a resposta veio desse número.
        </p>
        {accept.error && <p className="text-xs text-danger">{accept.error.message}</p>}
      </DialogBody>
      {footer(
        <>
          <Button variant="secondary" onClick={closeReceive}>
            Recusar
          </Button>
          <Button loading={accept.isPending} onClick={() => accept.mutate()}>
            Guardar termo assinado
          </Button>
        </>
      )}
    </>
  )
}
