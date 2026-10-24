import { useMutation } from '@tanstack/react-query'
import { FolderOpen, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DestinationPicker } from '@renderer/components/backup/DestinationPicker'
import { DestinationRepair } from '@renderer/components/backup/DestinationRepair'
import { PasswordDialog, type PasswordMode } from '@renderer/components/backup/PasswordDialog'
import { NewPasswordFields } from '@renderer/components/backup/PasswordFields'
import { RecoveryCode } from '@renderer/components/backup/RecoveryCode'
import { RestoreDialog } from '@renderer/components/backup/RestoreDialog'
import { Button } from '@renderer/components/ui/button'
import { Callout } from '@renderer/components/ui/callout'
import { Field, Input } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import {
  ErrorText,
  GroupText,
  PageSection,
  SettingRow,
  SettingsGroup,
  StatusDot
} from '@renderer/components/ui/section'
import { Segmented } from '@renderer/components/ui/segmented'
import { Select } from '@renderer/components/ui/select'
import { Sensitive } from '@renderer/components/ui/sensitive'
import {
  DESTINATION_LABEL,
  formatWhen,
  passwordProblem,
  setBackupInfo,
  useBackup
} from '@renderer/lib/backup'
import { formatSize, SPACE_WARNING_BYTES, storedText } from '@renderer/lib/backup-size'
import { useToast } from '@renderer/lib/toast'
import type { BackupDestination, BackupFrequency, BackupInfo } from '@shared/api'

const FREQUENCY_OPTIONS = [
  ['daily', 'Todo dia'],
  ['change', 'A cada alteração'],
  ['manual', 'Só quando eu pedir']
] as const

const TIME_OPTIONS = Array.from({ length: 18 }, (_, i) => {
  const value = `${String(i + 6).padStart(2, '0')}:00`
  return { value, label: value }
})

function DestinationLine({ destination }: { destination: BackupDestination }): React.JSX.Element {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-medium">{DESTINATION_LABEL[destination.kind]}</p>
      <p className="truncate text-xs text-ink-soft">
        <Sensitive label="Pasta das cópias" what="a pasta">
          {destination.folder}
        </Sensitive>
      </p>
    </div>
  )
}

function Setup({
  suggested,
  hasPassword,
  onCode
}: {
  suggested: BackupInfo['suggested']
  hasPassword: boolean
  onCode: (code: string) => void
}): React.JSX.Element {
  const [destination, setDestination] = useState<BackupDestination | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [replace, setReplace] = useState(false)
  const [tried, setTried] = useState(false)
  const existing = hasPassword && !replace
  const total = existing ? 2 : 3

  const setup = useMutation({
    mutationFn: () => window.backup.setup(destination!, password, replace),
    onSuccess: ({ recoveryCode }) => recoveryCode && onCode(recoveryCode)
  })

  const problem = existing
    ? password
      ? null
      : 'Digite a senha.'
    : passwordProblem(password, confirm)
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    setTried(true)
    if (!problem && !setup.isPending) setup.mutate()
  }

  if (!destination) {
    return (
      <SettingsGroup
        label={`Passo 1 de ${total} · Onde guardar as cópias`}
        className="animate-fade-in"
      >
        <GroupText>Numa nuvem, para a cópia sobreviver se este computador quebrar.</GroupText>
        <div className="mt-4">
          <DestinationPicker onPick={setDestination} suggested={suggested} />
        </div>
      </SettingsGroup>
    )
  }

  return (
    <SettingsGroup
      label={
        existing
          ? 'Passo 2 de 2 · Digite a senha deste computador'
          : `Passo 2 de ${total} · Crie uma senha para as cópias`
      }
      className="animate-fade-in"
    >
      <GroupText>
        {existing
          ? 'A senha criada para o computador da recepção também protege as cópias.'
          : 'Sem a senha, ninguém abre as cópias, nem quem acessa a nuvem.'}
      </GroupText>
      <div className="mt-4 flex items-center gap-3">
        <DestinationLine destination={destination} />
        <Button variant="secondary" onClick={() => setDestination(null)}>
          Trocar
        </Button>
      </div>
      <form onSubmit={submit} className="mt-6 max-w-[360px]">
        {existing ? (
          <Field label="Senha" error={tried ? (problem ?? undefined) : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </Field>
        ) : (
          <NewPasswordFields
            password={password}
            confirm={confirm}
            onPassword={setPassword}
            onConfirm={setConfirm}
            error={tried ? problem : null}
            autoFocus
          />
        )}
        <div className="mt-6 flex items-center gap-2">
          <Button type="submit" loading={setup.isPending}>
            Continuar
          </Button>
          {existing && (
            <Button
              variant="ghost"
              onClick={() => {
                setReplace(true)
                setPassword('')
                setTried(false)
                setup.reset()
              }}
            >
              Criar outra senha
            </Button>
          )}
        </div>
        {setup.error && <ErrorText>{setup.error.message}</ErrorText>}
      </form>
    </SettingsGroup>
  )
}

