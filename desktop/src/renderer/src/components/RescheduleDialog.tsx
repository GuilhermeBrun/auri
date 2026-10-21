import { useMutation, useQuery } from '@tanstack/react-query'
import { addDays, differenceInMinutes } from 'date-fns'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { parseIsoLocalDateTime, toIsoDate } from '@shared/dates'
import { periodoDe, type Intervalo } from '@shared/encaixe'
import { shortName } from '@shared/names'
import type { Appointment } from '@shared/schemas'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { useComputador } from '@renderer/lib/finance'
import { sugestoesQuery } from '@renderer/lib/queries'
import { useToast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { horarioTexto } from '@renderer/lib/waitlist'

export const REMARCAR_DIAS = 21

type Props = {
  appointment: Appointment
  open: boolean
  onOpenChange: (open: boolean) => void
  onMoved: (appointment: Appointment) => void
}

export function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
  onMoved
}: Props): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Remarcar"
      description={`${appointment.patient_nome} · ${horarioTexto(appointment)}`}
    >
      {open && <RescheduleBody appointment={appointment} onMoved={onMoved} />}
    </Dialog>
  )
}

function RescheduleBody({
  appointment,
  onMoved
}: {
  appointment: Appointment
  onMoved: (appointment: Appointment) => void
}): React.JSX.Element {
  const toast = useToast()
  const [now] = useState(() => new Date())
  const [offset, setOffset] = useState(0)
  const [chosen, setChosen] = useState<Intervalo | null>(null)
  const inicio = parseIsoLocalDateTime(appointment.inicio)
  const duracao = differenceInMinutes(parseIsoLocalDateTime(appointment.fim), inicio)
  const de = addDays(now, offset)
  const sugestoes = useQuery(
    sugestoesQuery({
      patient_id: appointment.patient_id,
      duracao,
      periodos: [periodoDe(inicio.getHours() * 60 + inicio.getMinutes())],
      de: toIsoDate(de),
      ate: toIsoDate(addDays(de, REMARCAR_DIAS - 1)),
      ignorar_appointment_id: appointment.id
    })
  )

  const computador = useComputador()
  const move = useMutation({
    mutationFn: (slot: Intervalo) =>
      window.api.appointments.move(appointment.id, slot, appointment.updated_at, computador),
    onSuccess: (moved) => {
      toast({
        title: 'Sessão remarcada',
        description: `${shortName(moved.patient_nome)} · ${horarioTexto(moved)}`
      })
      onMoved(moved)
    }
  })

  const lista = (sugestoes.data ?? [])
    .filter((s) => s.inicio !== appointment.inicio)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (chosen) move.mutate({ inicio: chosen.inicio, fim: chosen.fim })
      }}
      noValidate
    >
      <DialogBody className="flex flex-col gap-3">
        <p className="text-xs text-ink-soft">Horários livres de {duracao} min.</p>
        {sugestoes.error ? (
          <Callout tone="danger" title="Não foi possível procurar horários">
            {sugestoes.error.message}
          </Callout>
        ) : !sugestoes.data ? (
          <p className="py-6 text-center text-xs text-ink-faint">Procurando…</p>
        ) : lista.length === 0 ? (
          <p className="animate-fade-in py-6 text-center text-[13px] text-ink-soft">
            Nenhum horário livre nas próximas três semanas.
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Horários livres"
            className="-mx-2 flex animate-fade-in flex-col"
          >
            {lista.map((s) => {
              const selected = chosen?.inicio === s.inicio
              return (
                <button
                  key={s.inicio}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setChosen(s)}
                  className={cn(
                    'flex h-8 items-center justify-between gap-3 rounded-control px-2 text-left text-[13px] tabular-nums transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent pointer-coarse:h-11',
                    selected && 'bg-fill-hover hover:bg-fill-hover'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {horarioTexto(s)}
                    {!s.preferida && <span className="text-xs text-ink-faint">outro período</span>}
                  </span>
                  {selected && <Check className="size-4 stroke-[2]" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}
        {move.error && (
          <Callout tone="danger" title="Não foi possível remarcar">
            {move.error.message}
          </Callout>
        )}
      </DialogBody>
      <DialogFooter>
        <Button
          variant="ghost"
          className="-ml-3.5"
          onClick={() => {
            setChosen(null)
            setOffset(offset + REMARCAR_DIAS)
          }}
        >
          Mais adiante
        </Button>
        <Button type="submit" disabled={!chosen} loading={move.isPending}>
          Remarcar
        </Button>
      </DialogFooter>
    </form>
  )
}
