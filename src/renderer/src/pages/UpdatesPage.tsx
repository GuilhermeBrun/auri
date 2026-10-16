import { useMutation } from '@tanstack/react-query'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { ErrorText, SectionTitle } from '@renderer/components/ui/section'
import { SwitchField } from '@renderer/components/ui/switch'
import { formatWhen } from '@renderer/lib/backup'
import { isMac } from '@renderer/lib/platform'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'
import { setUpdateState, useUpdates } from '@renderer/lib/updates'
import type { UpdateChannel, UpdateState } from '@shared/api'

/** A frase do estado, embaixo da versão instalada. */
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

/**
 * Configurações → Atualizações: a versão instalada e a troca pela nova. O Auri procura e baixa
 * sozinho; aqui dá para procurar na hora e reiniciar já com a versão nova.
 */
export function UpdatesPage(): React.JSX.Element {
  const state = useUpdates()
  const check = useMutation({
    mutationFn: () => window.updates.check(),
    onSuccess: setUpdateState
  })
  const install = useMutation({ mutationFn: () => window.updates.install() })
  const channel = useMutation({
    mutationFn: (next: UpdateChannel) => window.updates.setChannel(next),
    onSuccess: setUpdateState
  })
  return (
    <Page trail={[SETTINGS_CRUMB, { label: 'Atualizações' }]}>
      <div className="mx-auto max-w-[720px] px-8 pt-8 pb-16">
        <p className="text-[13px] text-ink-soft">
          As versões novas do Auri. Os pacientes, a agenda e as configurações continuam como estão.
        </p>
        {state && (
          <section className="mt-8">
            <SectionTitle title={`Versão ${state.version}`}>{describe(state)}</SectionTitle>
            {state.status === 'ready' ? (
              <Button className="mt-3" loading={install.isPending} onClick={() => install.mutate()}>
                {!install.isPending && <RotateCcw />} Reiniciar e atualizar
              </Button>
            ) : (
              state.status !== 'unavailable' && (
                <Button
                  variant="secondary"
                  className="mt-3"
                  loading={state.status === 'checking' || check.isPending}
                  disabled={state.status === 'downloading'}
                  onClick={() => check.mutate()}
                >
                  {state.status !== 'checking' && !check.isPending && <RefreshCw />} Procurar agora
                </Button>
              )
            )}
            {(check.error ?? install.error) && (
              <ErrorText>{(check.error ?? install.error)?.message}</ErrorText>
            )}
          </section>
        )}
        {/* Sem atualização automática (Mac), não há canal a escolher. */}
        {state && state.status !== 'unavailable' && (
          <section className="mt-10">
            <SwitchField
              label="Receber versões beta"
              description={
                state.channel === 'beta'
                  ? 'Uma versão nova por dia, com as novidades antes. Pode ter erros: desligue para voltar à versão estável.'
                  : 'Só as versões estáveis, que já foram usadas no beta.'
              }
              checked={state.channel === 'beta'}
              disabled={
                channel.isPending || state.status === 'downloading' || state.status === 'ready'
              }
              onCheckedChange={(on) => channel.mutate(on ? 'beta' : 'latest')}
            />
            {channel.error && <ErrorText>{channel.error.message}</ErrorText>}
          </section>
        )}
      </div>
    </Page>
  )
}
