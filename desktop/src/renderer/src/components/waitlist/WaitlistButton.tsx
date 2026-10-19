import { useQuery } from '@tanstack/react-query'
import { Hourglass, ListPlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { WaitlistDialog, type WaitlistTarget } from '@renderer/components/waitlist/WaitlistDialog'
import { patientWaitlistQuery } from '@renderer/lib/queries'

export function WaitlistButton({
  patient
}: {
  patient: { id: number; nome: string }
}): React.JSX.Element | null {
  const entry = useQuery(patientWaitlistQuery(patient.id))
  const [target, setTarget] = useState<WaitlistTarget | null>(null)
  if (entry.data === undefined) return null
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="animate-fade-in"
        onClick={() => setTarget({ patient, entry: entry.data })}
      >
        {entry.data ? <Hourglass /> : <ListPlus />}
        {entry.data ? 'Na lista de espera' : 'Pôr na lista de espera'}
      </Button>
      <WaitlistDialog target={target} onClose={() => setTarget(null)} />
    </>
  )
}
