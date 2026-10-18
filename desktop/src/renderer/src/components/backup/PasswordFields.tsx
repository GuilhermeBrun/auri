import { Field, Input } from '@renderer/components/ui/input'
import { MIN_PASSWORD } from '@renderer/lib/backup'

/** Senha nova e a confirmação. */
export function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  error,
  autoFocus,
  label = 'Senha'
}: {
  password: string
  confirm: string
  onPassword: (value: string) => void
  onConfirm: (value: string) => void
  /** Erro a mostrar (depois de tentar continuar). */
  error?: string | null
  autoFocus?: boolean
  label?: string
}): React.JSX.Element {
  const mismatch = error === 'As duas senhas não são iguais.'
  return (
    <div className="flex flex-col gap-4">
      <Field
        label={label}
        hint={`pelo menos ${MIN_PASSWORD} caracteres`}
        error={error && !mismatch ? error : undefined}
      >
        <Input
          type="password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus={autoFocus}
          aria-invalid={!!error && !mismatch}
        />
      </Field>
      <Field label="Repita a senha" error={mismatch ? error : undefined}>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={mismatch}
        />
      </Field>
    </div>
  )
}
