import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { NewPasswordFields } from '@renderer/components/backup/PasswordFields'
import { RecoveryCode } from '@renderer/components/backup/RecoveryCode'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input } from '@renderer/components/ui/input'
import { ErrorText } from '@renderer/components/ui/section'
import { passwordProblem, setBackupInfo } from '@renderer/lib/backup'
import { useToast } from '@renderer/lib/toast'

export type PasswordMode = 'change' | 'reset' | 'code'

const TITLES: Record<PasswordMode, { title: string; description: string }> = {
  change: {
    title: 'Alterar senha',
    description: 'As cópias que já estão na pasta passam a abrir só com a senha nova.'
  },
  reset: {
    title: 'Esqueci a senha',
    description: 'Digite o código de recuperação que você guardou e escolha uma senha nova.'
  },
  code: {
    title: 'Novo código de recuperação',
    description: 'O código antigo deixa de abrir as cópias. Guarde o novo em lugar seguro.'
  }
}

/**
 * Alterar senha, "esqueci a senha" e novo código de recuperação. Os três regravam as cópias da
 * pasta (pode levar alguns segundos). O conteúdo continua montado enquanto o diálogo sai.
 */
export function PasswordDialog({
  request,
  onClose
}: {
  /** O que abrir; `id` muda a cada abertura, para o formulário começar vazio. */
  request: { mode: PasswordMode; id: number } | null
  onClose: () => void
}): React.JSX.Element {
  // o último pedido fica na tela enquanto o diálogo sai
  const [last, setLast] = useState(request)
  if (request && request !== last) setLast(request)
  const mode = last?.mode ?? 'change'
  const { title, description } = TITLES[mode]
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
    >
      <PasswordForm key={last?.id} mode={mode} onClose={onClose} />
    </Dialog>
  )
}

function PasswordForm({
  mode,
  onClose
}: {
  mode: PasswordMode
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tried, setTried] = useState(false)
  const [newCode, setNewCode] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      if (mode === 'change') setBackupInfo(await window.backup.changePassword(current, password))
      else if (mode === 'reset') setBackupInfo(await window.backup.resetPassword(code, password))
      else setNewCode((await window.backup.newRecoveryCode(current)).recoveryCode)
    },
    onSuccess: () => {
      if (mode === 'code') return
      toast({ title: mode === 'change' ? 'Senha alterada' : 'Senha nova criada' })
      onClose()
    }
  })

  const problem = mode === 'code' ? null : passwordProblem(password, confirm)
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    setTried(true)
    if (problem || save.isPending) return
    if (mode !== 'reset' && !current) return
    if (mode === 'reset' && !code.trim()) return
    save.mutate()
  }

  if (newCode) {
    return (
      <>
        <DialogBody>
          <RecoveryCode code={newCode} />
          <p className="mt-3 text-xs text-ink-soft">
            Este código não aparece de novo. Imprima ou anote antes de fechar.
          </p>
        </DialogBody>
        <DialogFooter>
          <span />
          <Button onClick={onClose}>Pronto</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={submit}>
      <DialogBody className="flex flex-col gap-4">
        {mode === 'reset' ? (
          <Field label="Código de recuperação">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="font-mono tracking-[0.06em]"
            />
          </Field>
        ) : (
          <Field label={mode === 'change' ? 'Senha atual' : 'Senha da cópia'}>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </Field>
        )}
        {mode !== 'code' && (
          <NewPasswordFields
            label="Senha nova"
            password={password}
            confirm={confirm}
            onPassword={setPassword}
            onConfirm={setConfirm}
            error={tried ? problem : null}
          />
        )}
        {save.error && <ErrorText className="mt-0">{save.error.message}</ErrorText>}
      </DialogBody>
      <DialogFooter>
        <span className="text-xs text-ink-soft">
          {save.isPending && 'Regravando as cópias da pasta…'}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {mode === 'change'
              ? 'Alterar senha'
              : mode === 'reset'
                ? 'Criar senha'
                : 'Gerar código'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
