import { useMutation } from '@tanstack/react-query'
import { Download, RotateCcw } from 'lucide-react'
import { useId } from 'react'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { ErrorText } from '@renderer/components/ui/section'
import { Select } from '@renderer/components/ui/select'
import { formatWhen } from '@renderer/lib/backup'
import { isMac } from '@renderer/lib/platform'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'
import { useToast } from '@renderer/lib/toast'
import { setUpdateState, useUpdates } from '@renderer/lib/updates'
import type { UpdateChannel, UpdateState } from '@shared/api'

function describe(state: UpdateState): string {
  switch (state.status) {
    case 'unavailable':
      return isMac
        ? 'No Mac, a versão nova é instalada por cima desta. Os pacientes e a agenda continuam.'
        : 'Esta instalação não procura versões novas sozinha. A versão nova é instalada por cima desta.'
    case 'checking':
      return 'Procurando versão nova…'
    case 'downloading':
      return `Baixando a versão ${state.next}${state.progress ? ` (${state.progress}%)` : ''}…`
    case 'ready':
      return `A versão ${state.next} está pronta. Ela entra quando o Auri reiniciar ou na próxima vez que for fechado.`
    case 'error':
      return state.error ?? 'Não foi possível procurar a versão nova.'
    default:
      return state.checkedAt
        ? `Esta é a versão mais nova. Procurado ${formatWhen(state.checkedAt)}.`
        : 'O Auri procura versões novas sozinho enquanto está aberto.'
  }
}

const CHANNELS = [
  { value: 'latest', label: 'Estável' },
  { value: 'alpha', label: 'Alpha' }
] as const

function Row({
  title,
  description,
  children
}: {
  title: React.ReactNode
  description: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        <p className="mt-0.5 text-xs text-ink-soft">{description}</p>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

export function GeneralPage(): React.JSX.Element {
  const state = useUpdates()
  const toast = useToast()
  const channelId = useId()
  const check = useMutation({
    mutationFn: () => window.updates.check(),
    onSuccess: (next) => {
      setUpdateState(next)
      if (next.status === 'idle') toast({ title: 'Esta é a versão mais nova' })
    }
  })
  const install = useMutation({ mutationFn: () => window.updates.install() })
  const channel = useMutation({
    mutationFn: (next: UpdateChannel) => window.updates.setChannel(next),
    onSuccess: setUpdateState
  })
  const busy = state?.status === 'checking' || check.isPending
  return (
    <Page trail={[SETTINGS_CRUMB, { label: 'Geral' }]}>
      <div className="mx-auto max-w-[720px] px-8 pt-8 pb-16">
        <h2 className="text-[13px] font-medium">Sobre</h2>
        {state && (
          <div className="mt-3 flex flex-col gap-6 rounded-card bg-fill p-5">
            <Row
              title={
                <>
                  Versão{' '}
                  <span className="ml-1 font-mono text-xs text-ink-soft">{state.version}</span>
                </>
              }
              description={describe(state)}
            >
              {state.status === 'ready' ? (
                <Button loading={install.isPending} onClick={() => install.mutate()}>
                  {!install.isPending && <RotateCcw />} Reiniciar e atualizar
                </Button>
              ) : (
                state.status !== 'unavailable' && (
                  <Button
                    variant="secondary"
                    loading={busy}
                    disabled={state.status === 'downloading'}
                    onClick={() => check.mutate()}
                  >
                    {!busy && <Download />} Procurar atualizações
                  </Button>
                )
              )}
            </Row>
            {state.status !== 'unavailable' && (
              <Row
                title={<label htmlFor={channelId}>Canal de atualização</label>}
                description={
                  state.channel === 'alpha'
                    ? 'Uma versão nova por dia, com as novidades antes. Pode ter erros: volte para Estável quando quiser.'
                    : 'Só as versões estáveis, que já foram usadas no alpha.'
                }
              >
                <div className="w-36">
                  <Select
                    id={channelId}
                    value={state.channel}
                    options={CHANNELS}
                    disabled={
                      channel.isPending ||
                      state.status === 'downloading' ||
                      state.status === 'ready'
                    }
                    onValueChange={(next) => channel.mutate(next as UpdateChannel)}
                  />
                </div>
              </Row>
            )}
          </div>
        )}
        {(check.error ?? install.error ?? channel.error) && (
          <ErrorText>{(check.error ?? install.error ?? channel.error)?.message}</ErrorText>
        )}
      </div>
    </Page>
  )
}
