import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { Check, ClipboardPaste, Clock, Copy, Send } from 'lucide-react'
import type { ConfirmacaoLinha } from '@shared/confirmacao'
import { parseIsoDate, parseIsoLocalDateTime, formatTime } from '@shared/dates'
import { shortName } from '@shared/names'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { abrirResposta, horaDe } from '@renderer/lib/confirmacoes'
import { useEnviarConfirmacao, type Via } from './useEnviar'

const precisaEnviar = (s: ConfirmacaoLinha): boolean =>
  !s.confirmado && s.pedido === null && Boolean(s.contato?.celular)

export function ConfirmacoesDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const lista = useQuery({
    queryKey: ['appointments', 'confirmacoes', 'lista'],
    queryFn: () => window.api.confirmacoes.lista(),
    enabled: open
  })
  const dia = lista.data?.dia
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={
        dia
          ? `Confirmações de ${format(parseIsoDate(dia), 'EEEE, dd/MM', { locale: ptBR })}`
          : 'Confirmações'
      }
      description="2 horas para responder. Sem resposta, a falta é cobrada."
    >
      {open && (
        <Conteudo
          carregando={lista.isPending}
          erro={lista.error?.message ?? null}
          data={lista.data}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}

function Conteudo({
  carregando,
  erro,
  data,
  onClose
}: {
  carregando: boolean
  erro: string | null
  data: Awaited<ReturnType<typeof window.api.confirmacoes.lista>> | undefined
  onClose: () => void
}): React.JSX.Element {
  const enviar = useEnviarConfirmacao()
  const sessoes = data?.sessoes ?? []
  const aberta = data?.janela.aberta ?? false
  const faltam = sessoes.filter(precisaEnviar)
  const enviarUma = (appointmentId: number, via: Via): void => enviar.mutate({ appointmentId, via })
  const ocupada = (id: number, via: Via): boolean =>
    enviar.isPending && enviar.variables?.appointmentId === id && enviar.variables.via === via

  return (
    <>
      <DialogBody className="flex flex-col gap-3">
        {data && !data.janela.aberta && (
          <Callout tone="warning" title="Fora da janela de envio">
            {data.janela.motivo}
          </Callout>
        )}
        {carregando && <p className="py-8 text-center text-ink-soft">Carregando…</p>}
        {erro && (
          <Callout tone="danger" title="Não foi possível carregar as sessões">
            {erro}
          </Callout>
        )}
        {data && sessoes.length === 0 && (
          <p className="py-8 text-center text-[13px] text-ink-soft">
            {data.dia
              ? 'Nenhuma sessão marcada para esse dia.'
              : 'A clínica não abre nos próximos dias.'}
          </p>
        )}
        {sessoes.length > 0 && (
          <ul aria-label="Sessões" className="-mx-2 flex flex-col">
            {sessoes.map((s) => (
              <li
                key={s.appointment_id}
                className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-canvas"
              >
                <span className="w-11 shrink-0 text-[13px] font-medium tabular-nums">
                  {formatTime(parseIsoLocalDateTime(s.inicio))}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium">
                    {shortName(s.patient_nome)}
                  </span>
                  <span className="truncate text-xs text-ink-soft">
                    {s.contato
                      ? `${s.contato.nome.split(' ')[0]} (${s.contato.parentesco}) · ${s.contato.celular || 'sem celular na ficha'}`
                      : 'Sem contato principal na ficha'}
                  </span>
                </span>
                <Situacao sessao={s} aberta={aberta} ocupada={ocupada} onEnviar={enviarUma} />
              </li>
            ))}
          </ul>
        )}
        {enviar.error && <p className="text-xs text-danger">{enviar.error.message}</p>}
      </DialogBody>
      <DialogFooter>
        <Button
          variant="ghost"
          onClick={() => {
            onClose()
            abrirResposta()
          }}
        >
          <ClipboardPaste /> Colar resposta
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button
            disabled={!aberta || faltam.length === 0}
            loading={
              enviar.isPending && enviar.variables?.appointmentId === faltam[0]?.appointment_id
            }
            onClick={() => enviarUma(faltam[0].appointment_id, 'whatsapp')}
          >
            <Send />{' '}
            {faltam.length > 1 ? `Enviar a próxima (${faltam.length})` : 'Enviar a próxima'}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

function Situacao({
  sessao,
  aberta,
  ocupada,
  onEnviar
}: {
  sessao: ConfirmacaoLinha
  aberta: boolean
  ocupada: (id: number, via: Via) => boolean
  onEnviar: (id: number, via: Via) => void
}): React.JSX.Element {
  const id = sessao.appointment_id
  const { pedido } = sessao
  if (sessao.confirmado || pedido?.estado === 'confirmado') {
    return (
      <span className="flex items-center gap-1 text-xs text-ink-soft">
        <Check className="size-3.5" aria-hidden /> Confirmada
      </span>
    )
  }
  const botoes = (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copiar mensagem"
        title="Copiar mensagem"
        disabled={!aberta && !pedido}
        loading={ocupada(id, 'copiar')}
        onClick={() => onEnviar(id, 'copiar')}
      >
        <Copy />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={pedido ? 'Abrir de novo no WhatsApp' : 'Abrir no WhatsApp'}
        title={pedido ? 'Abrir de novo no WhatsApp' : 'Abrir no WhatsApp'}
        disabled={!aberta && !pedido}
        loading={ocupada(id, 'whatsapp')}
        onClick={() => onEnviar(id, 'whatsapp')}
      >
        <Send />
      </Button>
    </>
  )
  if (pedido?.estado === 'aguardando') {
    return (
      <span className="flex items-center gap-1">
        <span className="mr-1 flex items-center gap-1 text-xs text-ink-soft tabular-nums">
          <Clock className="size-3.5" aria-hidden /> até {horaDe(pedido.prazo)}
        </span>
        {botoes}
      </span>
    )
  }
  if (!sessao.contato?.celular) return <span className="text-xs text-ink-faint">Sem celular</span>
  return <span className="flex items-center gap-1">{botoes}</span>
}
