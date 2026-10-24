import { z } from 'zod'
import type { DeviceGrant, DeviceKind, IpcResult, PhoneLevel } from '../../shared/api'
import { redactEvolution, restrictArgs } from '../reception'
import type { Peer } from './server'

export const API_MINIMA = 1
export const API_ATUAL = 1

export const NOT_ON_PHONE = 'Não disponível no celular.'

export const PHONE_RECEPTION_BLOCKED =
  'Este celular é da recepção: a anamnese e as evoluções não abrem nele.'

export const DEVICE_GONE = 'Este aparelho foi desconectado. Conecte de novo com um código novo.'

const OUTDATED = 'O app do celular e o Auri deste computador não se entendem. Atualize os dois.'

const PATIENTS = [
  'patients:list',
  'patients:get',
  'appointments:listByPatient',
  'attendance:listByPatient',
  'anamneses:get'
]

const AGENDA = [
  'appointments:listRange',
  'appointments:create',
  'appointments:move',
  'appointments:update',
  'appointments:remove',
  'appointments:scheduleOnReserve',
  'commitments:listRange',
  'commitments:create',
  'commitments:update',
  'commitments:remove',
  'attendance:sign',
  'attendance:void',
  'finance:sessionStatus',
  'finance:chargeAbsence',
  'finance:renewPackage',
  'confirmacoes:lista',
  'confirmacoes:enviar',
  'confirmacoes:receber',
  'confirmacoes:aplicarOutra',
  'confirmacoes:avisos',
  'confirmacoes:dispensar',
  'waitlist:list',
  'waitlist:getByPatient',
  'waitlist:add',
  'waitlist:update',
  'waitlist:close',
  'encaixe:sugerir',
  'encaixe:quemCabe'
]

const SETTINGS = ['clinic:get', 'tipos:list']

export const PHONE_CHANNELS: ReadonlySet<string> = new Set([...PATIENTS, ...AGENDA, ...SETTINGS])

const FONO_ONLY = new Set(['anamneses:get'])

const DEVICE_NAME_ARG: Readonly<Record<string, number>> = {
  'appointments:move': 3,
  'appointments:update': 3,
  'attendance:sign': 2,
  'attendance:void': 2,
  'confirmacoes:enviar': 1,
  'confirmacoes:receber': 1,
  'confirmacoes:aplicarOutra': 1,
  'finance:renewPackage': 1,
  'finance:chargeAbsence': 1
}

const texto = z.string()
const id = z.number().int()

const paciente = z.object({
  id,
  nome: texto,
  data_nascimento: texto,
  ativo: z.boolean(),
  celular: texto,
  email: texto,
  escola: texto,
  serie: texto,
  professora: texto,
  mae_nome: texto,
  mae_celular: texto,
  pai_nome: texto,
  pai_celular: texto,
  resp_tipo: texto,
  resp_nome: texto,
  resp_parentesco: texto,
  resp_celular: texto,
  updated_at: texto
})

const pedido = z.object({
  estado: z.enum(['aguardando', 'confirmado', 'desmarcado', 'sem_resposta']),
  prazo: texto
})

const sessao = z.object({
  id,
  patient_id: id,
  patient_nome: texto,
  inicio: texto,
  fim: texto,
  observacao: texto,
  tipo_id: id,
  tipo_nome: texto,
  tipo_cor: texto,
  categoria: texto,
  presenca: texto,
  evolucao: texto,
  confirmado_em: texto.nullable(),
  assinatura: z
    .object({ id, signer_nome: texto, signer_parentesco: texto, assinado_em: texto })
    .nullable(),
  pedido: pedido.nullable(),
  updated_at: texto
})

const compromisso = z.object({
  id,
  etiqueta_id: id,
  etiqueta_nome: texto,
  cor: texto,
  reserva: z.boolean(),
  titulo: texto,
  inicio: texto,
  fim: texto,
  observacao: texto,
  updated_at: texto
})

