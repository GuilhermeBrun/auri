import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, FileUp, RotateCcw } from 'lucide-react'
import { useId } from 'react'
import { Page } from '@renderer/components/Layout'
import { ImportButton, ImportPreview } from '@renderer/components/SettingsImport'
import { Button } from '@renderer/components/ui/button'
import { ErrorText, PageSection } from '@renderer/components/ui/section'
import { Select } from '@renderer/components/ui/select'
import { SwitchField } from '@renderer/components/ui/switch'
import { formatWhen } from '@renderer/lib/backup'
import { isMac } from '@renderer/lib/platform'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'
import { useSettingsImport } from '@renderer/lib/settings-import'
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

function ErrorReports(): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const toast = useToast()
  const info = useQuery({
    queryKey: ['reports'],
    queryFn: () => window.reports.info(),
    staleTime: 0
  })
  const enable = useMutation({
    mutationFn: (on: boolean) => window.reports.setEnabled(on),
    onSuccess: (next) => queryClient.setQueryData(['reports'], next)
  })
  const copy = useMutation({
    mutationFn: () => window.reports.copy(),
    onSuccess: () =>
      toast({ title: 'Relatório copiado', description: 'Cole na conversa com o suporte.' })
  })
  if (!info.data) return null
  const { enabled, count } = info.data
  return (
    <PageSection
      id="relatorios"
      title="Relatórios de erro"
      description="O que o Auri avisa à equipe quando algo dá errado."
    >
      <div className="mt-6 flex flex-col gap-6">
        <SwitchField
          label="Enviar relatórios de erro"
          description={
            enabled
              ? 'Quando algo falha, o Auri manda sozinho para a equipe o tipo do erro e o ponto do código onde ele aconteceu. Nenhum dado de paciente vai junto.'
              : 'Desligado: as falhas ficam só neste computador.'
          }
          checked={enabled}
          disabled={enable.isPending}
          onCheckedChange={(on) => enable.mutate(on)}
        />
        {count > 0 && (
          <Row
            title="Falhas neste computador"
            description={`${count === 1 ? '1 falha guardada' : `${count} falhas guardadas`}. O texto copiado também não tem dados de pacientes.`}
          >
            <Button variant="secondary" loading={copy.isPending} onClick={() => copy.mutate()}>
              <Copy /> Copiar relatório
            </Button>
          </Row>
        )}
        {(enable.error ?? copy.error) && (
          <ErrorText>{(enable.error ?? copy.error)?.message}</ErrorText>
        )}
      </div>
    </PageSection>
  )
}

function Transfer(): React.JSX.Element {
  const toast = useToast()
  const importing = useSettingsImport()
  const exportFile = useMutation({
    mutationFn: () => window.transfer.exportSettings(),
    onSuccess: (file) => {
      if (file) {
        toast({ title: 'Configurações exportadas', description: file.split(/[\\/]/).pop() })
      }
    }
  })
  return (
    <PageSection
      id="levar"
      title="Levar para outro computador"
      description="As configurações deste computador num arquivo, para abrir no outro: aparência, opções da conexão e escolhas da cópia de segurança. Não vão pacientes, senhas, chaves nem a lista de computadores conectados."
    >
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={exportFile.isPending}
          onClick={() => exportFile.mutate()}
        >
          <FileUp /> Exportar configurações…
        </Button>
        {!importing.preview && <ImportButton state={importing} />}
      </div>
      <ImportPreview state={importing} className="mt-4" />
      {exportFile.error && <ErrorText>{exportFile.error.message}</ErrorText>}
    </PageSection>
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
        <p className="text-[13px] text-ink-soft">
          O que vale para o Auri todo: versão, configurações e relatórios de erro.
        </p>
        <div className="mt-8 flex flex-col gap-14">
          <PageSection
            id="atualizacoes"
            title="Atualizações"
            description="A versão instalada e como as novas chegam."
          >
            {state && (
              <div className="mt-6 flex flex-col gap-6">
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
                      <RotateCcw /> Reiniciar e atualizar
                    </Button>
                  ) : (
                    state.status !== 'unavailable' && (
                      <Button
                        variant="secondary"
                        loading={busy}
                        disabled={state.status === 'downloading'}
                        onClick={() => check.mutate()}
                      >
                        <Download /> Procurar atualizações
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
          </PageSection>
          <Transfer />
          <ErrorReports />
        </div>
      </div>
    </Page>
  )
}
