import { useMutation, useQuery } from '@tanstack/react-query'
import { Cloud, FolderOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { ErrorText, StatusDot } from '@renderer/components/ui/section'
import { isMac } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import type { BackupDestination, CloudProvider, CloudState } from '@shared/api'

const STATE_TEXT: Record<CloudState, string> = {
  ready: 'Pronto para usar',
  'signed-out': 'Instalado, falta entrar na conta',
  off: 'Desligado neste Mac',
  denied: 'O macOS bloqueou o acesso do Auri',
  'not-installed': 'Não instalado'
}

/** O que fazer para a nuvem ficar pronta (enquanto o Auri não faz por você). */
function hint(provider: CloudProvider): string {
  switch (provider.state) {
    case 'signed-out':
      return `Abra o ${provider.name} e entre com sua conta. O Auri percebe sozinho.`
    case 'off':
      return 'Ligue em Ajustes do Sistema › seu nome › iCloud › iCloud Drive.'
    case 'denied':
      return 'Permita em Ajustes do Sistema › Privacidade e Segurança › Arquivos e Pastas.'
    case 'not-installed':
      return `Instale o ${provider.name} pelo site oficial.`
    case 'ready':
      return ''
  }
}

/** Nuvem recomendada: a sugerida (configurações importadas) se pronta, senão a primeira pronta. */
function recommended(
  providers: CloudProvider[],
  suggested: BackupDestination['kind'] | null
): CloudProvider | undefined {
  const ready = providers.filter((p) => p.state === 'ready')
  return ready.find((p) => p.id === suggested) ?? ready[0]
}

/** Cartão de uma nuvem: pronta, é um botão que a escolhe; senão, mostra o que falta. */
function ProviderCard({
  provider,
  recommended: isRecommended,
  onPick,
  action
}: {
  provider: CloudProvider
  recommended: boolean
  onPick: (destination: BackupDestination) => void
  action?: ReactNode
}): React.JSX.Element {
  const ready = provider.state === 'ready' && provider.folder
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex items-center justify-between text-ink-soft [&_svg]:size-[18px] [&_svg]:stroke-[1.75]"
      >
        <Cloud />
        {isRecommended && <span className="text-xs font-medium text-ink">Recomendado</span>}
      </span>
      <span className="mt-3 text-[13px] font-medium">{provider.name}</span>
      <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
        <StatusDot on={!!ready} />
        {STATE_TEXT[provider.state]}
      </span>
    </>
  )
  const cardClass =
    'flex flex-col rounded-card p-4 text-left transition-[background-color,box-shadow] duration-150'
  if (ready) {
    return (
      <button
        type="button"
        onClick={() => onPick({ kind: provider.id, folder: provider.folder! })}
        className={cn(
          cardClass,
          'cursor-pointer hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          isRecommended
            ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
            : 'shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
        )}
      >
        {body}
        <span className="mt-3 text-xs font-medium text-ink">Usar o {provider.name} →</span>
      </button>
    )
  }
  return (
    <div className={cn(cardClass, 'shadow-[inset_0_0_0_1px_var(--color-line)]')}>
      {body}
      <div className="mt-3 flex flex-1 flex-col justify-end">
        {action ?? <p className="text-xs text-ink-soft">{hint(provider)}</p>}
      </div>
    </div>
  )
}

/**
 * Onde guardar as cópias: um cartão por nuvem (Google Drive, OneDrive e, no Mac, iCloud Drive)
 * com a situação dela neste computador, e "Outra pasta…" para pendrive ou HD. Enquanto está na
 * tela, procura de novo a cada 3 segundos: instalou ou entrou na conta, o cartão fica pronto.
 */
export function DestinationPicker({
  onPick,
  suggested = null
}: {
  onPick: (destination: BackupDestination) => void
  suggested?: BackupDestination['kind'] | null
}): React.JSX.Element {
  const providers = useQuery({
    queryKey: ['cloud-providers'],
    queryFn: () => window.backup.providers(),
    refetchInterval: 3000,
    refetchOnWindowFocus: true
  })
  const choose = useMutation({
    mutationFn: () => window.backup.chooseFolder(),
    onSuccess: (folder) => folder && onPick({ kind: 'folder', folder })
  })
  const list = providers.data ?? []
  const best = recommended(list, suggested)

  return (
    <div>
      {providers.isPending ? (
        <p className="text-xs text-ink-soft">
          Procurando Google Drive, OneDrive{isMac && ' e iCloud'}…
        </p>
      ) : (
        <div className={cn('grid gap-3', list.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {list.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              recommended={provider.id === best?.id}
              onPick={onPick}
            />
          ))}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 -ml-2.5"
        loading={choose.isPending}
        onClick={() => choose.mutate()}
      >
        {!choose.isPending && <FolderOpen />} Outra pasta (pendrive, HD externo)…
      </Button>
      {(choose.error ?? providers.error) && (
        <ErrorText>{(choose.error ?? providers.error)!.message}</ErrorText>
      )}
    </div>
  )
}
