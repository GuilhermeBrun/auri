import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarSearch, X } from 'lucide-react'
import type { Vaga } from '@shared/confirmacao'
import { shortName } from '@shared/names'
import { Button } from '@renderer/components/ui/button'
import { quandoCurto } from '@renderer/lib/confirmacoes'
import { useComputador } from '@renderer/lib/finance'

export function AvisosDaConfirmacao({
  onEncaixar
}: {
  onEncaixar: (vaga: Vaga) => void
}): React.JSX.Element | null {
  const avisos = useQuery({
    queryKey: ['appointments', 'confirmacoes', 'avisos'],
    queryFn: () => window.api.confirmacoes.avisos()
  })
  const dispensar = useMutation({
    mutationFn: ({ id, tipo }: { id: number; tipo: 'liberado' | 'outra' }) =>
      window.api.confirmacoes.dispensar(id, tipo)
  })
  const computador = useComputador()
  const aplicar = useMutation({
    mutationFn: (id: number) => window.api.confirmacoes.aplicarOutra(id, computador)
  })
  const { liberados = [], outras = [] } = avisos.data ?? {}
  if (liberados.length === 0 && outras.length === 0) return null

  const fechar = (id: number, tipo: 'liberado' | 'outra', quem: string) => (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Dispensar o aviso de ${quem}`}
      title="Dispensar"
      onClick={() => dispensar.mutate({ id, tipo })}
    >
      <X />
    </Button>
  )

  return (
    <section aria-label="Avisos da confirmação" className="flex flex-col gap-1 px-3 pt-2">
      {liberados.map((l) => {
        const quem = shortName(l.patient_nome)
        return (
          <div
            key={`l${l.request_id}`}
            className="flex animate-fade-in items-center gap-3 rounded-card bg-warning-soft py-1.5 pr-1.5 pl-4"
          >
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="font-medium">Horário livre {quandoCurto(l.inicio)}</span>
              <span className="text-ink-soft">
                {' · '}
                {l.motivo === 'sem_resposta'
                  ? `${quem} não respondeu à confirmação`
                  : `${quem} desmarcou pelo link`}
                {l.cobranca_erro
                  ? ` · falta não cobrada: ${l.cobranca_erro}`
                  : l.falta_cobrada && ' · falta cobrada'}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEncaixar({ inicio: l.inicio, fim: l.fim })}
            >
              <CalendarSearch /> Encaixar
            </Button>
            {fechar(l.request_id, 'liberado', quem)}
          </div>
        )
      })}
      {outras.map((o) => {
        const quem = shortName(o.patient_nome)
        return (
          <div
            key={`o${o.request_id}`}
            className="flex animate-fade-in items-center gap-3 rounded-card bg-fill py-1.5 pr-1.5 pl-4"
          >
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="font-medium">
                {o.vencido
                  ? `${quem} respondeu depois do vencimento`
                  : `${quem} mandou outra resposta`}
              </span>
              <span className="text-ink-soft">
                {o.vencido ? ' · quer ' : ' · agora quer '}
                {o.resposta === 'desmarcada' ? 'desmarcar' : 'confirmar'} a sessão de{' '}
                {quandoCurto(o.inicio)}
                {o.vencido && ' · confira a hora da mensagem no WhatsApp'}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              loading={aplicar.isPending && aplicar.variables === o.request_id}
              onClick={() => aplicar.mutate(o.request_id)}
            >
              {o.resposta === 'desmarcada' ? 'Desmarcar' : 'Confirmar'}
            </Button>
            {fechar(o.request_id, 'outra', quem)}
          </div>
        )
      })}
      {(aplicar.error || dispensar.error) && (
        <p className="px-4 text-xs text-danger">{(aplicar.error ?? dispensar.error)?.message}</p>
      )}
    </section>
  )
}
