import { Copy, Send } from 'lucide-react'
import { PEDIDO_LABELS, type PedidoNaSessao } from '@shared/confirmacao'
import type { Appointment } from '@shared/schemas'
import { Button } from '@renderer/components/ui/button'
import { horaDe } from '@renderer/lib/confirmacoes'
import { useEnviarConfirmacao, type Via } from './useEnviar'

export function ConfirmacaoDaSessao({
  appointment
}: {
  appointment: Appointment
}): React.JSX.Element | null {
  const enviar = useEnviarConfirmacao()
  const pedido: PedidoNaSessao | null = enviar.data
    ? { estado: 'aguardando', prazo: enviar.data.envio.prazo }
    : appointment.pedido
  if (appointment.presenca !== '' && !pedido) return null
  if (appointment.confirmado_em !== null && pedido?.estado !== 'confirmado') return null
  const aguardando = pedido?.estado === 'aguardando'
  const descricao = aguardando
    ? `Prazo até as ${horaDe(pedido.prazo)}. Sem resposta, a falta é cobrada.`
    : pedido
      ? PEDIDO_LABELS[pedido.estado]
      : 'A família tem 2 horas para responder.'
  const botao = (via: Via) => (
    <Button
      variant={via === 'whatsapp' ? 'secondary' : 'ghost'}
      size={via === 'whatsapp' ? 'md' : 'icon'}
      aria-label={via === 'copiar' ? 'Copiar mensagem' : undefined}
      title={via === 'copiar' ? 'Copiar mensagem' : undefined}
      loading={enviar.isPending && enviar.variables?.via === via}
      onClick={() => enviar.mutate({ appointmentId: appointment.id, via })}
    >
      {via === 'copiar' ? (
        <Copy />
      ) : (
        <>
          <Send /> {aguardando ? 'Reenviar' : 'Pedir confirmação'}
        </>
      )}
    </Button>
  )
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 rounded-control bg-canvas px-3 py-2.5">
        <span className="flex flex-col">
          <span className="text-[13px] font-medium">
            {aguardando ? PEDIDO_LABELS.aguardando : 'Confirmação pelo celular'}
          </span>
          <span className="text-xs text-ink-soft">{descricao}</span>
        </span>
        {(aguardando || !pedido) && (
          <span className="flex shrink-0 items-center gap-1">
            {botao('copiar')}
            {botao('whatsapp')}
          </span>
        )}
      </div>
      {enviar.error && <p className="text-xs text-danger">{enviar.error.message}</p>}
    </div>
  )
}
