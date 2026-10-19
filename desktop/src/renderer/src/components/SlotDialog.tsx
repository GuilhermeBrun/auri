import { useState } from 'react'
import type { Appointment } from '@shared/schemas'
import { AppointmentForm } from '@renderer/components/AppointmentDialog'
import { CommitmentForm } from '@renderer/components/CommitmentDialog'
import { Dialog } from '@renderer/components/ui/dialog'
import { Segmented } from '@renderer/components/ui/segmented'

export type SlotDraft = { inicio: Date; duracao: number }

type Kind = 'paciente' | 'compromisso'

const KIND_OPTIONS: [Kind, string][] = [
  ['paciente', 'Paciente'],
  ['compromisso', 'Compromisso']
]

type Props = {
  slot: SlotDraft | null
  onClose: () => void
  onSaved?: (appointment: Appointment) => void
}

export function SlotDialog({ slot, onClose, onSaved }: Props): React.JSX.Element {
  const [shown, setShown] = useState({ slot, opening: 0 })
  const [kind, setKind] = useState<Kind>('paciente')
  if (slot && slot !== shown.slot) {
    setShown({ slot, opening: shown.opening + 1 })
    setKind('paciente')
  }
  const current = shown.slot
  return (
    <Dialog
      open={slot !== null}
      onOpenChange={(open) => !open && onClose()}
      title={kind === 'paciente' ? 'Novo agendamento' : 'Novo compromisso'}
    >
      {current && (
        <>
          <div className="px-5 pt-4">
            <Segmented
              label="O que marcar"
              value={kind}
              options={KIND_OPTIONS}
              onChange={setKind}
            />
          </div>
          {kind === 'paciente' ? (
            <AppointmentForm
              key={`p${shown.opening}`}
              draft={{ mode: 'create', ...current }}
              onClose={onClose}
              onSaved={onSaved}
            />
          ) : (
            <CommitmentForm
              key={`c${shown.opening}`}
              draft={{ mode: 'create', ...current }}
              onClose={onClose}
            />
          )}
        </>
      )}
    </Dialog>
  )
}
