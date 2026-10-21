import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, FileUp, RotateCcw } from 'lucide-react'
import { useId, useState } from 'react'
import { Page } from '@renderer/components/Layout'
import { ReceptionDialog, ReceptionPasswordDialog } from '@renderer/components/ReceptionDialog'
import { ImportButton, ImportPreview } from '@renderer/components/SettingsImport'
import { Button } from '@renderer/components/ui/button'
import { ErrorText, PageSection, SettingsGroup } from '@renderer/components/ui/section'
import { Select } from '@renderer/components/ui/select'
import { SwitchField } from '@renderer/components/ui/switch'
import { formatWhen, useBackup } from '@renderer/lib/backup'
import { useReception } from '@renderer/lib/reception'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'
import { useSettingsImport } from '@renderer/lib/settings-import'
import { useToast } from '@renderer/lib/toast'
import { setUpdateState, useUpdates } from '@renderer/lib/updates'
import { setWhatsAppEnabled, useWhatsAppEnabled } from '@renderer/lib/whatsapp'
import type { UpdateChannel, UpdateState } from '@shared/api'

function describe(state: UpdateState): string {
  switch (state.status) {
    case 'unavailable':
      return 'Instale a versão nova por cima desta. Os dados continuam.'
    case 'checking':
      return 'Procurando versão nova…'
    case 'downloading':
      return `Baixando a versão ${state.next}${state.progress ? ` (${state.progress}%)` : ''}…`
    case 'ready':
      return `A versão ${state.next} entra quando o Auri reiniciar.`
    case 'error':
      return state.error ?? 'Não foi possível procurar a versão nova.'
    default:
      return state.checkedAt
        ? `Esta é a versão mais nova. Procurado ${formatWhen(state.checkedAt)}.`
        : ''
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
  description?: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

function WhatsApp(): React.JSX.Element {
  const enabled = useWhatsAppEnabled()
  const toast = useToast()
  return (
    <PageSection id="whatsapp" title="WhatsApp">
      <SettingsGroup>
        <SwitchField
          label="WhatsApp no Auri"
          description={
            enabled
              ? 'No menu lateral, sempre aberto. Desligado, sai da conta e some do Auri.'
              : 'As conversas abrem fora do Auri.'
          }
          checked={enabled}
          onCheckedChange={(on) => {
            setWhatsAppEnabled(on)
            if (!on) toast({ title: 'WhatsApp tirado do Auri' })
          }}
        />
      </SettingsGroup>
    </PageSection>
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
    onSuccess: () => toast({ title: 'Relatório copiado' })
  })
  if (!info.data) return null
  const { enabled, count } = info.data
  return (
    <PageSection id="relatorios" title="Relatórios de erro">
      <SettingsGroup className="flex flex-col gap-5">
        <SwitchField
          label="Enviar relatórios de erro"
          description={
            enabled
              ? 'Só o tipo do erro e onde aconteceu. Nenhum dado de paciente.'
              : 'As falhas ficam só neste computador.'
          }
          checked={enabled}
          disabled={enable.isPending}
          onCheckedChange={(on) => enable.mutate(on)}
        />
        {count > 0 && (
          <Row
            title="Falhas neste computador"
            description={count === 1 ? '1 falha guardada' : `${count} falhas guardadas`}
          >
            <Button variant="secondary" loading={copy.isPending} onClick={() => copy.mutate()}>
              <Copy /> Copiar relatório
            </Button>
          </Row>
        )}
        {(enable.error ?? copy.error) && (
          <ErrorText>{(enable.error ?? copy.error)?.message}</ErrorText>
        )}
      </SettingsGroup>
    </PageSection>
  )
}

function ThisComputer(): React.JSX.Element {
  const reception = useReception()
  const hasPassword = useBackup()?.hasPassword === true
  const [asking, setAsking] = useState<'desligar' | 'criar' | null>(null)
  const toggle = useMutation({
    mutationFn: async (on: boolean) => {
      if (on) await window.prefs.enableReception()
      else await window.prefs.disableReception()
    }
  })
  return (
    <PageSection id="computador" title="Este computador">
      <SettingsGroup className="flex flex-col gap-5">
        <SwitchField
          label="Computador da recepção"
          description={
            reception
              ? `Sem anamnese, evoluções, Clínica e valores.${hasPassword ? ' Desligar pede a senha.' : ''}`
              : undefined
          }
          checked={reception}
          disabled={toggle.isPending}
          onCheckedChange={(on) => {
            if (on && !hasPassword) setAsking('criar')
            else if (!on && hasPassword) setAsking('desligar')
            else toggle.mutate(on)
          }}
        />
        {toggle.error && <ErrorText>{toggle.error.message}</ErrorText>}
      </SettingsGroup>
      <ReceptionDialog open={asking === 'desligar'} onClose={() => setAsking(null)} />
      <ReceptionPasswordDialog open={asking === 'criar'} onClose={() => setAsking(null)} />
    </PageSection>
  )
}

function Transfer(): React.JSX.Element {
  const toast = useToast()
  const importing = useSettingsImport()
  const reception = useReception()
  const exportFile = useMutation({
    mutationFn: () => window.transfer.exportSettings(),
    onSuccess: (file) => {
      if (file) {
        toast({ title: 'Configurações exportadas', description: file.split(/[\\/]/).pop() })
      }
    }
  })
  return (
    <PageSection id="levar" title="Levar para outro computador">
      <SettingsGroup className="flex flex-col gap-5">
        <Row title="Exportar configurações" description="Não vão pacientes, senhas nem chaves.">
          <Button
            variant="secondary"
            loading={exportFile.isPending}
            onClick={() => exportFile.mutate()}
          >
            <FileUp /> Exportar…
          </Button>
        </Row>
        {!reception && (
          <div>
            <Row title="Importar configurações">
              {!importing.preview && <ImportButton state={importing} label="Importar…" />}
            </Row>
            <ImportPreview state={importing} className="mt-4 bg-surface" />
          </div>
        )}
        {exportFile.error && <ErrorText>{exportFile.error.message}</ErrorText>}
      </SettingsGroup>
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
        <div className="flex flex-col gap-14">
          <ThisComputer />
          <PageSection id="atualizacoes" title="Atualizações">
            {state && (
              <SettingsGroup className="flex flex-col gap-5">
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
                      state.channel === 'alpha' ? 'Novidades antes, mas pode ter erros.' : undefined
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
                        compact
                      />
                    </div>
                  </Row>
                )}
                {(check.error ?? install.error ?? channel.error) && (
                  <ErrorText>{(check.error ?? install.error ?? channel.error)?.message}</ErrorText>
                )}
              </SettingsGroup>
            )}
          </PageSection>
          <WhatsApp />
          <Transfer />
          <ErrorReports />
        </div>
      </div>
    </Page>
  )
}
