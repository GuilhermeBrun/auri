import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { PenLine, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useId, useState } from 'react'
import { parseIsoLocalDateTime } from '@shared/dates'
import { shortName } from '@shared/names'
import { pessoasDaFicha, responsavelDe, type Pessoa } from '@shared/responsavel'
import type { Appointment } from '@shared/schemas'
import { SignaturePad, type SignatureValue } from '@renderer/components/SignaturePad'
import { Button } from '@renderer/components/ui/button'
import { ChoiceButton } from '@renderer/components/ui/choice-button'
import { Callout } from '@renderer/components/ui/callout'
import { Field, Input } from '@renderer/components/ui/input'
import { useConnection } from '@renderer/lib/connection'
import { patientQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'
import { paraBase64url } from '../../../../../web/contrato/assinatura/base64url'

const OUTRA = 'outra'

type Escolha = { key: string; pessoa: Pessoa | null }

function chave(pessoa: Pessoa): string {
  return pessoa.papel
}

export function ArrivalSignature({
  appointment,
  open,
  onOpenChange,
  onSigned
}: {
  appointment: Appointment
  open: boolean
  onOpenChange: (open: boolean) => void
  onSigned: (appointment: Appointment) => void
}): React.JSX.Element {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).focus()
          }}
          className="fixed inset-0 z-[70] flex flex-col bg-surface focus:outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        >
          {open && (
            <ArrivalForm
              appointment={appointment}
              onCancel={() => onOpenChange(false)}
              onSigned={onSigned}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ArrivalForm({
  appointment,
  onCancel,
  onSigned
}: {
  appointment: Appointment
  onCancel: () => void
  onSigned: (appointment: Appointment) => void
}): React.JSX.Element {
  const ids = useId()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { info } = useConnection()
  const patient = useQuery(patientQuery(appointment.patient_id))
  const pessoas = patient.data ? pessoasDaFicha(patient.data) : []
  const padrao = patient.data ? responsavelDe(patient.data).pessoa : null
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const atual: Escolha =
    escolhida === OUTRA
      ? { key: OUTRA, pessoa: null }
      : (() => {
          const pessoa = pessoas.find((p) => chave(p) === escolhida) ?? padrao ?? pessoas[0] ?? null
          return pessoa ? { key: chave(pessoa), pessoa } : { key: OUTRA, pessoa: null }
        })()
  const [outraNome, setOutraNome] = useState('')
  const [outraParentesco, setOutraParentesco] = useState('')
  const [assinatura, setAssinatura] = useState<SignatureValue | null>(null)

  const inicio = parseIsoLocalDateTime(appointment.inicio)
  const fim = parseIsoLocalDateTime(appointment.fim)
  const quem = atual.pessoa?.nome ?? outraNome.trim()
  const parentesco = atual.pessoa?.parentesco ?? outraParentesco.trim()
  const pronto = quem !== '' && parentesco !== '' && assinatura !== null && !assinatura.minimal

  const sign = useMutation({
    mutationFn: () =>
      window.api.attendance.sign(
        appointment.id,
        {
          signer_nome: quem,
          signer_papel: atual.pessoa?.papel ?? 'outro',
          signer_parentesco: parentesco,
          traco: paraBase64url(assinatura!.encoded)
        },
        info?.name || 'Este computador'
      ),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast({
        title: 'Chegada assinada',
        description: `${shortName(saved.patient_nome)} · ${quem} (${parentesco.toLowerCase()})`
      })
      onSigned(saved)
    }
  })

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (pronto) sign.mutate()
      }}
    >
      <header className="flex items-start justify-between gap-6 px-10 pt-9">
        <div>
          <p className="text-[13px] text-ink-soft">Assinatura de chegada</p>
          <DialogPrimitive.Title className="mt-1 text-[26px] font-semibold tracking-tight">
            {appointment.patient_nome}
          </DialogPrimitive.Title>
          <p className="mt-1 text-[15px] text-ink-soft tabular-nums">
            Hoje, {format(inicio, 'HH:mm')}–{format(fim, 'HH:mm')}
            {` · ${appointment.tipo_nome}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Cancelar" onClick={onCancel}>
          <X />
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-[900px] min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-10 py-8">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-[15px] font-semibold tracking-tight">
            Quem está assinando
          </legend>
          <div className="flex flex-wrap gap-2">
            {pessoas.map((p) => (
              <ChoiceButton
                key={chave(p)}
                pressed={atual.key === chave(p)}
                onClick={() => setEscolhida(chave(p))}
              >
                <span className="font-medium">{p.nome}</span>
                <span className="text-ink-soft">{p.parentesco}</span>
              </ChoiceButton>
            ))}
            <ChoiceButton pressed={atual.key === OUTRA} onClick={() => setEscolhida(OUTRA)}>
              <span className="font-medium">Outra pessoa</span>
            </ChoiceButton>
          </div>
          {atual.key === OUTRA && (
            <div className="grid grid-cols-[2fr_1fr] gap-3 animate-fade-in">
              <Field label="Nome de quem assina" htmlFor={`${ids}-nome`}>
                <Input
                  id={`${ids}-nome`}
                  value={outraNome}
                  onChange={(e) => setOutraNome(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Parentesco" htmlFor={`${ids}-parentesco`}>
                <Input
                  id={`${ids}-parentesco`}
                  value={outraParentesco}
                  onChange={(e) => setOutraParentesco(e.target.value)}
                  placeholder="Avó, tia, motorista…"
                />
              </Field>
            </div>
          )}
        </fieldset>

        <section className="flex flex-col gap-2" aria-labelledby={`${ids}-assine`}>
          <h2 id={`${ids}-assine`} className="text-[15px] font-semibold tracking-tight">
            Assinatura
          </h2>
          <SignaturePad onChange={setAssinatura} />
          <p className="text-[13px] text-ink-soft">
            {quem
              ? `Ao assinar, ${quem} confirma que ${shortName(appointment.patient_nome)} chegou para a sessão de hoje.`
              : `Ao assinar, a pessoa confirma que ${shortName(appointment.patient_nome)} chegou para a sessão de hoje.`}
          </p>
        </section>

        {sign.error && (
          <Callout tone="danger" title="Não foi possível guardar a assinatura">
            {sign.error.message}
          </Callout>
        )}
      </div>

      <footer className="flex items-center justify-end gap-2 px-10 pt-2 pb-8">
        <Button variant="secondary" size="lg" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={!pronto} loading={sign.isPending}>
          <PenLine /> Confirmar chegada
        </Button>
      </footer>
    </form>
  )
}
