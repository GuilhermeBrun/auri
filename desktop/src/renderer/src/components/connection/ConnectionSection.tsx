import { useMutation } from '@tanstack/react-query'
import { Check, HardDrive, Laptop, Plus, RotateCw } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { ConfirmAction } from '@renderer/components/ui/confirm-action'
import { Field, Input } from '@renderer/components/ui/input'
import { Loading } from '@renderer/components/ui/loading'
import {
  ErrorText,
  GroupText,
  PageSection,
  SettingsGroup,
  StatusDot
} from '@renderer/components/ui/section'
import { Sensitive } from '@renderer/components/ui/sensitive'
import { SwitchField } from '@renderer/components/ui/switch'
import { useConnection } from '@renderer/lib/connection'
import { isMac } from '@renderer/lib/platform'
import { useToast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import type {
  ConnectionInfo,
  ConnectionRole,
  FoundServer,
  LinkStatus,
  PairedDevice,
  PairingCode,
  RemoteReach
} from '@shared/api'

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function formatSeen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const ROLE_OPTIONS: {
  value: ConnectionRole
  label: string
  description: string
  icon: ReactNode
}[] = [
  {
    value: 'server',
    label: 'Este computador guarda os dados',
    description: 'Os pacientes e a agenda ficam aqui.',
    icon: <HardDrive />
  },
  {
    value: 'client',
    label: 'Usar os dados de outro computador',
    description: 'Como o consultório usando os da recepção.',
    icon: <Laptop />
  }
]

function RolePicker({ role }: { role: ConnectionRole }): React.JSX.Element {
  const change = useMutation({
    mutationFn: (next: ConnectionRole) => window.connection.setRole(next)
  })
  return (
    <fieldset disabled={change.isPending}>
      <legend className="sr-only">Onde ficam os dados</legend>
      <div className="grid grid-cols-2 gap-3">
        {ROLE_OPTIONS.map(({ value, label, description, icon }) => {
          const selected = role === value
          return (
            <label
              key={value}
              className={cn(
                'group flex cursor-pointer flex-col rounded-card p-4 transition-[background-color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                selected
                  ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
                  : 'shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-fill'
              )}
            >
              <input
                type="radio"
                name="papel"
                value={value}
                checked={selected}
                onChange={() => change.mutate(value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex items-center justify-between text-ink-soft [&_svg]:size-[18px] [&_svg]:stroke-[1.75]"
              >
                {icon}
                {selected && <Check className="animate-fade-in text-ink" />}
              </span>
              <span className="mt-3 text-[13px] font-medium">{label}</span>
              <span className="mt-1 text-xs text-ink-soft">{description}</span>
            </label>
          )
        })}
      </div>
      {change.error && <ErrorText>{change.error.message}</ErrorText>}
    </fieldset>
  )
}

function PairingPanel({ devices }: { devices: PairedDevice[] }): React.JSX.Element {
  const [shown, setShown] = useState<{ code: PairingCode; known: string[] } | null>(null)
  const toast = useToast()
  const now = useNow(shown !== null)

  const create = useMutation({
    mutationFn: () => window.connection.createCode(),
    onSuccess: (next) => setShown({ code: next, known: devices.map((d) => d.publicKey) })
  })

  const cancel = (): void => {
    setShown(null)
    void window.connection.cancelCode()
  }

  const added = shown ? devices.find((d) => !shown.known.includes(d.publicKey)) : undefined
  const remaining = shown ? Math.max(0, Math.ceil((shown.code.expiresAt - now) / 1000)) : 0
  const code = shown && !added && remaining > 0 ? shown.code : null

  const addedName = added?.name
  useEffect(() => {
    if (addedName) toast({ title: 'Computador conectado', description: addedName })
  }, [addedName, toast])

  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setShown(null), shown.code.expiresAt - Date.now())
    return () => clearTimeout(timer)
  }, [shown])

  useEffect(
    () => () => {
      void window.connection.cancelCode()
    },
    []
  )

  if (!code) {
    return (
      <div className="mt-4">
        <Button variant="secondary" loading={create.isPending} onClick={() => create.mutate()}>
          <Plus /> Conectar computador
        </Button>
        {create.error && <ErrorText>{create.error.message}</ErrorText>}
      </div>
    )
  }

  const minutes = Math.floor(remaining / 60)
  const seconds = String(remaining % 60).padStart(2, '0')
  return (
    <div className="mt-4 animate-fade-in rounded-card bg-surface p-5">
      <p className="text-xs text-ink-soft">
        No outro computador, em Armazenamento, escolha “Usar os dados de outro computador”.
      </p>
      <Sensitive
        label="Código de conexão"
        what="o código"
        className="mt-3 font-mono text-2xl font-semibold tracking-[0.12em]"
      >
        {code.code}
      </Sensitive>
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-xs text-ink-soft tabular-nums">
          Vale por {minutes}:{seconds} e uma vez só.
        </span>
        <Button variant="secondary" onClick={cancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function DeviceList({ devices }: { devices: PairedDevice[] }): React.JSX.Element {
  const [confirming, setConfirming] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: (key: string) => window.connection.removeDevice(key),
    onSuccess: () => setConfirming(null)
  })
  return (
    <SettingsGroup label="Computadores conectados">
      {devices.length === 0 && (
        <GroupText>
          Nenhum ainda. Use “Conectar computador” e digite o código no outro computador.
        </GroupText>
      )}
      {devices.length > 0 && (
        <ul className="flex flex-col gap-3">
          {devices.map((device) => (
            <li key={device.publicKey} className="flex min-h-8 items-center gap-3">
              <span className="flex self-start pt-[5px]">
                <StatusDot on={device.online} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{device.name}</p>
                <p className="text-xs text-ink-soft">
                  {device.online
                    ? 'Conectado agora'
                    : device.lastSeen
                      ? `Visto por último em ${formatSeen(device.lastSeen)}`
                      : 'Ainda não conectou'}
                </p>
              </div>
              <ConfirmAction
                confirming={confirming === device.publicKey}
                onConfirmingChange={(on) => setConfirming(on ? device.publicKey : null)}
                question="Cortar o acesso?"
                confirmLabel="Remover"
                loading={remove.isPending}
                onConfirm={() => remove.mutate(device.publicKey)}
              >
                Remover
              </ConfirmAction>
            </li>
          ))}
        </ul>
      )}
      {remove.error && <ErrorText>{remove.error.message}</ErrorText>}
    </SettingsGroup>
  )
}

function ServerSection({ info }: { info: ConnectionInfo }): React.JSX.Element {
  const sharing = useMutation({ mutationFn: (on: boolean) => window.connection.setSharing(on) })
  const keepRunning = useMutation({
    mutationFn: (on: boolean) => window.connection.setKeepRunning(on)
  })
  const openAtLogin = useMutation({
    mutationFn: (on: boolean) => window.connection.setOpenAtLogin(on)
  })
  const remoteAccess = useMutation({
    mutationFn: (on: boolean) => window.connection.setRemoteAccess(on)
  })
  const live = info.sharing && !info.sharingError

  return (
    <>
      <SettingsGroup label="Rede">
        <SwitchField
          label="Compartilhar com outros computadores da rede"
          description={info.sharing ? 'Só com código, e tudo viaja cifrado.' : undefined}
          checked={info.sharing}
          disabled={sharing.isPending}
          onCheckedChange={(on) => sharing.mutate(on)}
        />
        {(info.sharingError ?? sharing.error?.message) && (
          <ErrorText>{info.sharingError ?? sharing.error?.message}</ErrorText>
        )}
        {live && (
          <>
            <p className="mt-3 text-xs text-ink-soft">
              {info.addresses.length > 0 && (
                <>
                  Endereço deste computador:{' '}
                  <Sensitive
                    label="Endereço deste computador"
                    what="o endereço"
                    className="font-medium text-ink"
                  >
                    {info.addresses.join(', ')}
                  </Sensitive>
                  .{' '}
                </>
              )}
              {!isMac && 'Se o Windows perguntar, permita em redes privadas.'}
            </p>
            <PairingPanel devices={info.devices} />
          </>
        )}
      </SettingsGroup>
      {(info.sharing || info.devices.length > 0) && <DeviceList devices={info.devices} />}
      {info.sharing && (
        <SettingsGroup label="Acesso dos outros computadores" className="flex flex-col gap-5">
          <div>
            <SwitchField
              label="Permitir acesso de fora da clínica"
              checked={info.remoteAccess}
              disabled={remoteAccess.isPending}
              onCheckedChange={(on) => remoteAccess.mutate(on)}
            />
            {info.remoteReach && <RemoteReachText reach={info.remoteReach} />}
          </div>
          <SwitchField
            label="Continuar rodando ao fechar a janela"
            description={isMac ? 'Fica na barra de menus.' : 'Fica na bandeja, perto do relógio.'}
            checked={info.keepRunning}
            disabled={keepRunning.isPending}
            onCheckedChange={(on) => keepRunning.mutate(on)}
          />
          <SwitchField
            label="Abrir ao ligar o computador"
            checked={info.openAtLogin}
            disabled={openAtLogin.isPending}
            onCheckedChange={(on) => openAtLogin.mutate(on)}
          />
        </SettingsGroup>
      )}
    </>
  )
}

const REACH_TEXT: Record<RemoteReach, string> = {
  starting: 'Verificando a internet desta rede…',
  open: 'Disponível de fora da clínica.',
  likely: 'Disponível de fora da clínica na maioria das redes.',
  restricted: 'Rede restritiva: de fora, pode não conectar.',
  offline: 'Sem internet agora. Dentro da clínica continua funcionando.'
}

function RemoteReachText({ reach }: { reach: RemoteReach }): React.JSX.Element {
  const good = reach === 'open' || reach === 'likely'
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
      <StatusDot on={good} />
      <span className="-mt-[3px]">{REACH_TEXT[reach]}</span>
    </p>
  )
}

