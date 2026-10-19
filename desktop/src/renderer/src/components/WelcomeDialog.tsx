import { useMutation } from '@tanstack/react-query'
import {
  CalendarDays,
  Check,
  DatabaseBackup,
  Network,
  SlidersHorizontal,
  Users
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { RestoreDialog } from '@renderer/components/backup/RestoreDialog'
import { SettingsImport } from '@renderer/components/SettingsImport'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { setBackupInfo, useBackup } from '@renderer/lib/backup'
import { cn } from '@renderer/lib/utils'

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
  done?: boolean
  children?: ReactNode
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
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: 'Boas-vindas ao Auri',
    description: 'A agenda e as fichas da clínica num lugar só, sem papel.'
  },
  {
    title: 'Os dados ficam com você',
    description: 'Tudo é guardado neste computador, e não num servidor de fora.'
  },
  {
    title: 'Já usa o Auri?',
    description:
      'Se este computador está substituindo outro, traga o que estava lá. Cada parte é opcional.'
  }
]

function Progress({ step }: { step: number }): React.JSX.Element {
  return (
    <div
      role="progressbar"
      aria-label="Etapa"
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuenow={step + 1}
      aria-valuetext={`Etapa ${step + 1} de ${STEPS.length}`}
      className="flex items-center gap-1.5"
    >
      {STEPS.map(({ title }, i) => (
        <span
          key={title}
          className={cn(
            'h-1.5 rounded-full transition-[width,background-color] duration-250 ease-slide',
            i === step ? 'w-4 bg-ink' : 'w-1.5 bg-line-strong'
          )}
        />
      ))}
    </div>
  )
}

export function WelcomeDialog(): React.JSX.Element {
  const info = useBackup()
  const [started, setStarted] = useState(false)
  if (info?.welcome && !started) setStarted(true)
  const [closed, setClosed] = useState(false)
  const [step, setStep] = useState(0)
  const [restoring, setRestoring] = useState<{ id: number } | null>(null)
  const [restored, setRestored] = useState(false)
  const [imported, setImported] = useState(false)

  const dismiss = useMutation({
    mutationFn: () => window.backup.dismissWelcome(),
    onSuccess: setBackupInfo,
    onSettled: () => setClosed(true)
  })

  const last = step === STEPS.length - 1
  const anything = restored || imported
  return (
    <>
      <Dialog
        open={started && !closed && restoring === null}
        onOpenChange={(open) => !open && dismiss.mutate()}
        title={STEPS[step].title}
        description={STEPS[step].description}
      >
        <DialogBody key={step} className="flex animate-page-in flex-col gap-6">
          {step === 0 && (
            <>
              <Part
                icon={<CalendarDays />}
                title="Agenda"
                description="As sessões da semana num relance, sem dois horários no mesmo lugar."
              />
              <Part
                icon={<Users />}
                title="Pacientes"
                description="A ficha de cada um, com a anamnese e o registro de todas as sessões."
              />
            </>
          )}
          {step === 1 && (
            <>
              <Part
                icon={<DatabaseBackup />}
                title="Cópia de segurança"
                description="Cifrada, na pasta do Google Drive, OneDrive ou iCloud. Só abre com a senha que você criar."
              />
              <Part
                icon={<Network />}
                title="Outros computadores"
                description="O consultório pode usar os mesmos dados da recepção, pela rede da clínica ou pela internet."
              />
            </>
          )}
          {last && (
            <>
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
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Progress step={step} />
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Voltar
              </Button>
            )}
            {last ? (
              <Button
                variant={anything ? 'primary' : 'secondary'}
                loading={dismiss.isPending}
                onClick={() => dismiss.mutate()}
              >
                {anything ? 'Concluir' : 'Começar do zero'}
              </Button>
            ) : (
              <Button onClick={() => setStep(step + 1)}>Continuar</Button>
            )}
          </div>
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
