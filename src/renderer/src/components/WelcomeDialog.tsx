import { useMutation } from '@tanstack/react-query'
import { Check, DatabaseBackup, SlidersHorizontal } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { RestoreDialog } from '@renderer/components/backup/RestoreDialog'
import { SettingsImport } from '@renderer/components/SettingsImport'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { setBackupInfo, useBackup } from '@renderer/lib/backup'

/** Uma das partes que dá para trazer de outro computador, com o seu botão. */
function Part({
  icon,
  title,
  description,
  done,
  children
}: {
  icon: ReactNode
  title: string
  description: string
  done: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 text-ink-soft [&_svg]:size-[18px] [&_svg]:stroke-[1.75]"
      >
        {done ? <Check className="animate-fade-in text-ink" /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{description}</p>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}

/**
 * "Já usa o Auri?": na primeira abertura (banco vazio, cópia ainda desligada), oferece trazer os
 * dados de uma cópia e as configurações de um arquivo, em passos separados e opcionais. Aparece
 * uma vez; "Começar do zero" ou "Concluir" não mostram de novo.
 */
export function WelcomeDialog(): React.JSX.Element {
  const info = useBackup()
  // abre uma vez quando o main diz que é a primeira abertura; fechar é decisão do usuário
  const [started, setStarted] = useState(false)
  if (info?.welcome && !started) setStarted(true)
  const [closed, setClosed] = useState(false)
  const [restoring, setRestoring] = useState<{ id: number } | null>(null)
  const [restored, setRestored] = useState(false)
  const [imported, setImported] = useState(false)

  const dismiss = useMutation({
    mutationFn: () => window.backup.dismissWelcome(),
    onSuccess: setBackupInfo,
    onSettled: () => setClosed(true)
  })

  const anything = restored || imported
  return (
    <>
      <Dialog
        open={started && !closed && restoring === null}
        onOpenChange={(open) => !open && dismiss.mutate()}
        title="Já usa o Auri?"
        description="Se este computador está substituindo outro, traga o que estava lá. Cada parte é opcional."
      >
        <DialogBody className="flex flex-col gap-6">
          <Part
            icon={<DatabaseBackup />}
            title="Pacientes e agenda"
            description="Da cópia de segurança no Google Drive, OneDrive, iCloud ou num arquivo. Pede a senha da cópia."
            done={restored}
          >
            {restored ? (
              <p className="text-xs text-ink-soft">Dados restaurados.</p>
            ) : (
              <Button variant="secondary" onClick={() => setRestoring({ id: Date.now() })}>
                Restaurar dados…
              </Button>
            )}
          </Part>
          <Part
            icon={<SlidersHorizontal />}
            title="Configurações"
            description="Aparência, conexão e as escolhas da cópia, de um arquivo exportado no outro computador."
            done={imported}
          >
            {imported ? (
              <p className="text-xs text-ink-soft">Configurações importadas.</p>
            ) : (
              <SettingsImport onApplied={() => setImported(true)} />
            )}
          </Part>
        </DialogBody>
        <DialogFooter>
          <span />
          <Button
            variant={anything ? 'primary' : 'secondary'}
            loading={dismiss.isPending}
            onClick={() => dismiss.mutate()}
          >
            {anything ? 'Concluir' : 'Começar do zero'}
          </Button>
        </DialogFooter>
      </Dialog>
      <RestoreDialog
        request={restoring}
        onClose={() => setRestoring(null)}
        onRestored={() => setRestored(true)}
      />
    </>
  )
}
