import { useMutation } from '@tanstack/react-query'
import { FolderOpen, RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Page } from '@renderer/components/Layout'
import { DestinationPicker } from '@renderer/components/backup/DestinationPicker'
import { PasswordDialog, type PasswordMode } from '@renderer/components/backup/PasswordDialog'
import { NewPasswordFields } from '@renderer/components/backup/PasswordFields'
import { RecoveryCode } from '@renderer/components/backup/RecoveryCode'
import { RestoreDialog } from '@renderer/components/backup/RestoreDialog'
import { Button } from '@renderer/components/ui/button'
import { Loading } from '@renderer/components/ui/loading'
import { ErrorText, SectionTitle, StatusDot } from '@renderer/components/ui/section'
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
import { SETTINGS_CRUMB } from '@renderer/lib/settings'
import { useToast } from '@renderer/lib/toast'
import type { BackupDestination, BackupFrequency, BackupInfo } from '@shared/api'

const FREQUENCY_OPTIONS = [
  ['daily', 'Todo dia'],
  ['change', 'A cada alteração'],
  ['manual', 'Só quando eu pedir']
] as const

const FREQUENCY_SHORT: Record<BackupFrequency, string> = {
  daily: 'Todo dia',
  change: 'A cada alteração',
  manual: 'Só quando você pedir'
}

/** Horários da cópia diária: de hora em hora, das 6h às 23h. */
const TIME_OPTIONS = Array.from({ length: 18 }, (_, i) => {
  const value = `${String(i + 6).padStart(2, '0')}:00`
  return { value, label: value }
})

function frequencyText(frequency: BackupFrequency, time: string): string {
  switch (frequency) {
    case 'daily':
      return `Uma cópia por dia às ${time}. Se o computador estiver desligado nesse horário, a cópia sai assim que o Auri abrir.`
    case 'change':
      return 'Uma cópia alguns minutos depois de cada alteração em pacientes ou na agenda.'
    case 'manual':
      return 'Só quando você clicar em “Fazer cópia agora”. O Auri avisa depois de 3 dias sem cópia.'
  }
}

/** Passo do assistente, em cinza acima do título. */
function Step({ n }: { n: number }): React.JSX.Element {
  return <p className="mb-1 text-xs text-ink-faint">Passo {n} de 3</p>
}

/** Pasta escolhida: nome da nuvem e o caminho (borrado: no Google Drive ele traz o e-mail). */
function DestinationLine({ destination }: { destination: BackupDestination }): React.JSX.Element {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-medium">{DESTINATION_LABEL[destination.kind]}</p>
      <p className="truncate text-xs text-ink-soft">
        <Sensitive label="Pasta das cópias">{destination.folder}</Sensitive>
      </p>
    </div>
  )
}

/**
 * Liga a cópia: onde guardar e a senha. O código de recuperação aparece depois, na página (ver
 * `RecoveryStep`), porque a cópia já fica ligada quando ele é gerado.
 */
function Setup({
  suggested,
  onCode
}: {
  suggested: BackupInfo['suggested']
  onCode: (code: string) => void
}): React.JSX.Element {
  const [destination, setDestination] = useState<BackupDestination | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tried, setTried] = useState(false)

  const setup = useMutation({
    mutationFn: () => window.backup.setup(destination!, password),
    onSuccess: ({ recoveryCode }) => onCode(recoveryCode)
  })

  const problem = passwordProblem(password, confirm)
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    setTried(true)
    if (!problem && !setup.isPending) setup.mutate()
  }

  if (!destination) {
    return (
      <section className="animate-fade-in">
        <Step n={1} />
        <SectionTitle title="Onde guardar as cópias">
          Numa nuvem, para a cópia sobreviver se este computador quebrar. O Auri grava na pasta que
          o app da nuvem cria neste computador, e ele manda para a internet.
        </SectionTitle>
        <div className="mt-4">
          <DestinationPicker onPick={setDestination} suggested={suggested} />
        </div>
      </section>
    )
  }

  return (
    <section className="animate-fade-in">
      <Step n={2} />
      <SectionTitle title="Crie uma senha para as cópias">
        As cópias saem cifradas: sem a senha, ninguém consegue ler, nem quem tiver acesso à nuvem.
        Neste computador as cópias são automáticas; a senha só é pedida para abrir uma cópia em
        outro computador.
      </SectionTitle>
      <div className="mt-4 flex items-center gap-3 rounded-card bg-fill px-4 py-3">
        <DestinationLine destination={destination} />
        <Button variant="secondary" size="sm" onClick={() => setDestination(null)}>
          Trocar
        </Button>
      </div>
      <form onSubmit={submit} className="mt-6 max-w-[360px]">
        <NewPasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          error={tried ? problem : null}
          autoFocus
        />
        <Button type="submit" className="mt-6" loading={setup.isPending}>
          Continuar
        </Button>
        {setup.error && <ErrorText>{setup.error.message}</ErrorText>}
      </form>
    </section>
  )
}

