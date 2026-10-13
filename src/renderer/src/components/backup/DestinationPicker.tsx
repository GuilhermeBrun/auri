import { useMutation } from '@tanstack/react-query'
import { FolderOpen } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ErrorText } from '@renderer/components/ui/section'
import type { BackupDestination } from '@shared/api'

/** Onde guardar as cópias. */
export function DestinationPicker({
  onPick
}: {
  onPick: (destination: BackupDestination) => void
}): React.JSX.Element {
  const choose = useMutation({
    mutationFn: () => window.backup.chooseFolder(),
    onSuccess: (folder) => folder && onPick({ kind: 'folder', folder })
  })
  return (
    <div>
      <Button variant="secondary" loading={choose.isPending} onClick={() => choose.mutate()}>
        {!choose.isPending && <FolderOpen />} Escolher pasta…
      </Button>
      {choose.error && <ErrorText>{choose.error.message}</ErrorText>}
    </div>
  )
}
