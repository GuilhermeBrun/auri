import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { createAppointment, removeAppointment } from './appointments'
import { openDatabase, type Db } from './connection'
import {
  addCharge,
  addPayment,
  archiveService,
  cobrarFalta,
  contractPackage,
  estornar,
  getCatalog,
  getOverview,
  getPatientFinance,
  lancarSessao,
  saveInsurer,
  savePlan,
  saveService,
  setBilling,
  situacaoSessoes
} from './finance'
import { createPatient } from './patients'
import { runOperation } from '../operations'

let db: Db
let patientId: number
let sessao: number
let avaliacao: number
let hour: number

const PC = 'Recepção'
const HOJE = '2026-10-19'

beforeEach(() => {
  hour = 7
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Helena Fictícia' }).id
  sessao = saveService(db, null, { nome: 'Sessão', valor_centavos: 19000 }).id
  avaliacao = saveService(db, null, { nome: 'Avaliação', valor_centavos: 40000 }).id
})

function atendimento(
  dia: string,
  presenca: 'presente' | 'falta' | '' = 'presente',
  tipo: 'sessao' | 'avaliacao' = 'sessao',
  paciente = patientId
): number {
  const h = String(hour++).padStart(2, '0')
  const id = createAppointment(db, {
    patient_id: paciente,
    inicio: `${dia}T${h}:00`,
    fim: `${dia}T${h}:45`,
    observacao: '',
    tipo
  }).id
  if (presenca !== '')
    db.prepare('UPDATE appointments SET presenca = ? WHERE id = ?').run(presenca, id)
  return id
}

function particular(desde = '2026-10-01', paciente = patientId): void {
  setBilling(db, paciente, {
    forma: 'particular',
    service_id: sessao,
    insurer_id: null,
    carteirinha: '',
    desde
  })
}

function pix(valor: number, data = HOJE, insurer_id: number | null = null): number {
  return addPayment(
    db,
    patientId,
    { valor_centavos: valor, data, forma: 'pix', insurer_id, observacao: '' },
    PC
  )
}

const fin = (): ReturnType<typeof getPatientFinance> => getPatientFinance(db, patientId, HOJE)

describe('catálogo', () => {
  it('serviços, pacotes e convênios são editados e arquivados, nunca apagados', () => {
    const plan = savePlan(db, null, {
      nome: '8 sessões',
      sessoes: 8,
      valor_centavos: 152000,
      validade_dias: 60
    })
    saveInsurer(db, null, { nome: 'Saúde Fictícia', valor_sessao_centavos: 9500 })
    expect(saveService(db, sessao, { nome: 'Sessão', valor_centavos: 20000 }).valor_centavos).toBe(
      20000
    )
    expect(archiveService(db, avaliacao, true).arquivado).toBe(true)
    const catalog = getCatalog(db)
    expect(catalog.services.map((s) => [s.nome, s.arquivado])).toEqual([
      ['Sessão', false],
      ['Avaliação', true]
    ])
    expect(catalog.plans).toEqual([{ ...plan, arquivado: false }])
    expect(catalog.insurers[0]).toMatchObject({
      nome: 'Saúde Fictícia',
      valor_sessao_centavos: 9500
    })
    expect(archiveService(db, avaliacao, false).arquivado).toBe(false)
  })

  it('mudar o preço não muda o que já foi cobrado', () => {
    particular()
    const a = atendimento('2026-10-14')
    lancarSessao(db, a, PC)
    saveService(db, sessao, { nome: 'Sessão', valor_centavos: 25000 })
    expect(fin().charges[0]).toMatchObject({
      valor_centavos: 19000,
      descricao: 'Sessão de 14/10 · Sessão'
    })
  })
})