function RemoteTest(): React.JSX.Element {
  const test = useMutation({ mutationFn: () => window.connection.testRemote() })
  const result = test.data
  return (
    <SettingsGroup label="Acesso de fora da clínica">
      <GroupText>Para valer, ligue este computador em outra rede antes.</GroupText>
      <Button
        variant="secondary"
        className="mt-3"
        loading={test.isPending}
        onClick={() => test.mutate()}
      >
        Testar acesso pela internet
      </Button>
      {result?.ok && (
        <p role="status" className="mt-2 flex animate-fade-in items-center gap-1.5 text-xs">
          <Check className="size-3.5 stroke-[2]" aria-hidden="true" />
          Conectou pela internet em{' '}
          {(result.ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s.
        </p>
      )}
      {result && !result.ok && <ErrorText>{result.error}</ErrorText>}
      {test.error && <ErrorText>{test.error.message}</ErrorText>}
    </SettingsGroup>
  )
}

const STATUS_TEXT: Record<LinkStatus, string> = {
  local: '',
  unpaired: '',
  connecting: 'Conectando…',
  connected: 'Conectado',
  offline: 'Sem conexão. Tentando de novo…',
  version: 'Versões diferentes do Auri. Atualize os dois.',
  revoked: 'Removido lá. Conecte de novo com um código novo.'
}

function LinkedServer({
  info,
  server
}: {
  info: ConnectionInfo
  server: NonNullable<ConnectionInfo['server']>
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const forget = useMutation({ mutationFn: () => window.connection.forget() })
  const canRetry = info.status === 'offline' || info.status === 'version'
  return (
    <>
      <SettingsGroup label="Usando os dados de">
        <div className="flex items-center gap-3">
          <span className="flex self-start pt-[5px]">
            <StatusDot on={info.status === 'connected'} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{server.name}</p>
            <p className="text-xs text-ink-soft">
              {info.status === 'connected'
                ? info.via === 'internet'
                  ? 'Conectado pela internet'
                  : 'Conectado pela rede da clínica'
                : STATUS_TEXT[info.status]}
              {server.address && info.status === 'connected' && info.via === 'local' && (
                <>
                  {' · '}
                  <Sensitive label={`Endereço de ${server.name}`} what="o endereço">
                    {server.address}
                  </Sensitive>
                </>
              )}
            </p>
          </div>
          {!confirming && (
            <div className="flex items-center gap-2">
              {canRetry && (
                <Button variant="secondary" onClick={() => void window.connection.retry()}>
                  <RotateCw /> Tentar agora
                </Button>
              )}
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Desconectar
              </Button>
            </div>
          )}
        </div>
        {confirming && (
          <div className="mt-4 animate-fade-in rounded-card bg-surface p-4">
            <p className="text-xs text-ink-soft">
              Para voltar, precisa de um código novo de {server.name}.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
              <Button variant="danger" loading={forget.isPending} onClick={() => forget.mutate()}>
                Desconectar
              </Button>
            </div>
          </div>
        )}
        {forget.error && <ErrorText>{forget.error.message}</ErrorText>}
      </SettingsGroup>
      <RemoteTest />
    </>
  )
}

function FindServer(): React.JSX.Element {
  const toast = useToast()
  const [found, setFound] = useState<FoundServer[] | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [address, setAddress] = useState('')
  const [code, setCode] = useState('')

  const search = useMutation({
    mutationFn: () => window.connection.discover(),
    onSuccess: (servers) => {
      setFound(servers)
      if (servers.length === 1 && !manual) setTarget(`${servers[0].host}:${servers[0].port}`)
    }
  })
  const { mutate: discover } = search
  useEffect(() => discover(), [discover])

  const pair = useMutation({
    mutationFn: () => window.connection.pair(manual ? address : target!, code),
    onSuccess: (info) => toast({ title: 'Conectado', description: info.server?.name })
  })

  const chosen = manual ? address.trim() !== '' : target !== null
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (chosen && code.trim()) pair.mutate()
  }

  return (
    <SettingsGroup label="Computadores na rede">
      {!manual && (
        <div>
          {found === null ? (
            <p className="text-xs text-ink-soft">Procurando…</p>
          ) : found.length === 0 ? (
            <p className="text-xs text-ink-soft">
              Nenhum encontrado. Confira o compartilhamento no outro computador.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Computador" className="flex flex-col gap-1">
              {found.map((server) => {
                const value = `${server.host}:${server.port}`
                const selected = target === value
                return (
                  <button
                    key={server.publicKey}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTarget(value)}
                    className={cn(
                      'flex h-11 items-center gap-3 rounded-control px-3 text-left transition-colors',
                      selected ? 'bg-fill-hover' : 'hover:bg-fill'
                    )}
                  >
                    <Laptop
                      className="size-4 shrink-0 stroke-[1.75] text-ink-soft"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {server.name}
                    </span>
                    {selected && <Check className="size-4 stroke-[1.75]" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {!manual && (
          <Button variant="secondary" loading={search.isPending} onClick={() => search.mutate()}>
            <RotateCw /> Procurar de novo
          </Button>
        )}
        <Button variant="secondary" onClick={() => setManual((m) => !m)}>
          {manual ? 'Escolher da lista' : 'Digitar o endereço'}
        </Button>
      </div>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        {manual && (
          <Field label="Endereço" hint="em Armazenamento, no outro computador">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="192.168.0.12"
              autoFocus
              spellCheck={false}
            />
          </Field>
        )}
        {chosen && (
          <Field label="Código" hint="em “Conectar computador”, no outro">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX XXXX XXXX"
              maxLength={20}
              autoFocus={!manual}
              spellCheck={false}
              autoComplete="off"
              className="font-mono tracking-[0.08em]"
            />
          </Field>
        )}
        {chosen && (
          <div>
            <Button type="submit" loading={pair.isPending} disabled={!code.trim()}>
              Conectar
            </Button>
          </div>
        )}
        {pair.error && <ErrorText>{pair.error.message}</ErrorText>}
      </form>
    </SettingsGroup>
  )
}

function NameField({ name }: { name: string }): React.JSX.Element {
  const [value, setValue] = useState(name)
  const save = useMutation({ mutationFn: (next: string) => window.connection.setName(next) })
  const commit = (): void => {
    const next = value.trim()
    if (!next) setValue(name)
    else if (next !== name) save.mutate(next)
  }
  return (
    <SettingsGroup label="Este computador">
      <Field label="Nome" error={save.error?.message}>
        <Input
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </Field>
    </SettingsGroup>
  )
}

export function ConnectionSection(): React.JSX.Element {
  const { info } = useConnection()
  return (
    <PageSection id="conexao" title="Conexão">
      {info ? (
        <>
          <SettingsGroup label="Onde ficam os dados">
            <RolePicker role={info.role} />
            {info.role === 'client' && (
              <p className="mt-3 text-xs text-ink-soft">
                Os dados que já estavam aqui continuam guardados.
              </p>
            )}
          </SettingsGroup>
          {info.role === 'server' ? (
            <ServerSection info={info} />
          ) : info.server ? (
            <LinkedServer info={info} server={info.server} />
          ) : (
            <FindServer />
          )}
          <NameField key={info.name} name={info.name} />
        </>
      ) : (
        <Loading />
      )}
    </PageSection>
  )
}
