import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { paraBase64url } from '../../../../web/contrato/assinatura/base64url'
import { codificar } from '../../../../web/contrato/assinatura/traco'
import { createAppointment } from './appointments'
import { signArrival, voidArrival } from './attendance'
import { openDatabase, type Db } from './connection'
import {
  cobrarFalta,
  contractPackage,
  getPatientFinance,
  lancarSessao,
  savePlan,
  saveService,
  setBilling,
  situacaoSessoes
} from './finance'
import { createPatient } from './patients'

const TRACO = paraBase64url(
  codificar([
    [
      [100, 200],
      [300, 120],
      [500, 260],
      [700, 140]
    ]
  ])
)
const assinante = {
  signer_nome: 'Marina Fictícia',
  signer_papel: 'mae' as const,
  signer_parentesco: 'Mãe',
  traco: TRACO
}
const DIA = new Date(2026, 9, 19, 13, 50)
const PC = 'Recepção'

let db: Db
let patientId: number
let sessao: number

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Helena Fictícia' }).id
  sessao = saveService(db, null, { nome: 'Sessão', valor_centavos: 19000 }).id
})

function agendar(hora = '14:00', dia = '2026-10-19'): number {
  return createAppointment(db, {
    patient_id: patientId,
    inicio: `${dia}T${hora}`,
    fim: `${dia}T${hora.slice(0, 2)}:45`,
    observacao: ''
  }).id
}

function cobranca(forma: 'particular' | 'pacote'): void {
  setBilling(db, patientId, {
    forma,
    service_id: sessao,
    insurer_id: null,
    carteirinha: '',
    desde: '2026-10-01'
  })
}

const assinatura = (id: number): number => signArrival(db, id, assinante, PC, DIA).assinatura!.id
const fin = (): ReturnType<typeof getPatientFinance> =>
  getPatientFinance(db, patientId, '2026-10-19')

describe('lançamento na chegada', () => {
  it('assinar a chegada lança a sessão na mesma hora', () => {
    cobranca('particular')
    const a = agendar()
    assinatura(a)
    expect(fin()).toMatchObject({ saldo_centavos: 19000, pendentes: [] })
    expect(fin().charges[0]).toMatchObject({ appointment_id: a, computador: PC, motivo: 'sessao' })
  })

  it('no pacote, a chegada consome a vaga', () => {
    cobranca('pacote')
    const plan = savePlan(db, null, {
      nome: '8 sessões',
      sessoes: 8,
      valor_centavos: 152000,
      validade_dias: null
    }).id
    const pkg = contractPackage(db, patientId, { plan_id: plan, inicio: '2026-10-01' }, PC)
    const a = agendar()
    assinatura(a)
    expect(situacaoSessoes(db, [a])).toEqual([
      { appointment_id: a, situacao: 'pacote', package_id: pkg, numero: 1, sessoes: 8 }
    ])
  })

  it('sem forma de cobrança a chegada é assinada e nada é lançado', () => {
    const a = agendar()
    expect(signArrival(db, a, assinante, PC, DIA).presenca).toBe('presente')
    expect(fin()).toMatchObject({ charges: [], uses: [], billing: null })
  })

  it('anular a assinatura estorna o lançamento com o mesmo motivo', () => {
    cobranca('particular')
    const a = agendar()
    const s = assinatura(a)
    voidArrival(db, s, 'Assinou na sessão errada', 'Consultório')
    const f = fin()
    expect(f.saldo_centavos).toBe(0)
    expect(f.charges[0].estorno).toMatchObject({
      motivo: 'Assinou na sessão errada',
      computador: 'Consultório'
    })
    expect(f.pendentes).toEqual([])
    expect(() => lancarSessao(db, a, PC)).toThrow('assinatura da chegada desta sessão foi anulada')

    assinatura(a)
    expect(fin().saldo_centavos).toBe(19000)
    expect(fin().charges.map((c) => c.estorno === null)).toEqual([true, false])
  })

  it('anular sem lançamento não muda o financeiro', () => {
    const a = agendar()
    voidArrival(db, assinatura(a), 'Engano', PC)
    expect(fin().charges).toEqual([])
  })
})

describe('cobrar falta', () => {
  it('cobra o valor cheio da sessão e fica de fora de "A lançar"', () => {
    cobranca('pacote')
    const a = agendar('09:00', '2026-10-14')
    db.prepare("UPDATE appointments SET presenca = 'desmarcou' WHERE id = ?").run(a)
    cobrarFalta(db, a, 'Confirmação automática')
    expect(fin().charges[0]).toMatchObject({
      motivo: 'falta_cobrada',
      valor_centavos: 19000,
      computador: 'Confirmação automática'
    })
    expect(situacaoSessoes(db, [a])[0]).toMatchObject({
      situacao: 'em_aberto',
      valor_centavos: 19000
    })
  })
})