const etiqueta = z.object({
  id,
  nome: texto,
  categoria: texto,
  cor: texto,
  duracao: z.number().int(),
  sistema: texto.nullable()
})

const clinica = z.object({
  nome: texto,
  funcionamento: z.record(z.string(), z.object({ abre: texto, fecha: texto }))
})

const anamnese = z.object({
  data: texto,
  queixa: texto,
  gestacao: texto,
  alimentacao: texto,
  sono: texto,
  desenvolvimento: texto,
  saude: texto,
  rotina: texto,
  terapias: texto,
  observacoes: texto,
  updated_at: texto.nullable()
})

const CONTRATO_V1: Readonly<Record<string, z.ZodType>> = {
  'patients:list': z.array(paciente),
  'patients:get': paciente,
  'appointments:listRange': z.array(sessao),
  'appointments:listByPatient': z.array(sessao),
  'appointments:create': sessao,
  'appointments:move': sessao,
  'appointments:update': sessao,
  'appointments:scheduleOnReserve': sessao,
  'attendance:sign': sessao,
  'commitments:listRange': z.array(compromisso),
  'commitments:create': compromisso,
  'commitments:update': compromisso,
  'tipos:list': z.array(etiqueta),
  'anamneses:get': anamnese,
  'clinic:get': clinica
}

export const CONTRATOS: Readonly<Record<number, Readonly<Record<string, z.ZodType>>>> = {
  1: CONTRATO_V1
}

type Run = (channel: string, args: unknown[]) => IpcResult<unknown>

export type Phone = { name: string; nivel: PhoneLevel | null; api: number | null }

export type DeviceRecord = { name: string; tipo: DeviceKind; nivel: PhoneLevel | null }

export function deviceRecord(name: string, grant: DeviceGrant): DeviceRecord {
  return { name, tipo: grant.tipo, nivel: grant.tipo === 'celular' ? grant.nivel : null }
}

function signedBy(name: string, channel: string, args: unknown[]): unknown[] {
  const index = DEVICE_NAME_ARG[channel]
  if (index === undefined) return args
  return Array.from({ length: Math.max(args.length, index + 1) }, (_, i) =>
    i === index ? name : args[i]
  )
}

function contractFor(api: number | null): Readonly<Record<string, z.ZodType>> | null {
  if (api === null || api < API_MINIMA || api > API_ATUAL) return null
  return Object.hasOwn(CONTRATOS, api) ? CONTRATOS[api] : null
}

export function callAsPhone(
  run: Run,
  phone: Phone,
  channel: string,
  args: unknown[]
): IpcResult<unknown> {
  if (!PHONE_CHANNELS.has(channel)) return { ok: false, error: NOT_ON_PHONE }
  const contract = contractFor(phone.api)
  if (!contract) return { ok: false, error: OUTDATED }
  const fono = phone.nivel === 'fono'
  if (!fono && FONO_ONLY.has(channel)) return { ok: false, error: PHONE_RECEPTION_BLOCKED }

  const result = run(channel, signedBy(phone.name, channel, restrictArgs(channel, args)))
  if (!result.ok) return result
  const format = Object.hasOwn(contract, channel) ? contract[channel] : undefined
  const shaped = format ? format.safeParse(result.data) : { success: true, data: result.data }
  if (!shaped.success) {
    console.error(`[celular] ${channel}: resposta fora do contrato ${phone.api}`)
    return { ok: false, error: OUTDATED }
  }
  return { ok: true, data: fono ? shaped.data : redactEvolution(shaped.data) }
}

export function callAsDevice(
  run: Run,
  device: DeviceRecord | undefined,
  peer: Peer,
  channel: string,
  args: unknown[]
): IpcResult<unknown> {
  if (!device) return { ok: false, error: DEVICE_GONE }
  if (device.tipo === 'computador') return run(channel, args)
  return callAsPhone(run, { name: device.name, nivel: device.nivel, api: peer.api }, channel, args)
}
