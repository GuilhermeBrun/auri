import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { parseIsoLocalDateTime } from '@shared/dates'
import type { WaitlistEntry } from '@shared/waitlist'
import { AppointmentDialog, type AppointmentDraft } from '@renderer/components/AppointmentDialog'
import { Page } from '@renderer/components/Layout'
import { WaitlistPanel } from '@renderer/components/waitlist/WaitlistPanel'

export function WaitlistPage(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<AppointmentDraft | null>(null)
  const picked = useRef<WaitlistEntry | null>(null)

  return (
    <Page trail={[{ label: 'Lista de espera' }]}>
      <div className="mx-auto max-w-[560px] px-5 pt-6 pb-20">
        <WaitlistPanel
          onPick={(entry, horario) => {
            picked.current = entry
            setDraft({
              mode: 'create',
              inicio: parseIsoLocalDateTime(horario.inicio),
              duracao: entry.duracao,
              patient: { id: entry.patient_id, nome: entry.patient_nome },
              tipo_id: entry.tipo_id
            })
          }}
        />
      </div>
      <AppointmentDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={(appointment) => {
          const entry = picked.current
          if (!entry || appointment.patient_id !== entry.patient_id) return
          void window.api.waitlist
            .close(entry.id, { motivo: 'agendado', appointment_id: appointment.id })
            .then(() => queryClient.invalidateQueries({ queryKey: ['waitlist'] }))
        }}
      />
    </Page>
  )
}
