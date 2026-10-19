import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarSearch } from 'lucide-react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import type { ConfirmacaoRecebida } from '@shared/confirmacao'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Textarea } from '@renderer/components/ui/input'
import { fecharResposta, pedirEncaixe, useRecebendo } from '@renderer/lib/confirmacoes'
import { useComputador } from '@renderer/lib/finance'

export function ReceberConfirmacao(): React.JSX.Element {
  const recebendo = useRecebendo()
  return (
    <Dialog
      open={recebendo !== null}
      onOpenChange={(open) => !open && fecharResposta()}
      title="Resposta da confirmação"
      description="A resposta entra na agenda assim que chega."
    >
      {recebendo && <Receber key={recebendo.id} inicial={recebendo.texto} />}
    </Dialog>
  )
}

function Receber({ inicial }: { inicial: string }): React.JSX.Element {
  const [texto, setTexto] = useState(inicial)
  const [enviado, setEnviado] = useState(inicial)
  return enviado ? (
    <Aplicada texto={enviado} onOutra={inicial ? undefined : () => setEnviado('')} />
  ) : (
    <Colar texto={texto} onChange={setTexto} onSubmit={() => setEnviado(texto.trim())} />
  )
}

function Colar({
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
          rows={4}
          autoFocus
          placeholder="Cole aqui a mensagem inteira ou só o link."
        />
      </DialogBody>
      <DialogFooter>
        <span />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fecharResposta}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!texto.trim()}>
            Aplicar
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

function Aplicada({ texto, onOutra }: { texto: string; onOutra?: () => void }) {
  const computador = useComputador()
  const navigate = useNavigate()
  const recebida = useQuery({
    queryKey: ['confirmacao-recebida', texto],
    queryFn: () => window.api.confirmacoes.receber(texto, computador),
    staleTime: Infinity,
    gcTime: 0
  })
  const outra = useMutation({
    mutationFn: (requestId: number) => window.api.confirmacoes.aplicarOutra(requestId, computador)
  })
  const resultado: ConfirmacaoRecebida | undefined = outra.data ?? recebida.data

  const rodape = (acao?: React.ReactNode): React.JSX.Element => (
    <DialogFooter>
      {onOutra ? (
        <Button variant="ghost" onClick={onOutra}>
          Colar outra
        </Button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button variant={acao ? 'secondary' : 'primary'} onClick={fecharResposta}>
          Fechar
        </Button>
        {acao}
      </div>
    </DialogFooter>
  )

  if (recebida.error || (resultado && !resultado.ok)) {
    return (
      <>
        <DialogBody>
          <Callout tone="danger" title="Esta resposta não mudou a agenda">
            {resultado && !resultado.ok ? resultado.erro : recebida.error?.message}
          </Callout>
        </DialogBody>
        {rodape()}
      </>
    )
  }
  if (!resultado)
    return <DialogBody className="py-10 text-center text-ink-soft">Aplicando…</DialogBody>

  const encaixar = resultado.vaga
  const pendente = resultado.tipo === 'outra' || resultado.tipo === 'conferir'
  const acao =
    pendente && !outra.data ? (
      <Button loading={outra.isPending} onClick={() => outra.mutate(resultado.request_id)}>
        {resultado.resposta === 'desmarcada' ? 'Desmarcar a sessão' : 'Confirmar a sessão'}
      </Button>
    ) : encaixar ? (
      <Button
        onClick={() => {
          pedirEncaixe(encaixar)
          fecharResposta()
          void navigate('/agenda')
        }}
      >
        <CalendarSearch /> Encaixar
      </Button>
    ) : undefined

  return (
    <>
      <DialogBody className="flex flex-col gap-2">
        <Callout tone={pendente ? 'warning' : 'neutral'} title={resultado.titulo}>
          {resultado.detalhe}
        </Callout>
        {outra.error && <p className="text-xs text-danger">{outra.error.message}</p>}
      </DialogBody>
      {rodape(acao)}
    </>
  )
}
