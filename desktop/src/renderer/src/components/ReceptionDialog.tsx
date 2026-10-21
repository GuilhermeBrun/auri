import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { NewPasswordFields } from '@renderer/components/backup/PasswordFields'
import { RecoveryCode } from '@renderer/components/backup/RecoveryCode'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input } from '@renderer/components/ui/input'
import { ErrorText } from '@renderer/components/ui/section'
import { passwordProblem } from '@renderer/lib/backup'
import { useToast } from '@renderer/lib/toast'

export function ReceptionDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Desligar o computador da recepção"
      description="A mesma senha da cópia de segurança."
    >
      {open && <ReceptionForm onClose={onClose} />}
    </Dialog>
  )
}

function ReceptionForm({ onClose }: { onClose: () => void }): React.JSX.Element {
  const toast = useToast()
  const [useCode, setUseCode] = useState(false)
  const [value, setValue] = useState('')

  const disable = useMutation({
    mutationFn: () =>
      window.prefs.disableReception(useCode ? { recoveryCode: value } : { password: value }),
    onSuccess: () => {
      toast({ title: 'Computador da recepção desligado' })
      onClose()
    }
  })

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!value.trim() || disable.isPending) return
    disable.mutate()
  }

  return (
    <form onSubmit={submit}>
      <DialogBody className="flex flex-col gap-4">
        {useCode ? (
          <Field label="Código de recuperação">
            <Input
              key="code"
              value={value}
              onChange={(e) => setValue(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="font-mono tracking-[0.06em]"
            />
          </Field>
        ) : (
          <Field label="Senha">
            <Input
              key="password"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </Field>
        )}
        {disable.error && <ErrorText className="mt-0">{disable.error.message}</ErrorText>}
      </DialogBody>
      <DialogFooter>
        <Button
          variant="ghost"
          onClick={() => {
            setUseCode(!useCode)
            setValue('')
            disable.reset()
          }}
        >
          {useCode ? 'Usar a senha' : 'Esqueci a senha'}
        </Button>
        <Button type="submit" loading={disable.isPending}>
          Desligar
        </Button>
      </DialogFooter>
    </form>
  )
}

export function ReceptionPasswordDialog({
  open,
  on,
  onClose
}: {
  open: boolean
  on: boolean
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const [code, setCode] = useState<string | null>(null)
  const close = (): void => {
    setCode(null)
    onClose()
  }
  const done = (): void => {
    toast({ title: on ? 'Senha da recepção criada' : 'Computador da recepção ligado' })
    close()
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      dismissible={!code}
      title={code ? 'Guarde o código de recuperação' : 'Crie uma senha para a recepção'}
      description={
        code
          ? 'Sem a senha, só este código desliga a recepção e abre as cópias. Ele não aparece de novo.'
          : 'Desligar vai pedir esta senha. A cópia de segurança usa a mesma.'
      }
    >
      {open && !code && (
        <CreatePasswordForm label={on ? 'Criar senha' : 'Ligar'} onCode={setCode} onDone={done} />
      )}
      {open && code && <SaveCode code={code} onDone={done} />}
    </Dialog>
  )
}

function CreatePasswordForm({
  label,
  onCode,
  onDone
}: {
  label: string
  onCode: (code: string) => void
  onDone: () => void
}): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tried, setTried] = useState(false)
  const enable = useMutation({
    mutationFn: () => window.prefs.enableReception(password),
    onSuccess: (created) => (created ? onCode(created.recoveryCode) : onDone())
  })
  const problem = passwordProblem(password, confirm)
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    setTried(true)
    if (!problem && !enable.isPending) enable.mutate()
  }
  return (
    <form onSubmit={submit}>
      <DialogBody className="flex flex-col gap-4">
        <NewPasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          error={tried ? problem : null}
          autoFocus
        />
        {enable.error && <ErrorText className="mt-0">{enable.error.message}</ErrorText>}
      </DialogBody>
      <DialogFooter>
        <span />
        <Button type="submit" loading={enable.isPending}>
          {label}
        </Button>
      </DialogFooter>
    </form>
  )
}

function SaveCode({ code, onDone }: { code: string; onDone: () => void }): React.JSX.Element {
  const [saved, setSaved] = useState(false)
  return (
    <>
      <DialogBody className="flex flex-col gap-4">
        <RecoveryCode code={code} />
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="size-4 accent-(--color-solid)"
          />
          Guardei o código em lugar seguro
        </label>
      </DialogBody>
      <DialogFooter>
        <span />
        <Button disabled={!saved} onClick={onDone}>
          Concluir
        </Button>
      </DialogFooter>
    </>
  )
}