/** Último passo: o código de recuperação, que só aparece esta vez. */
function RecoveryStep({ code, onDone }: { code: string; onDone: () => void }): React.JSX.Element {
  const [saved, setSaved] = useState(false)
  return (
    <section className="animate-fade-in">
      <Step n={3} />
      <SectionTitle title="Guarde o código de recuperação">
        Se a senha for esquecida, só este código abre as cópias. Imprima ou anote e guarde junto aos
        documentos da clínica. Ele não aparece de novo.
      </SectionTitle>
      <div className="mt-4">
        <RecoveryCode code={code} />
      </div>
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
    </section>
  )
}

/** Última cópia, falha ou aviso, com "Fazer cópia agora" e "Abrir pasta". */
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
  const failed =
    info.lastError !== null && (!info.lastSuccessAt || info.lastError.at > info.lastSuccessAt)

  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="mt-[5px] flex">
          <StatusDot on={!failed && !info.stale} />
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
            {DESTINATION_LABEL[info.destination!.kind]} · {FREQUENCY_SHORT[info.frequency]}
            {info.frequency === 'daily' && ` às ${info.dailyTime}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => open.mutate()}>
            <FolderOpen /> Abrir pasta
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={run.isPending || info.running}
            onClick={() => run.mutate()}
          >
            Fazer cópia agora
          </Button>
        </div>
      </div>
      {failed && !run.error && <ErrorText>{info.lastError!.message}</ErrorText>}
      {run.error && <ErrorText>{run.error.message}</ErrorText>}
      {open.error && <ErrorText>{open.error.message}</ErrorText>}
      {!failed && info.stale && info.lastSuccessAt && !info.running && (
        <p role="status" className="mt-2 text-xs text-ink-soft">
          Faz mais de 3 dias sem cópia. Confira se a pasta está disponível ou faça uma cópia agora.
        </p>
      )}
    </section>
  )
}

/** Onde ficam as cópias, com a opção de trocar de pasta. */
function Destination({ info }: { info: BackupInfo }): React.JSX.Element {
  const toast = useToast()
  const [changing, setChanging] = useState(false)
  const change = useMutation({
    mutationFn: (destination: BackupDestination) => window.backup.setDestination(destination),
    onSuccess: (next) => {
      setBackupInfo(next)
      setChanging(false)
      toast({ title: 'Pasta trocada', description: 'A próxima cópia já vai para lá.' })
    }
  })
  const destination = info.destination!
  return (
    <section className="mt-10">
      <SectionTitle title="Onde ficam" />
      <div className="mt-3 flex items-center gap-3">
        <DestinationLine destination={destination} />
        {!changing && (
          <Button variant="secondary" size="sm" onClick={() => setChanging(true)}>
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
        <div className="mt-4 animate-fade-in rounded-card bg-fill p-4">
          <p className="mb-3 text-xs text-ink-soft">
            As próximas cópias vão para a pasta nova. As que já estão na pasta atual ficam lá.
          </p>
          <DestinationPicker onPick={(next) => change.mutate(next)} />
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setChanging(false)}>
            Cancelar
          </Button>
          {change.error && <ErrorText>{change.error.message}</ErrorText>}
        </div>
      )}
    </section>
  )
}

/** Todo dia (com o horário), a cada alteração ou só quando pedir. Vale na hora. */
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
    <section className="mt-10">
      <SectionTitle title="Quando copiar" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
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
            />
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-soft">{frequencyText(info.frequency, info.dailyTime)}</p>
      {change.error && <ErrorText>{change.error.message}</ErrorText>}
    </section>
  )
}

/** Alterar senha, esqueci a senha, novo código. */
function Password(): React.JSX.Element {
  const [request, setRequest] = useState<{ mode: PasswordMode; id: number } | null>(null)
  const open = (mode: PasswordMode): void => setRequest({ mode, id: Date.now() })
  return (
    <section className="mt-10">
      <SectionTitle title="Senha das cópias">
        Pedida só para abrir uma cópia em outro computador.
      </SectionTitle>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => open('change')}>
          Alterar senha
        </Button>
        <Button variant="secondary" size="sm" onClick={() => open('reset')}>
          Esqueci a senha
        </Button>
        <Button variant="secondary" size="sm" onClick={() => open('code')}>
          Novo código de recuperação
        </Button>
      </div>
      <PasswordDialog request={request} onClose={() => setRequest(null)} />
    </section>
  )
}

/** Restaurar de uma cópia e, logo depois de restaurar, desfazer. */
function Restore({ info }: { info: BackupInfo }): React.JSX.Element {
  const toast = useToast()
  const [request, setRequest] = useState<{ id: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const undo = useMutation({
    mutationFn: () => window.backup.undoRestore(),
    onSuccess: (next) => {
      setBackupInfo(next)
      setConfirming(false)
      toast({ title: 'Restauração desfeita', description: 'Os dados de antes voltaram.' })
    }
  })
  return (
    <section className="mt-10">
      <SectionTitle title="Restaurar dados">
        Troca os pacientes e a agenda deste computador pelos de uma cópia. As configurações não
        mudam.
      </SectionTitle>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => setRequest({ id: Date.now() })}
      >
        Restaurar de uma cópia…
      </Button>
      {info.undo && (
        <div className="mt-4 flex animate-fade-in items-center gap-3 rounded-card bg-fill px-4 py-3">
          <p className="min-w-0 flex-1 text-xs text-ink-soft">
            {confirming
              ? 'Voltar aos dados de antes da restauração? O que foi feito depois dela se perde.'
              : `Dados restaurados ${formatWhen(info.undo.at)}.`}
          </p>
          {confirming ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
              <Button size="sm" loading={undo.isPending} onClick={() => undo.mutate()}>
                Desfazer
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
              <RotateCcw /> Desfazer restauração
            </Button>
          )}
        </div>
      )}
      {undo.error && <ErrorText>{undo.error.message}</ErrorText>}
      <RestoreDialog request={request} onClose={() => setRequest(null)} />
    </section>
  )
}

/** Desligar as cópias (as que já existem ficam na pasta). */
function Disable(): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const disable = useMutation({
    mutationFn: () => window.backup.disable(),
    onSuccess: setBackupInfo
  })
  return (
    <section className="mt-10">
      {confirming ? (
        <div className="animate-fade-in rounded-card bg-fill p-4">
          <p className="text-xs text-ink-soft">
            As cópias automáticas param e este computador esquece a senha. As cópias que já estão na
            pasta continuam lá e abrem com a senha de agora.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={disable.isPending}
              onClick={() => disable.mutate()}
            >
              Desligar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="danger-ghost"
          size="sm"
          className="-ml-2.5"
          onClick={() => setConfirming(true)}
        >
          Desligar a cópia de segurança
        </Button>
      )}
      {disable.error && <ErrorText>{disable.error.message}</ErrorText>}
    </section>
  )
}

/**
 * Configurações → Cópia de segurança (ver
 * docs/superpowers/specs/2026-10-13-copia-de-seguranca-design.md). Sem cópia ligada, o assistente
 * (onde, senha, código); ligada, o estado e os ajustes. Só no computador que guarda os dados.
 */
export function BackupPage(): React.JSX.Element {
  const info = useBackup()
  // o código fica na tela até "Concluir", mesmo com a cópia já ligada
  const [code, setCode] = useState<string | null>(null)

  return (
    <Page trail={[SETTINGS_CRUMB, { label: 'Cópia de segurança' }]}>
      <div className="mx-auto max-w-[720px] px-8 pt-8 pb-16">
        <p className="text-[13px] text-ink-soft">
          Uma cópia cifrada dos pacientes e da agenda, numa pasta da nuvem, para não perder nada se
          este computador quebrar.
        </p>
        <div className="mt-8">
          {!info ? (
            <Loading />
          ) : !info.available ? (
            <SectionTitle title="As cópias são feitas no computador que guarda os dados">
              Este computador usa os dados de outro. Ligue a cópia de segurança lá, em Configurações
              / Cópia de segurança.
            </SectionTitle>
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
              <Setup suggested={info.suggested} onCode={setCode} />
              <Restore info={info} />
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
