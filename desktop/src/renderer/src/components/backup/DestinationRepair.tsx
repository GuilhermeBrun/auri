import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { DestinationPicker, ProviderAction } from '@renderer/components/backup/DestinationPicker'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { ErrorText } from '@renderer/components/ui/section'
import { DESTINATION_LABEL, setBackupInfo, useInstallProgress } from '@renderer/lib/backup'
import { useToast } from '@renderer/lib/toast'
import type {
  BackupDestination,
  BackupInfo,
  CloudProvider,
  CloudProviderId,
  DestinationProblem
} from '@shared/api'

export function DestinationRepair({
  info,
  problem
}: {
  info: BackupInfo
  problem: DestinationProblem
}): React.JSX.Element {
  const toast = useToast()
  const kind = info.destination!.kind as CloudProviderId
  const progress = useInstallProgress()
  const [started, setStarted] = useState(false)
  const [choosing, setChoosing] = useState(false)

  useQuery({
    queryKey: ['backup-check'],
    queryFn: async () => {
      const next = await window.backup.check()
      setBackupInfo(next)
      return next.destinationProblem?.state ?? 'ok'
    },
    refetchInterval: 4000,
    refetchIntervalInBackground: true
  })

  const change = useMutation({
    mutationFn: (destination: BackupDestination) => window.backup.setDestination(destination),
    onSuccess: (next) => {
      setBackupInfo(next)
      setChoosing(false)
      toast({ title: 'Pasta trocada', description: 'A próxima cópia já vai para lá.' })
    }
  })

  const provider: CloudProvider = {
    id: kind,
    name: DESTINATION_LABEL[kind],
    state: problem.state,
    folder: problem.folder
  }

  return (
    <Callout tone="warning" title={problem.message} className="mt-4">
      <p>As cópias estão paradas. Resolva por aqui e o Auri volta a copiar sozinho.</p>
      <div className="mt-3">
        {problem.state === 'ready' && problem.folder ? (
          <Button
            variant="secondary"
            loading={change.isPending}
            onClick={() => change.mutate({ kind, folder: problem.folder! })}
          >
            Usar esta conta
          </Button>
        ) : (
          <ProviderAction
            provider={provider}
            progress={progress[kind]}
            started={started}
            onStart={() => setStarted(true)}
          />
        )}
        {!choosing && (
          <Button variant="ghost" className="mt-2" onClick={() => setChoosing(true)}>
            Escolher outra nuvem
          </Button>
        )}
      </div>
      {choosing && (
        <div className="mt-4 animate-fade-in">
          <DestinationPicker onPick={(next) => change.mutate(next)} />
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={() => setChoosing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {change.error && <ErrorText>{change.error.message}</ErrorText>}
    </Callout>
  )
}