describe('particular por sessão', () => {
  it('sem forma de cobrança não lança nada', () => {
    const a = atendimento('2026-10-14')
    expect(() => lancarSessao(db, a, PC)).toThrow('Defina a forma de cobrança')
    expect(fin()).toMatchObject({ billing: null, pendentes: [], saldo_centavos: 0 })
  })

  it('lança a sessão com presença e o saldo é cobranças menos pagamentos', () => {
    particular()
    const a = atendimento('2026-10-14')
    const b = atendimento('2026-10-16')
    expect(fin().pendentes.map((p) => p.appointment_id)).toEqual([a, b])
    lancarSessao(db, a, PC)
    lancarSessao(db, b, PC)
    expect(fin()).toMatchObject({ saldo_centavos: 38000, pendentes: [] })

    pix(25000)
    const depois = fin()
    expect(depois.saldo_centavos).toBe(13000)
    expect(depois.charges.map((c) => [c.appointment_id, c.situacao, c.pago_centavos])).toEqual([
      [b, 'parcial', 6000],
      [a, 'pago', 19000]
    ])
    pix(15000)
    expect(fin().saldo_centavos).toBe(-2000)
    expect(fin().charges.every((c) => c.situacao === 'pago')).toBe(true)
  })

  it('só sessão com presença, uma vez, e só as de depois da forma de cobrança', () => {
    particular('2026-10-10')
    const antiga = atendimento('2026-10-02')
    const semPresenca = atendimento('2026-10-14', '')
    const a = atendimento('2026-10-15')
    expect(fin().pendentes.map((p) => p.appointment_id)).toEqual([a])
    expect(() => lancarSessao(db, semPresenca, PC)).toThrow('presença')
    lancarSessao(db, a, PC)
    expect(() => lancarSessao(db, a, PC)).toThrow('já foi lançada')
    expect(() =>
      db
        .prepare(
          `INSERT INTO finance_charges (patient_id, data, descricao, valor_centavos, motivo,
             appointment_id, computador) VALUES (?, '2026-10-15', 'x', 1, 'sessao', ?, 'x')`
        )
        .run(patientId, a)
    ).toThrow(/UNIQUE/)
    lancarSessao(db, antiga, PC)
    expect(fin().saldo_centavos).toBe(38000)
  })

  it('avaliação lançada com outro serviço e cobrança avulsa', () => {
    particular()
    const a = atendimento('2026-10-14', 'presente', 'avaliacao')
    lancarSessao(db, a, PC, avaliacao)
    addCharge(
      db,
      patientId,
      { descricao: 'Relatório escolar', valor_centavos: 15000, data: HOJE },
      PC
    )
    expect(fin().charges.map((c) => [c.motivo, c.descricao, c.valor_centavos])).toEqual([
      ['avulsa', 'Relatório escolar', 15000],
      ['sessao', 'Avaliação de 14/10 · Avaliação', 40000]
    ])
  })

  it('falta cobrada pelo valor da sessão', () => {
    particular()
    const f = atendimento('2026-10-14', 'falta')
    const p = atendimento('2026-10-15')
    expect(() => cobrarFalta(db, p, PC)).toThrow('Só uma falta')
    cobrarFalta(db, f, PC)
    expect(() => cobrarFalta(db, f, PC)).toThrow('já foi lançada')
    expect(fin().charges[0]).toMatchObject({
      motivo: 'falta_cobrada',
      descricao: 'Falta de 14/10 · Sessão',
      valor_centavos: 19000
    })
    expect(fin().pendentes.map((x) => x.appointment_id)).toEqual([p])
  })
})

describe('pacote', () => {
  let plan: number

  beforeEach(() => {
    plan = savePlan(db, null, {
      nome: '8 sessões',
      sessoes: 8,
      valor_centavos: 152000,
      validade_dias: 30
    }).id
    setBilling(db, patientId, {
      forma: 'pacote',
      service_id: sessao,
      insurer_id: null,
      carteirinha: '',
      desde: '2026-10-01'
    })
  })

  it('contratar cobra o valor total e cada sessão consome uma vaga', () => {
    const pkg = contractPackage(db, patientId, { plan_id: plan, inicio: '2026-10-01' }, PC)
    const ids = ['2026-10-02', '2026-10-06', '2026-10-09'].map((d) => atendimento(d))
    for (const id of ids) expect(lancarSessao(db, id, PC).kind).toBe('use')
    const f = fin()
    expect(f.packages[0]).toMatchObject({
      id: pkg,
      sessoes: 8,
      usadas: 3,
      validade: '2026-10-30',
      em_vigor: true
    })
    expect(f.charges).toHaveLength(1)
    expect(f.charges[0]).toMatchObject({ motivo: 'pacote', valor_centavos: 152000 })
    expect(f.saldo_centavos).toBe(152000)
    expect(f.uses.map((u) => u.numero)).toEqual([3, 2, 1])
    expect(situacaoSessoes(db, ids)).toEqual(
      ids.map((id, i) => ({
        appointment_id: id,
        situacao: 'pacote',
        package_id: pkg,
        numero: i + 1,
        sessoes: 8
      }))
    )
  })

  it('pacote cheio, vencido ou avaliação: a sessão é cobrada avulsa', () => {
    const small = savePlan(db, null, {
      nome: '1 sessão',
      sessoes: 1,
      valor_centavos: 18000,
      validade_dias: null
    }).id
    contractPackage(db, patientId, { plan_id: small, inicio: '2026-10-01' }, PC)
    lancarSessao(db, atendimento('2026-10-02'), PC)
    const cheia = atendimento('2026-10-03')
    expect(lancarSessao(db, cheia, PC).kind).toBe('charge')

    contractPackage(db, patientId, { plan_id: plan, inicio: '2026-09-01' }, PC)
    const depoisDaValidade = atendimento('2026-10-05')
    expect(lancarSessao(db, depoisDaValidade, PC).kind).toBe('charge')
    const av = atendimento('2026-10-06', 'presente', 'avaliacao')
    expect(lancarSessao(db, av, PC).kind).toBe('charge')

    const descricoes = fin()
      .charges.filter((c) => c.motivo === 'sessao')
      .map((c) => c.descricao)
    expect(descricoes).toEqual([
      'Avaliação de 06/10 · Sessão',
      'Sessão de 05/10 · Sessão · fora do pacote',
      'Sessão de 03/10 · Sessão · fora do pacote'
    ])
    expect(fin().packages.map((p) => [p.nome, p.usadas, p.em_vigor])).toEqual([
      ['1 sessão', 1, false],
      ['8 sessões', 0, false]
    ])
  })
})

