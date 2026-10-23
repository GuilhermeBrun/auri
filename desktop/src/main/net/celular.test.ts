import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { IpcResult, PhoneLevel } from '../../shared/api'
import { emptyAnamneseInput, emptyPatientInput, type Appointment } from '../../shared/schemas'
import { paraBase64url } from '../../../../web/contrato/assinatura/base64url'
import { codificar } from '../../../../web/contrato/assinatura/traco'
import { openDatabase, type Db } from '../db/connection'
import { createPatient } from '../db/patients'
import { DATA_CHANNELS, runOperation } from '../operations'
import {
  API_ATUAL,
  API_MINIMA,
  callAsDevice,
  callAsPhone,
  CONTRATOS,
  DEVICE_GONE,
  NOT_ON_PHONE,
  PHONE_CHANNELS,
  PHONE_RECEPTION_BLOCKED
} from './celular'

let db: Db
let patientId: number

const run = (channel: string, args: unknown[]): IpcResult<unknown> =>
  runOperation(db, channel, args)

function celular(nivel: PhoneLevel | null, api: number | null = API_ATUAL) {
  return (channel: string, ...args: unknown[]): IpcResult<unknown> =>
    callAsPhone(run, { name: 'iPhone da Fono', nivel, api }, channel, args)
}

const fono = celular('fono')
const recepcao = celular('recepcao')

function dados<T>(result: IpcResult<unknown>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data as T
}

function sessao(evolucao = '', inicio = '2025-09-08T14:00', fim = '2025-09-08T14:45'): Appointment {
  return dados(
    run('appointments:create', [{ patient_id: patientId, inicio, fim, observacao: '', evolucao }])
  )
}

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, {
    ...emptyPatientInput(),
    nome: 'Paciente Fictício',
    cpf: '000.000.000-00',
    mae_nome: 'Mãe Fictícia'
  }).id
})

afterEach(() => {
  vi.useRealTimers()
  db.close()
})

