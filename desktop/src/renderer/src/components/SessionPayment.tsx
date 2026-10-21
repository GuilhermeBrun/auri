import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { formatBRL } from '@shared/money'
import type { Appointment } from '@shared/schemas'
import { PaymentDialog } from '@renderer/components/FinanceDialogs'
import { Button } from '@renderer/components/ui/button'
import { ErrorText } from '@renderer/components/ui/section'
import {
  SITUACAO_LABELS,
  sessionPay,
  useComputador,
  useRenewPackage,
  type SessionPay
} from '@renderer/lib/finance'
import { patientFinanceQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'

function detail(pay: SessionPay): string {
  if (pay.kind === 'pacote') return `${pay.nome} · sessão ${pay.numero} de ${pay.sessoes}`
  if (pay.kind === 'nenhum') return ''
  const falta =
    pay.motivo === 'falta_cobrada' ? 'Falta cobrada · ' : pay.fora ? 'Fora do pacote · ' : ''
  const valor = formatBRL(pay.valor_centavos)
  if (pay.convenio)
    return `${falta}${pay.convenio} · ${valor} · ${pay.situacao === 'pago' ? 'pago pelo convênio' : 'a receber do convênio'}`
  if (pay.situacao === 'parcial')
    return `${falta}${valor} · parcial, falta ${formatBRL(pay.valor_centavos - pay.pago_centavos)}`
  return `${falta}${valor} · ${SITUACAO_LABELS[pay.situacao].toLowerCase()}`
}

export function SessionPayment({
  appointment,
  onLeave
}: {
  appointment: Appointment
  onLeave: () => void
}): React.JSX.Element | null {
  const navigate = useNavigate()
  const toast = useToast()
  const computador = useComputador()
  const finance = useQuery(patientFinanceQuery(appointment.patient_id))
  const [paying, setPaying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const renew = useRenewPackage({ id: appointment.patient_id, nome: appointment.patient_nome })
  const charge = useMutation({
    mutationFn: () => window.api.finance.chargeAbsence(appointment.id, computador),
    onSuccess: () => {
      setConfirming(false)
      toast({ title: 'Sessão cobrada', description: appointment.patient_nome })
    }
  })
  const missed = appointment.presenca === 'falta' || appointment.presenca === 'desmarcou'
  if (!finance.data || (!missed && appointment.presenca !== 'presente')) return null

  const billing = finance.data.billing
  const pay = sessionPay(finance.data, appointment.id)
  const open = (): void => {
    onLeave()
    void navigate(`/pacientes/${appointment.patient_id}/financeiro`)
  }
  const valorFalta = billing?.service?.valor_centavos ?? null
  const text =
    pay.kind !== 'nenhum'
      ? detail(pay)
      : !billing
        ? 'Paciente sem forma de cobrança.'
        : missed
          ? 'Falta não cobrada.'
          : 'Ainda não lançada.'
  const canPay = pay.kind === 'cobranca' && !pay.convenio && pay.situacao !== 'pago'
  const canCharge = pay.kind === 'nenhum' && missed && billing !== null && valorFalta !== null
  const renovacao = missed ? null : finance.data.renovacao

  return (
    <div className="flex flex-col gap-2 rounded-control bg-canvas px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-[13px] font-medium">Pagamento</span>
          <span className="text-xs text-ink-soft tabular-nums">{text}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {confirming ? (
            <span className="flex animate-fade-in items-center gap-2">
              <span className="text-xs text-ink-soft">Cobrar {formatBRL(valorFalta ?? 0)}?</span>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} autoFocus>
                Cancelar
              </Button>
              <Button size="sm" loading={charge.isPending} onClick={() => charge.mutate()}>
                Cobrar
              </Button>
            </span>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={open}>
                Abrir financeiro
              </Button>
              {canPay && (
                <Button variant="secondary" size="sm" onClick={() => setPaying(true)}>
                  Registrar pagamento
                </Button>
              )}
              {renovacao && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={renew.isPending}
                  onClick={() => renew.mutate(renovacao)}
                >
                  Renovar pacote
                </Button>
              )}
              {canCharge && (
                <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
                  Cobrar sessão
                </Button>
              )}
            </>
          )}
        </span>
      </div>
      {(charge.error ?? renew.error) && (
        <ErrorText className="mt-0">{(charge.error ?? renew.error)?.message}</ErrorText>
      )}
      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        patient={{ id: appointment.patient_id, nome: appointment.patient_nome }}
      />
    </div>
  )
}
