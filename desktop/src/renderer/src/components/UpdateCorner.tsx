import { useMutation } from '@tanstack/react-query'
import { Download, RotateCcw } from 'lucide-react'
import { useToast } from '@renderer/lib/toast'
import { setUpdateState, useUpdates } from '@renderer/lib/updates'
import { cn } from '@renderer/lib/utils'

const iconButtonClass =
  'flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent [&_svg]:size-4 [&_svg]:stroke-[1.75]'

export function UpdateCorner(): React.JSX.Element | null {
  const state = useUpdates()
  const toast = useToast()
  const check = useMutation({
    mutationFn: () => window.updates.check(),
    onSuccess: (next) => {
      setUpdateState(next)
      if (next.status === 'idle') toast({ title: 'Esta é a versão mais nova' })
    },
    onError: (error) => toast({ title: 'Não foi possível procurar', description: error.message })
  })
  const install = useMutation({ mutationFn: () => window.updates.install() })
  if (!state || state.status === 'unavailable') return null

  if (state.status === 'ready') {
    const label = `Reiniciar e atualizar para a versão ${state.next}`
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={install.isPending}
        onClick={() => install.mutate()}
        className={cn(iconButtonClass, 'relative text-ink')}
      >
        <RotateCcw aria-hidden="true" />
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-attention"
        />
      </button>
    )
  }

  const busy = state.status === 'checking' || state.status === 'downloading' || check.isPending
  const label =
    state.status === 'downloading'
      ? `Baixando a versão ${state.next}${state.progress ? ` (${state.progress}%)` : ''}`
      : 'Procurar atualizações'
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-busy={busy}
      disabled={busy}
      onClick={() => check.mutate()}
      className={iconButtonClass}
    >
      <Download aria-hidden="true" className={cn(busy && 'motion-safe:animate-pulse')} />
    </button>
  )
}
