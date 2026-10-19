import { AuriSymbol } from '@renderer/components/ui/brand'

export function Loading({ label = 'Carregando…' }: { label?: string }): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex h-full min-h-60 animate-[fade-in_200ms_ease-out_400ms_backwards] flex-col items-center justify-center gap-3 text-ink-faint"
    >
      <AuriSymbol animated className="size-6 text-ink-soft" />
      <span className="text-xs">{label}</span>
    </div>
  )
}