function RecoveryStep({ code, onDone }: { code: string; onDone: () => void }): React.JSX.Element {
  const [saved, setSaved] = useState(false)
  return (
    <SettingsGroup
      label="Passo 3 de 3 · Guarde o código de recuperação"
      className="animate-fade-in"
    >
      <GroupText>Sem a senha, só este código abre as cópias. Ele não aparece de novo.</GroupText>
      <RecoveryCode code={code} className="mt-4 bg-transparent p-0" />
      <label className="mt-5 flex cursor-pointer items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="size-4 accent-(--color-solid)"
        />
        Guardei o código em lugar seguro
      </label>
      <Button className="mt-4" disabled={!saved} onClick={onDone}>
        Concluir
      </Button>
    </SettingsGroup>
  )
}

function Status({ info }: { info: BackupInfo }): React.JSX.Element {
  const toast = useToast()
  const run = useMutation({
    mutationFn: () => window.backup.runNow(),
    onSuccess: (next) => {
      setBackupInfo(next)
      toast({ title: 'Cópia feita' })
    }
  })
  const open = useMutation({ mutationFn: () => window.backup.openFolder() })
  const problem = info.destinationProblem
  const failed =
    info.lastError !== null && (!info.lastSuccessAt || info.lastError.at > info.lastSuccessAt)

  const label = DESTINATION_LABEL[info.destination!.kind]
  const hadProblem = useRef(problem !== null)
  useEffect(() => {
    if (hadProblem.current && problem === null) {
      toast({ title: `O ${label} voltou` })
    }
    hadProblem.current = problem !== null
  }, [problem, label, toast])

  return (
    <SettingsGroup>
      <div className="flex items-center gap-3">
        <span className="flex self-start pt-[5px]">
          <StatusDot on={!failed && !info.stale && !problem} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium" aria-live="polite">
            {info.running
              ? 'Fazendo cópia…'
              : info.lastSuccessAt
                ? `Última cópia ${formatWhen(info.lastSuccessAt)}`
                : 'Nenhuma cópia ainda'}
          </p>
          <p className="text-xs text-ink-soft">
            {label}
            {info.stored && info.stored.count > 0 && ` · ${storedText(info.stored)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => open.mutate()}>
            <FolderOpen /> Abrir pasta
          </Button>
          <Button
            variant="secondary"
            loading={run.isPending || info.running}
            onClick={() => run.mutate()}
          >
            Fazer cópia agora
          </Button>
        </div>
      </div>
      {problem && <DestinationRepair info={info} problem={problem} />}
      {failed && !problem && !run.error && (
        <Callout tone="warning" title="A última cópia não foi feita" className="mt-4">
          {info.lastError!.message}
        </Callout>
      )}
      {run.error && <ErrorText>{run.error.message}</ErrorText>}
      {open.error && <ErrorText>{open.error.message}</ErrorText>}
      {info.stored && info.stored.bytes >= SPACE_WARNING_BYTES && (
        <Callout
          tone="warning"
          title={`As cópias já ocupam ${formatSize(info.stored.bytes)}`}
          className="mt-4"
        >
          Confira o espaço livre na nuvem.
        </Callout>
      )}
      {!failed && info.stale && info.lastSuccessAt && !info.running && (
        <Callout tone="warning" title="Faz mais de 3 dias sem cópia" className="mt-4" />
      )}
    </SettingsGroup>
  )
}

function Destination({ info }: { info: BackupInfo }): React.JSX.Element {
  const toast = useToast()
  const [changing, setChanging] = useState(false)
  const change = useMutation({
    mutationFn: (destination: BackupDestination) => window.backup.setDestination(destination),
    onSuccess: (next) => {
      setBackupInfo(next)
      setChanging(false)
      toast({ title: 'Pasta trocada' })
    }
  })
  const destination = info.destination!
  return (
    <SettingsGroup>
      <div className="flex items-center gap-3">
        <DestinationLine destination={destination} />
        {!changing && (
          <Button variant="secondary" onClick={() => setChanging(true)}>
            Trocar
          </Button>
        )}
      </div>
      {info.folderMissing && (
        <ErrorText>
          A pasta não está disponível agora.{' '}
          {destination.kind === 'folder'
            ? 'Confira se o pendrive ou HD está conectado.'
            : `Confira se o ${DESTINATION_LABEL[destination.kind]} está aberto.`}
        </ErrorText>
      )}
      {changing && (
        <div className="mt-4 animate-fade-in">
          <DestinationPicker onPick={(next) => change.mutate(next)} />
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={() => setChanging(false)}>
              Cancelar
            </Button>
          </div>
          {change.error && <ErrorText>{change.error.message}</ErrorText>}
        </div>
      )}
    </SettingsGroup>
  )
}

function Frequency({ info }: { info: BackupInfo }): React.JSX.Element {
  const change = useMutation({
    mutationFn: ({ frequency, time }: { frequency: BackupFrequency; time: string }) =>
      window.backup.setFrequency(frequency, time),
    onSuccess: setBackupInfo
  })
  const times = TIME_OPTIONS.some((o) => o.value === info.dailyTime)
    ? TIME_OPTIONS
    : [...TIME_OPTIONS, { value: info.dailyTime, label: info.dailyTime }]
  return (
    <SettingsGroup>
      <SettingRow
        title="Quando copiar"
        description={
          info.frequency === 'manual' ? 'O Auri avisa depois de 3 dias sem cópia.' : undefined
        }
      >
        <Segmented
          label="Quando copiar"
          value={info.frequency}
          options={FREQUENCY_OPTIONS}
          onChange={(frequency) => change.mutate({ frequency, time: info.dailyTime })}
        />
        {info.frequency === 'daily' && (
          <div className="w-[104px] animate-fade-in" aria-label="Horário da cópia">
            <Select
              value={info.dailyTime}
              onValueChange={(time) => change.mutate({ frequency: 'daily', time })}
              options={times}
              compact
            />
          </div>
        )}
      </SettingRow>
      {change.error && <ErrorText>{change.error.message}</ErrorText>}
    </SettingsGroup>
  )
}

function Password(): React.JSX.Element {
  const [request, setRequest] = useState<{ mode: PasswordMode; id: number } | null>(null)
  const open = (mode: PasswordMode): void => setRequest({ mode, id: Date.now() })
  return (
    <SettingsGroup>
      <SettingRow title="Senha" description="Também desliga o computador da recepção.">
        <Button variant="secondary" onClick={() => open('change')}>
          Alterar
        </Button>
        <Button variant="secondary" onClick={() => open('reset')}>
          Esqueci
        </Button>
        <Button variant="secondary" onClick={() => open('code')}>
          Novo código
        </Button>
      </SettingRow>
      <PasswordDialog request={request} onClose={() => setRequest(null)} />
    </SettingsGroup>
  )
}

function Restore({ info }: { info: BackupInfo }): React.JSX.Element {
  const toast = useToast()
  const [request, setRequest] = useState<{ id: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const undo = useMutation({
    mutationFn: () => window.backup.undoRestore(),
    onSuccess: (next) => {
      setBackupInfo(next)
      setConfirming(false)
      toast({ title: 'Restauração desfeita' })
    }
  })
  return (
    <SettingsGroup>
      <SettingRow
        title="Restaurar dados"
        description="Troca os pacientes e a agenda pelos da cópia."
      >
        <Button variant="secondary" onClick={() => setRequest({ id: Date.now() })}>
          Restaurar…
        </Button>
      </SettingRow>
      {info.undo && (
        <div className="mt-4 flex animate-fade-in items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-ink-soft">
            {confirming
              ? 'Voltar aos dados de antes? O que foi feito depois se perde.'
              : `Dados restaurados ${formatWhen(info.undo.at)}.`}
          </p>
          {confirming ? (
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
              <Button loading={undo.isPending} onClick={() => undo.mutate()}>
                Desfazer
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              <RotateCcw /> Desfazer restauração
            </Button>
          )}
        </div>
      )}
      {undo.error && <ErrorText>{undo.error.message}</ErrorText>}
      <RestoreDialog request={request} onClose={() => setRequest(null)} />
    </SettingsGroup>
  )
}

function Disable(): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const disable = useMutation({
    mutationFn: () => window.backup.disable(),
    onSuccess: setBackupInfo
  })
  return (
    <SettingsGroup>
      {confirming ? (
        <div className="animate-fade-in">
          <p className="text-xs text-ink-soft">
            As cópias param e este computador esquece a senha. As já feitas ficam na pasta.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={disable.isPending} onClick={() => disable.mutate()}>
              Desligar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="danger-ghost" className="-ml-3.5" onClick={() => setConfirming(true)}>
          Desligar a cópia de segurança
        </Button>
      )}
      {disable.error && <ErrorText>{disable.error.message}</ErrorText>}
    </SettingsGroup>
  )
}

export function BackupSection(): React.JSX.Element {
  const info = useBackup()
  const [code, setCode] = useState<string | null>(null)

  return (
    <PageSection id="copia" title="Cópia de segurança">
      <div className="flex flex-col">
        {!info ? (
          <Loading />
        ) : !info.available ? (
          <SettingsGroup>
            <p className="text-[13px] font-medium">
              As cópias são feitas no computador que guarda os dados
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Ligue lá, em Configurações › Armazenamento.
            </p>
          </SettingsGroup>
        ) : code ? (
          <RecoveryStep code={code} onDone={() => setCode(null)} />
        ) : info.configured ? (
          <>
            <Status info={info} />
            <Destination info={info} />
            <Frequency info={info} />
            <Password />
            <Restore info={info} />
            <Disable />
          </>
        ) : (
          <>
            <Setup suggested={info.suggested} hasPassword={info.hasPassword} onCode={setCode} />
            <Restore info={info} />
          </>
        )}
      </div>
    </PageSection>
  )
}
