import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input } from '@renderer/components/ui/input'
import { ErrorText } from '@renderer/components/ui/section'
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
      description="Digite a senha da cópia de segurança."
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
          <Field label="Senha da cópia de segurança">
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
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={disable.isPending}>
            Desligar
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