describe('canais do celular', () => {
  it('só existem canais de verdade na lista', () => {
    for (const channel of PHONE_CHANNELS) expect(DATA_CHANNELS).toContain(channel)
    for (const contrato of Object.values(CONTRATOS)) {
      for (const channel of Object.keys(contrato)) expect(PHONE_CHANNELS).toContain(channel)
    }
  })

  it('recusa o que está fora da lista, em qualquer nível', () => {
    const fora = DATA_CHANNELS.filter((channel) => !PHONE_CHANNELS.has(channel))
    expect(fora).toEqual(
      expect.arrayContaining([
        'patients:create',
        'patients:update',
        'anamneses:save',
        'documents:anamnese',
        'documents:evolutions',
        'clinic:save',
        'terms:send',
        'finance:overview',
        'finance:pay'
      ])
    )
    for (const channel of fora) {
      expect(fono(channel, patientId)).toEqual({ ok: false, error: NOT_ON_PHONE })
      expect(recepcao(channel, patientId)).toEqual({ ok: false, error: NOT_ON_PHONE })
    }
    expect(fono('db:drop')).toEqual({ ok: false, error: NOT_ON_PHONE })
  })

  it('a Fono lê a anamnese e as evoluções', () => {
    sessao('Evolução fictícia')
    expect(fono('anamneses:get', patientId).ok).toBe(true)
    const sessoes = dados<Appointment[]>(fono('appointments:listByPatient', patientId))
    expect(sessoes[0].evolucao).toBe('Evolução fictícia')
  })

  it('a Recepção não abre a anamnese e recebe as evoluções apagadas', () => {
    sessao('Evolução fictícia')
    expect(recepcao('anamneses:get', patientId)).toEqual({
      ok: false,
      error: PHONE_RECEPTION_BLOCKED
    })
    const porPaciente = dados<Appointment[]>(recepcao('appointments:listByPatient', patientId))
    const naAgenda = dados<Appointment[]>(
      recepcao('appointments:listRange', '2025-09-01T00:00', '2025-09-30T00:00')
    )
    expect([...porPaciente, ...naAgenda].map((a) => a.evolucao)).toEqual(['', ''])
  })

  it('sem nível gravado vale a regra da Recepção', () => {
    sessao('Evolução fictícia')
    const semNivel = celular(null)
    expect(semNivel('anamneses:get', patientId)).toEqual({
      ok: false,
      error: PHONE_RECEPTION_BLOCKED
    })
    const sessoes = dados<Appointment[]>(semNivel('appointments:listByPatient', patientId))
    expect(sessoes[0].evolucao).toBe('')
  })

  it('não grava evolução em nenhum nível', () => {
    const marcada = dados<Appointment>(
      fono('appointments:create', {
        patient_id: patientId,
        inicio: '2025-09-08T14:00',
        fim: '2025-09-08T14:45',
        observacao: '',
        evolucao: 'Escrita no celular'
      })
    )
    const antiga = sessao('Evolução fictícia', '2025-09-08T15:00', '2025-09-08T15:45')
    fono(
      'appointments:update',
      antiga.id,
      {
        patient_id: patientId,
        inicio: antiga.inicio,
        fim: antiga.fim,
        observacao: 'Mudou',
        evolucao: 'Trocada no celular'
      },
      antiga.updated_at
    )
    const sessoes = dados<Appointment[]>(run('appointments:listByPatient', [patientId]))
    expect(sessoes.find((a) => a.id === marcada.id)?.evolucao).toBe('')
    expect(sessoes.find((a) => a.id === antiga.id)).toMatchObject({
      observacao: 'Mudou',
      evolucao: 'Evolução fictícia'
    })
  })

  it('não exclui sessão com evolução', () => {
    const comEvolucao = sessao('Evolução fictícia')
    expect(fono('appointments:remove', comEvolucao.id, false)).toMatchObject({ ok: false })
    expect(dados<Appointment[]>(run('appointments:listByPatient', [patientId]))).toHaveLength(1)
  })

  it('quem fez é o nome do aparelho pareado, não o que o celular manda', () => {
    const chamadas: unknown[][] = []
    const espia = (_: string, args: unknown[]): IpcResult<unknown> => {
      chamadas.push(args)
      return { ok: true, data: null }
    }
    const telefone = { name: 'iPhone da Fono', nivel: 'fono' as const, api: API_ATUAL }
    callAsPhone(espia, telefone, 'finance:chargeAbsence', [7, 'Consultório'])
    callAsPhone(espia, telefone, 'appointments:move', [7, { inicio: 'a', fim: 'b' }])
    callAsPhone(espia, telefone, 'confirmacoes:receber', ['texto'])
    expect(chamadas).toEqual([
      [7, 'iPhone da Fono'],
      [7, { inicio: 'a', fim: 'b' }, undefined, 'iPhone da Fono'],
      ['texto', 'iPhone da Fono']
    ])
  })

  it('a presença assinada no celular fica com o nome do aparelho', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2025, 8, 8, 13, 50))
    const marcada = sessao()
    const traco = paraBase64url(
      codificar([
        [
          [100, 200],
          [300, 120],
          [500, 260]
        ]
      ])
    )
    const assinada = fono(
      'attendance:sign',
      marcada.id,
      { signer_nome: 'Mãe Fictícia', signer_papel: 'mae', signer_parentesco: 'Mãe', traco },
      'Consultório'
    )
    expect(assinada).toMatchObject({ ok: true, data: { presenca: 'presente' } })
    const registros = dados<{ computador: string }[]>(run('attendance:listByPatient', [patientId]))
    expect(registros.map((r) => r.computador)).toEqual(['iPhone da Fono'])
  })

  it('recusa o app de uma versão que este computador não atende', () => {
    expect(celular('fono', API_ATUAL + 1)('patients:list')).toMatchObject({ ok: false })
    expect(celular('fono', API_MINIMA - 1)('patients:list')).toMatchObject({ ok: false })
    expect(celular('fono', null)('patients:list')).toMatchObject({ ok: false })
  })

  it('manda só o formato do contrato, sem as colunas do banco', () => {
    const ficha = dados<Record<string, unknown>>(fono('patients:get', patientId))
    expect(ficha).toMatchObject({
      id: patientId,
      nome: 'Paciente Fictício',
      mae_nome: 'Mãe Fictícia'
    })
    expect(ficha).not.toHaveProperty('cpf')
    expect(ficha).not.toHaveProperty('created_at')
  })

  it('computador pareado usa tudo; aparelho removido não usa nada', () => {
    const peer = { publicKey: 'ab', api: null }
    const computador = { name: 'Consultório', tipo: 'computador' as const, nivel: null }
    const telefone = { name: 'iPhone', tipo: 'celular' as const, nivel: 'fono' as const }
    expect(callAsDevice(run, computador, peer, 'anamneses:get', [patientId]).ok).toBe(true)
    expect(callAsDevice(run, computador, peer, 'documents:patient', [patientId]).ok).toBe(true)
    expect(callAsDevice(run, telefone, peer, 'patients:list', [])).toMatchObject({ ok: false })
    expect(callAsDevice(run, telefone, { ...peer, api: API_ATUAL }, 'patients:list', []).ok).toBe(
      true
    )
    expect(callAsDevice(run, undefined, peer, 'patients:list', [])).toEqual({
      ok: false,
      error: DEVICE_GONE
    })
  })
})

