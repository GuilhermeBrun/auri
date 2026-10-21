import { useMutation, useQuery } from '@tanstack/react-query'
import { Cloud, FolderOpen } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { ErrorText, StatusDot } from '@renderer/components/ui/section'
import { isMac } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useInstallProgress } from '@renderer/lib/backup'
import { useToast } from '@renderer/lib/toast'
import type { BackupDestination, CloudProvider, CloudState, InstallProgress } from '@shared/api'

const STATE_TEXT: Record<CloudState, string> = {
  ready: 'Pronto para usar',
  'signed-out': 'Instalado, falta entrar na conta',
  closed: 'Instalado, mas fechado',
  off: 'Desligado neste Mac',
  denied: 'O macOS bloqueou o acesso do Auri',
  'not-installed': 'Não instalado'
}

const ACTION: Record<
  Exclude<CloudState, 'ready'>,
  { label: (name: string) => string; after: (name: string) => string }
> = {
  'not-installed': {
    label: () => 'Instalar',
    after: (name) => `Siga o instalador e entre com sua conta no ${name}.`
  },
  'signed-out': {
    label: (name) => `Abrir o ${name}`,
    after: (name) => `Entre com sua conta na janela do ${name}.`
  },
  closed: {
    label: (name) => `Abrir o ${name}`,
    after: (name) => `Espere o ${name} terminar de abrir.`
  },
  off: {
    label: () => 'Abrir Ajustes',
    after: () => 'Ligue o iCloud Drive nos Ajustes do Sistema.'
  },
  denied: {
    label: () => 'Abrir Ajustes',
    after: () => 'Em Arquivos e Pastas, permita o acesso do Auri.'
  }
}

function progressText(progress: InstallProgress): string {
  if (progress.stage === 'downloading') {
    return progress.progress === null
      ? 'Baixando o instalador…'
      : `Baixando o instalador… ${Math.floor(progress.progress * 100)}%`
  }
  return 'Abrindo o instalador…'
}

export function ProviderAction({
  provider,
  progress,
  started,
  onStart
}: {
  provider: CloudProvider
  progress: InstallProgress | undefined
  started: boolean
  onStart: () => void
}): React.JSX.Element {
  const state = provider.state as Exclude<CloudState, 'ready'>
  const action = useMutation({
    mutationFn: () =>
      state === 'not-installed'
        ? window.backup.install(provider.id)
        : window.backup.openProvider(provider.id),
    onMutate: onStart
  })
  const busy =
    action.isPending && (progress?.stage === 'downloading' || progress?.stage === 'opening')
  if (busy) {
    const fraction = progress?.stage === 'downloading' ? progress.progress : null
    return (
      <div role="status" className="animate-fade-in">
        <p className="text-xs text-ink-soft tabular-nums">{progressText(progress!)}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-fill-hover">
          <div
            className="h-full bg-ink transition-[width] duration-300"
            style={{ width: `${Math.round((fraction ?? 0) * 100)}%` }}
          />
        </div>
      </div>
    )
  }
  if (action.error) {
    return (
      <div>
        <ErrorText className="mt-0">{action.error.message}</ErrorText>
        {provider.id !== 'icloud' && (
          <a
            href={OFFICIAL_PAGE[provider.id]}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-ink underline-offset-2 hover:underline"
          >
            Abrir o site oficial
          </a>
        )}
      </div>
    )
  }
  return (
    <div>
      {started && (
        <p className="mb-2 animate-fade-in text-xs text-ink-soft">
          {ACTION[state].after(provider.name)}
        </p>
      )}
      <Button variant="secondary" loading={action.isPending} onClick={() => action.mutate()}>
        {started && state === 'not-installed'
          ? 'Tentar de novo'
          : ACTION[state].label(provider.name)}
      </Button>
    </div>
  )
}

const OFFICIAL_PAGE = {
  google: 'https://www.google.com/drive/download/',
  onedrive: 'https://www.microsoft.com/microsoft-365/onedrive/download'
} as const

function recommended(
  providers: CloudProvider[],
  suggested: BackupDestination['kind'] | null
): CloudProvider | undefined {
  const ready = providers.filter((p) => p.state === 'ready')
  return ready.find((p) => p.id === suggested) ?? ready[0]
}

function ProviderCard({
  provider,
  recommended: isRecommended,
  onPick,
  action
}: {
  provider: CloudProvider
  recommended: boolean
  onPick: (destination: BackupDestination) => void
  action: ReactNode
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
      <div className="mt-3 flex flex-1 flex-col justify-end">{action}</div>
    </div>
  )
}

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
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  })
  const choose = useMutation({
    mutationFn: () => window.backup.chooseFolder(),
    onSuccess: (folder) => folder && onPick({ kind: 'folder', folder })
  })
  const list = providers.data ?? []
  const best = recommended(list, suggested)
  const toast = useToast()

  const progress = useInstallProgress()

  const [started, setStarted] = useState<CloudProvider['id'] | null>(null)
  const pickRef = useRef(onPick)
  useEffect(() => {
    pickRef.current = onPick
  })
  const readyStarted = list.find((p) => p.id === started && p.state === 'ready' && p.folder)
  const readyId = readyStarted?.id ?? null
  const readyFolder = readyStarted?.folder ?? null
  const readyName = readyStarted?.name ?? ''
  useEffect(() => {
    if (!readyId || !readyFolder) return
    toast({ title: `Encontramos o ${readyName}` })
    pickRef.current({ kind: readyId, folder: readyFolder })
  }, [readyId, readyFolder, readyName, toast])

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
              action={
                provider.state !== 'ready' && (
                  <ProviderAction
                    provider={provider}
                    progress={progress[provider.id]}
                    started={started === provider.id}
                    onStart={() => setStarted(provider.id)}
                  />
                )
              }
            />
          ))}
        </div>
      )}
      <Button
        variant="ghost"
        className="mt-3"
        loading={choose.isPending}
        onClick={() => choose.mutate()}
      >
        <FolderOpen /> Outra pasta (pendrive, HD externo)…
      </Button>
      {(choose.error ?? providers.error) && (
        <ErrorText>{(choose.error ?? providers.error)!.message}</ErrorText>
      )}
    </div>
  )
}