describe('estorno', () => {
  it('a cobrança estornada sai do saldo, fica no extrato e a sessão volta a lançar', () => {
    particular()
    const a = atendimento('2026-10-14')
    const { id } = lancarSessao(db, a, PC)
    estornar(db, 'charge', id, 'Lançada em dobro', 'Consultório')
    const f = fin()
    expect(f.saldo_centavos).toBe(0)
    expect(f.charges[0]).toMatchObject({
      situacao: null,
      estorno: { motivo: 'Lançada em dobro', computador: 'Consultório' }
    })
    expect(f.pendentes.map((p) => p.appointment_id)).toEqual([a])
    expect(() => estornar(db, 'charge', id, 'De novo', PC)).toThrow('já foi estornado')
    lancarSessao(db, a, PC)
    expect(fin().saldo_centavos).toBe(19000)
  })

  it('pagamento estornado volta a dívida', () => {
    particular()
    lancarSessao(db, atendimento('2026-10-14'), PC)
    const p = pix(19000)
    expect(fin().saldo_centavos).toBe(0)
    estornar(db, 'payment', p, 'Pix devolvido', PC)
    expect(fin().saldo_centavos).toBe(19000)
    expect(fin().payments[0].estorno?.motivo).toBe('Pix devolvido')
  })

  it('pacote só estorna sem sessões usadas, e leva a cobrança junto', () => {
    const plan = savePlan(db, null, {
      nome: '4 sessões',
      sessoes: 4,
      valor_centavos: 70000,
      validade_dias: null
    }).id
    setBilling(db, patientId, {
      forma: 'pacote',
      service_id: sessao,
      insurer_id: null,
      carteirinha: '',
      desde: '2026-10-01'
    })
    const pkg = contractPackage(db, patientId, { plan_id: plan, inicio: '2026-10-01' }, PC)
    const use = lancarSessao(db, atendimento('2026-10-02'), PC)
    const cobranca = fin().charges[0].id
    expect(() => estornar(db, 'charge', cobranca, 'x', PC)).toThrow('Estorne o pacote')
    expect(() => estornar(db, 'package', pkg, 'Desistiu', PC)).toThrow('sessões usadas')
    estornar(db, 'use', use.id, 'Sessão errada', PC)
    expect(fin().packages[0].usadas).toBe(0)
    estornar(db, 'package', pkg, 'Desistiu', PC)
    const f = fin()
    expect(f.saldo_centavos).toBe(0)
    expect(f.packages[0].estorno?.motivo).toBe('Desistiu')
    expect(f.charges[0].estorno?.motivo).toBe('Desistiu')
  })

  it('o banco não deixa alterar nem apagar lançamento', () => {
    particular()
    const a = atendimento('2026-10-14')
    const { id } = lancarSessao(db, a, PC)
    const p = pix(1000)
    expect(() =>
      db.prepare('UPDATE finance_charges SET valor_centavos = 1 WHERE id = ?').run(id)
    ).toThrow('só pode ser estornado')
    expect(() =>
      db
        .prepare(
          "UPDATE finance_payments SET estornado_em = 'x', estorno_motivo = 'x', estorno_computador = 'x', valor_centavos = 1 WHERE id = ?"
        )
        .run(p)
    ).toThrow('só pode ser estornado')
    expect(() => db.prepare('DELETE FROM finance_payments WHERE id = ?').run(p)).toThrow(
      'não pode ser apagado'
    )
    estornar(db, 'charge', id, 'Erro', PC)
    expect(() =>
      db.prepare("UPDATE finance_charges SET estorno_motivo = 'outro' WHERE id = ?").run(id)
    ).toThrow('só pode ser estornado')
    expect(() => removeAppointment(db, a)).toThrow(/FOREIGN KEY/)
  })
})