const tipoDe = (valor: unknown): string =>
  valor === null ? 'null' : Array.isArray(valor) ? 'lista' : typeof valor

function diferencas(esperado: unknown, atual: unknown, caminho: string, faltas: string[]): void {
  if (esperado === null || atual === null) return
  if (tipoDe(esperado) !== tipoDe(atual)) {
    faltas.push(`${caminho}: era ${tipoDe(esperado)}, veio ${tipoDe(atual)}`)
  } else if (Array.isArray(esperado) && Array.isArray(atual)) {
    if (esperado.length > 0 && atual.length === 0) faltas.push(`${caminho} veio vazio`)
    if (esperado.length > 0 && atual.length > 0)
      diferencas(esperado[0], atual[0], `${caminho}[0]`, faltas)
  } else if (tipoDe(esperado) === 'object') {
    const objeto = atual as Record<string, unknown>
    for (const [chave, valor] of Object.entries(esperado as Record<string, unknown>)) {
      if (!(chave in objeto)) faltas.push(`${caminho}.${chave} sumiu`)
      else diferencas(valor, objeto[chave], `${caminho}.${chave}`, faltas)
    }
  }
}

describe('contrato do app do iPhone', () => {
  const versoes = Array.from({ length: API_ATUAL - API_MINIMA + 1 }, (_, i) => API_MINIMA + i)

  it.each(versoes)('a versão %i continua com o formato que o app lê', (api) => {
    const arquivo = new URL(`../../../../ios/Tests/Contrato/contrato-v${api}.json`, import.meta.url)
    const gravado = JSON.parse(readFileSync(arquivo, 'utf8')) as Record<string, unknown>

    sessao('Evolução fictícia')
    run('anamneses:save', [
      patientId,
      { ...emptyAnamneseInput(), data: '2025-09-01', queixa: 'Queixa fictícia' }
    ])
    const reuniao = dados<{ id: number; categoria: string }[]>(run('tipos:list', [])).find(
      (t) => t.categoria === 'compromisso'
    )
    run('commitments:create', [
      {
        etiqueta_id: reuniao?.id,
        titulo: 'Reunião',
        inicio: '2025-09-12T17:00',
        fim: '2025-09-12T18:00',
        observacao: ''
      }
    ])

    const argumentos: Record<string, unknown[]> = {
      'patients:list': [],
      'patients:get': [patientId],
      'appointments:listRange': ['2025-09-01T00:00', '2025-10-01T00:00'],
      'appointments:listByPatient': [patientId],
      'commitments:listRange': ['2025-09-01T00:00', '2025-10-01T00:00'],
      'tipos:list': [],
      'anamneses:get': [patientId]
    }
    const app = celular('fono', api)
    const faltas: string[] = []
    for (const [canal, esperado] of Object.entries(gravado)) {
      expect(Object.keys(argumentos)).toContain(canal)
      const resposta = app(canal, ...argumentos[canal])
      if (!resposta.ok) faltas.push(`${canal}: ${resposta.error}`)
      else diferencas(esperado, resposta.data, canal, faltas)
    }
    expect(faltas, 'Um app do iPhone em uso deixaria de ler o que o desktop manda').toEqual([])
  })
})
