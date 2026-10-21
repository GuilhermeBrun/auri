import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, FileUp } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Field, Input } from '@renderer/components/ui/input'
import { ErrorText } from '@renderer/components/ui/section'
import { formatWhen, setBackupInfo } from '@renderer/lib/backup'
import { useToast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import type { BackupEntry } from '@shared/api'

const count = (n: number, one: string, many: string): string =>
  `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

function summary(entry: BackupEntry): string {
  return `${count(entry.counts.patients, 'paciente', 'pacientes')} · ${count(entry.counts.appointments, 'sessão', 'sessões')}`
}

export function RestoreDialog({
  request,
  onClose,
  onRestored
}: {
  request: { id: number } | null
  onClose: () => void
  onRestored?: () => void
}): React.JSX.Element {
  const [last, setLast] = useState(request)
  if (request && request !== last) setLast(request)
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Restaurar dados de uma cópia"
      description="Troca os pacientes e a agenda pelos da cópia."
    >
      <RestoreForm key={last?.id} onClose={onClose} onRestored={onRestored} />
    </Dialog>
  )
}

function RestoreForm({
  onClose,
  onRestored
}: {
  onClose: () => void
  onRestored?: () => void
}): React.JSX.Element {
  const toast = useToast()
  const list = useQuery({
    queryKey: ['backups'],
    queryFn: () => window.backup.list(),
    staleTime: 0,
    gcTime: 0
  })
  const [picked, setPicked] = useState<BackupEntry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [useCode, setUseCode] = useState(false)
  const [secret, setSecret] = useState('')

  const entries = [
    ...picked,
    ...(list.data ?? []).filter((e) => !picked.some((p) => p.file === e.file))
  ]
  const entry = entries.find((e) => e.file === selected) ?? (selected ? null : entries[0]) ?? null

  const pick = useMutation({
    mutationFn: () => window.backup.pickFile(),
    onSuccess: (file) => {
      if (!file) return
      setPicked((current) => [file, ...current.filter((e) => e.file !== file.file)])
      setSelected(file.file)
    }
  })

  const restore = useMutation({
    mutationFn: () =>
      window.backup.restore(
        entry!.file,
        entry!.own ? undefined : useCode ? { recoveryCode: secret } : { password: secret }
      ),
    onSuccess: (info) => {
      setBackupInfo(info)
      toast({ title: 'Dados restaurados', description: `Cópia de ${formatWhen(entry!.createdAt)}` })
      onRestored?.()
      onClose()
    }
  })

  const needsSecret = entry !== null && !entry.own
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!entry || restore.isPending || (needsSecret && !secret.trim())) return
    restore.mutate()
  }

  return (
    <form onSubmit={submit}>
      <DialogBody>
        {list.isPending ? (
          <p className="text-xs text-ink-soft">Procurando cópias…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-ink-soft">Nenhuma cópia encontrada nas nuvens.</p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Cópia"
            className="-mx-2 flex max-h-64 flex-col gap-0.5 overflow-y-auto px-2"
          >
            {entries.map((item) => {
              const isSelected = item.file === entry?.file
              return (
                <button
                  key={item.file}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelected(item.file)
                    setSecret('')
                  }}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-control px-3 py-2 text-left transition-colors',
                    isSelected ? 'bg-fill-hover' : 'hover:bg-fill'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium first-letter:uppercase">
                      {formatWhen(item.createdAt)}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {item.location} · {summary(item)}
                    </span>
                  </span>
                  {isSelected && <Check className="size-4 stroke-[1.75]" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}
        {list.error && <ErrorText>{list.error.message}</ErrorText>}

        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          loading={pick.isPending}
          onClick={() => pick.mutate()}
        >
          <FileUp /> Escolher arquivo…
        </Button>
        {pick.error && <ErrorText>{pick.error.message}</ErrorText>}

        {needsSecret && (
          <div className="mt-6 animate-fade-in">
            <Field
              label={useCode ? 'Código de recuperação' : 'Senha da cópia'}
              hint={
                <button
                  type="button"
                  onClick={() => {
                    setUseCode((v) => !v)
                    setSecret('')
                  }}
                  className="text-xs font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                >
                  {useCode ? 'Usar a senha' : 'Esqueci a senha'}
                </button>
              }
              as="group"
            >
              <Input
                aria-label={useCode ? 'Código de recuperação' : 'Senha da cópia'}
                type={useCode ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(useCode ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={useCode ? 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX' : undefined}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                className={useCode ? 'font-mono tracking-[0.06em]' : undefined}
              />
            </Field>
            <p className="mt-1.5 text-xs text-ink-soft">
              Use a senha do computador que fez a cópia.
            </p>
          </div>
        )}

        {entry && (
          <p className="mt-6 text-xs text-ink-soft">
            {summary(entry)}, de {formatWhen(entry.createdAt)}. Dá para desfazer depois.
          </p>
        )}
        {restore.error && <ErrorText>{restore.error.message}</ErrorText>}
      </DialogBody>
      <DialogFooter>
        <span />
        <Button
          type="submit"
          loading={restore.isPending}
          disabled={!entry || (needsSecret && !secret.trim())}
        >
          Restaurar
        </Button>
      </DialogFooter>
    </form>
  )
}
