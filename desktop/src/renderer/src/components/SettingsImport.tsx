import { ArrowRight, FileDown } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ErrorText } from '@renderer/components/ui/section'
import { formatWhen } from '@renderer/lib/backup'
import { cn } from '@renderer/lib/utils'
import { useSettingsImport, type ImportState } from '@renderer/lib/settings-import'

export function ImportButton({
  state,
  label = 'Importar configurações…'
}: {
  state: ImportState
  label?: string
}): React.JSX.Element {
  const { pick } = state
  return (
    <div>
      <Button variant="secondary" loading={pick.isPending} onClick={() => pick.mutate()}>
        <FileDown /> {label}
      </Button>
      {pick.error && <ErrorText>{pick.error.message}</ErrorText>}
    </div>
  )
}

export function ImportPreview({
  state,
  className
}: {
  state: ImportState
  className?: string
}): React.JSX.Element | null {
  const { preview, cancel, apply } = state
  if (!preview) return null
  return (
    <div className={cn('animate-fade-in rounded-card bg-fill p-4', className)}>
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
        <Button variant="secondary" onClick={cancel}>
          Cancelar
        </Button>
        {preview.changes.length > 0 && (
          <Button loading={apply.isPending} onClick={() => apply.mutate(preview.token)}>
            Aplicar
          </Button>
        )}
      </div>
      {apply.error && <ErrorText>{apply.error.message}</ErrorText>}
    </div>
  )
}

export function SettingsImport({ onApplied }: { onApplied?: () => void }): React.JSX.Element {
  const state = useSettingsImport(onApplied)
  return state.preview ? <ImportPreview state={state} /> : <ImportButton state={state} />
}
