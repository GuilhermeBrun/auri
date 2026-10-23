import type { IpcResult } from '../shared/api'

export const RECEPTION_BLOCKED =
  'Este é o computador da recepção: a anamnese e as evoluções não abrem aqui.'

export const RECEPTION_SETTINGS_BLOCKED =
  'Este é o computador da recepção: as configurações da clínica e do financeiro não mudam aqui.'

export const RECEPTION_STORAGE_BLOCKED =
  'Este é o computador da recepção: a conexão, a cópia de segurança e a importação de configurações não mudam aqui.'

export const RECEPTION_LOCKED = new Set([
  'clinic:chooseLogo',
  'connection:setRole',
  'connection:setName',
  'connection:setSharing',
  'connection:setKeepRunning',
  'connection:setOpenAtLogin',
  'connection:setRemoteAccess',
  'connection:createCode',
  'connection:cancelCode',
  'connection:removeDevice',
  'connection:pair',
  'connection:forget',
  'backup:install',
  'backup:chooseFolder',
  'backup:setup',
  'backup:setDestination',
  'backup:setFrequency',
  'backup:changePassword',
  'backup:resetPassword',
  'backup:newRecoveryCode',
  'backup:printRecoveryCode',
  'backup:disable',
  'backup:pickFile',
  'backup:restore',
  'backup:undoRestore',
  'transfer:pick',
  'transfer:apply'
])

const CLINICAL = ['anamneses:get', 'anamneses:save', 'documents:anamnese', 'documents:evolutions']

const SETTINGS = [
  'clinic:save',
  'tipos:save',
  'tipos:remove',
  'terms:measureModel',
  'terms:saveModel',
  'terms:archiveModel',
  'finance:saveService',
  'finance:archiveService',
  'finance:savePlan',
  'finance:archivePlan',
  'finance:saveInsurer',
  'finance:archiveInsurer'
]

const BLOCKED = new Map([
  ...CLINICAL.map((channel) => [channel, RECEPTION_BLOCKED] as const),
  ...SETTINGS.map((channel) => [channel, RECEPTION_SETTINGS_BLOCKED] as const)
])

type Call = (channel: string, args: unknown[]) => Promise<IpcResult<unknown>>

function withoutEvolution(args: unknown[], index: number): unknown[] {
  const input = args[index]
  if (typeof input !== 'object' || input === null) return args
  const { evolucao: _, ...rest } = input as Record<string, unknown>
  return args.map((arg, i) => (i === index ? rest : arg))
}

export function restrictArgs(channel: string, args: unknown[]): unknown[] {
  switch (channel) {
    case 'appointments:create':
      return withoutEvolution(args, 0)
    case 'appointments:scheduleOnReserve':
    case 'appointments:update':
      return withoutEvolution(args, 1)
    case 'appointments:remove':
      return [args[0], true]
    default:
      return args
  }
}

export function redactEvolution(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactEvolution)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === 'evolucao' && typeof item === 'string' ? '' : redactEvolution(item)
    ])
  )
}

export async function callAsReception(
  call: Call,
  channel: string,
  args: unknown[]
): Promise<IpcResult<unknown>> {
  const blocked = BLOCKED.get(channel)
  if (blocked) return { ok: false, error: blocked }
  const result = await call(channel, restrictArgs(channel, args))
  return result.ok ? { ok: true, data: redactEvolution(result.data) } : result
}