describe('convênio', () => {
  it('a sessão é cobrada do convênio, não da família', () => {
    const conv = saveInsurer(db, null, { nome: 'Saúde Fictícia', valor_sessao_centavos: 9500 }).id
    setBilling(db, patientId, {
      forma: 'convenio',
      service_id: sessao,
      insurer_id: conv,
      carteirinha: '0012 3456 7890',
      desde: '2026-10-01'
    })
    const a = atendimento('2026-10-14')
    const b = atendimento('2026-10-15')
    lancarSessao(db, a, PC)
    lancarSessao(db, b, PC)
    const f = fin()
    expect(f.billing).toMatchObject({
      carteirinha: '0012 3456 7890',
      insurer: { nome: 'Saúde Fictícia' }
    })
    expect(f.saldo_centavos).toBe(0)
    expect(f.convenios).toEqual([
      { insurer_id: conv, nome: 'Saúde Fictícia', saldo_centavos: 19000 }
    ])
    expect(f.charges[0]).toMatchObject({
      insurer_nome: 'Saúde Fictícia',
      descricao: 'Sessão de 15/10 · Saúde Fictícia'
    })

    addPayment(
      db,
      patientId,
      {
        valor_centavos: 9500,
        data: HOJE,
        forma: 'transferencia',
        insurer_id: conv,
        observacao: 'Repasse'
      },
      PC
    )
    expect(fin().convenios[0].saldo_centavos).toBe(9500)
    expect(situacaoSessoes(db, [a, b]).map((s) => s.situacao)).toEqual(['pago', 'em_aberto'])

    cobrarFalta(db, atendimento('2026-10-16', 'falta'), PC)
    expect(fin().saldo_centavos).toBe(19000)
    expect(getOverview(db, '2026-10-01', '2026-10-31').convenios).toEqual([
      { insurer_id: conv, nome: 'Saúde Fictícia', saldo_centavos: 9500 }
    ])
  })
})

describe('tela Financeiro', () => {
  it('em aberto por paciente e recebimentos do período por forma', () => {
    particular()
    const outro = createPatient(db, { ...emptyPatientInput(), nome: 'Bruno Fictício' }).id
    particular('2026-10-01', outro)
    lancarSessao(db, atendimento('2026-10-02'), PC)
    lancarSessao(db, atendimento('2026-10-09'), PC)
    lancarSessao(db, atendimento('2026-10-03', 'presente', 'sessao', outro), PC)
    pix(19000, '2026-09-30')
    addPayment(
      db,
      patientId,
      {
        valor_centavos: 5000,
        data: '2026-10-10',
        forma: 'dinheiro',
        insurer_id: null,
        observacao: ''
      },
      PC
    )
    const estornado = pix(1000, '2026-10-11')
    estornar(db, 'payment', estornado, 'Engano', PC)

    const o = getOverview(db, '2026-10-01', '2026-10-31')
    expect(o.abertos).toEqual([
      { patient_id: outro, nome: 'Bruno Fictício', saldo_centavos: 19000, desde: '2026-10-03' },
      { patient_id: patientId, nome: 'Helena Fictícia', saldo_centavos: 14000, desde: '2026-10-09' }
    ])
    expect(o.recebimentos.map((r) => [r.patient_nome, r.valor_centavos, r.forma])).toEqual([
      ['Helena Fictícia', 5000, 'dinheiro']
    ])
    expect(o.total_centavos).toBe(5000)
    expect(o.por_forma).toEqual({ pix: 0, dinheiro: 5000, cartao: 0, transferencia: 0 })
    expect(situacaoSessoes(db, [atendimento('2026-10-20')])).toEqual([
      { appointment_id: expect.any(Number), situacao: 'sem_lancamento' }
    ])
  })
})

describe('operações', () => {
  it('validam a entrada e avisam o tópico finance, também para o consultório', () => {
    particular()
    const topics: string[][] = []
    const pay = (input: unknown) =>
      runOperation(db, 'finance:pay', [patientId, input, 'Consultório'], (t) => topics.push(t))
    expect(
      pay({ valor_centavos: 0, data: HOJE, forma: 'pix', insurer_id: null, observacao: '' })
    ).toEqual({ ok: false, error: 'Informe o valor' })
    expect(
      pay({ valor_centavos: 100, data: HOJE, forma: 'boleto', insurer_id: null, observacao: '' })
    ).toMatchObject({ ok: false })
    expect(
      pay({ valor_centavos: 100, data: HOJE, forma: 'pix', insurer_id: null, observacao: '' })
    ).toEqual({ ok: true, data: expect.any(Number) })
    expect(topics).toEqual([['finance']])
    expect(runOperation(db, 'finance:patient', [patientId])).toMatchObject({
      ok: true,
      data: { saldo_centavos: -100 }
    })
  })
})
