import { useMutation } from '@tanstack/react-query'
import { ArrowRight, FileDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { ErrorText } from '@renderer/components/ui/section'
import { formatWhen } from '@renderer/lib/backup'
import { useToast } from '@renderer/lib/toast'
import type { SettingsPreview } from '@shared/api'

/**
 * "Importar configurações": escolhe o arquivo, mostra o que muda ("Tema: Sistema → Escuro") e só
 * aplica depois de confirmar. Nunca mexe nos pacientes nem na agenda.
 */
export function SettingsImport({ onApplied }: { onApplied?: () => void }): React.JSX.Element {
  const toast = useToast()
  const [preview, setPreview] = useState<SettingsPreview | null>(null)
  const pick = useMutation({
    mutationFn: () => window.transfer.pickSettings(),
    onSuccess: (next) => next && setPreview(next)
  })
  const apply = useMutation({
    mutationFn: (token: string) => window.transfer.applySettings(token),
    onSuccess: () => {
      setPreview(null)
      toast({ title: 'Configurações importadas' })
      onApplied?.()
    }
  })

  if (!preview) {
    return (
      <div>
        <Button variant="secondary" loading={pick.isPending} onClick={() => pick.mutate()}>
          {!pick.isPending && <FileDown />} Importar configurações…
        </Button>
        {pick.error && <ErrorText>{pick.error.message}</ErrorText>}
      </div>
    )
  }

  return (
    <div className="animate-fade-in rounded-card bg-fill p-4">
      <p className="text-xs text-ink-soft">
        {preview.name}, exportado {formatWhen(preview.exportedAt)}.
      </p>
      {preview.changes.length === 0 ? (
        <p className="mt-3 text-[13px]">Nada muda: as configurações já são iguais.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {preview.changes.map((change) => (
            <li key={change.label} className="text-[13px]">
              <span className="font-medium">{change.label}:</span>{' '}
              <span className="text-ink-soft">{change.from}</span>
              <ArrowRight
                className="mx-1.5 inline size-3.5 stroke-[1.75] text-ink-soft"
                aria-label="passa a ser"
              />
              {change.to}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
          Cancelar
        </Button>
        {preview.changes.length > 0 && (
          <Button size="sm" loading={apply.isPending} onClick={() => apply.mutate(preview.token)}>
            Aplicar
          </Button>
        )}
      </div>
      {apply.error && <ErrorText>{apply.error.message}</ErrorText>}
    </div>
  )
}
