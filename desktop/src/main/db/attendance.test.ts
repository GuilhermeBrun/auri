import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { paraBase64url } from '../../../../web/contrato/assinatura/base64url'
import { codificar } from '../../../../web/contrato/assinatura/traco'
import {
  createAppointment,
  getAppointment,
  removeAppointment,
  updateAppointment
} from './appointments'
import {
  attendanceReport,
  canonicalRecord,
  listPatientAttendance,
  signArrival,
  voidArrival
} from './attendance'
import { openDatabase, type Db } from './connection'
import { createPatient } from './patients'

let db: Db
let patientId: number

const HOJE = new Date(2026, 9, 19, 13, 50)

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
const PONTO = paraBase64url(codificar([[[100, 100]]]))

const assinante = {
  signer_nome: 'Marina Fictícia',
  signer_papel: 'mae' as const,
  signer_parentesco: 'Mãe',
  traco: TRACO
}

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Helena Fictícia' }).id
})

function sessao(inicio = '2026-10-19T14:00', fim = '2026-10-19T14:45'): number {
  return createAppointment(db, { patient_id: patientId, inicio, fim, observacao: '' }).id
}

describe('assinatura de chegada', () => {
  it('marca presença e guarda quem assinou, com o hash do registro', () => {
    const id = sessao()
    const a = signArrival(db, id, assinante, 'Recepção', HOJE)
    expect(a.presenca).toBe('presente')
    expect(a.assinatura).toMatchObject({ signer_nome: 'Marina Fictícia', signer_parentesco: 'Mãe' })
    const [registro] = listPatientAttendance(db, patientId)
    expect(registro).toMatchObject({
      appointment_id: id,
      traco: TRACO,
      computador: 'Recepção',
      anulada: null
    })
    const esperado = canonicalRecord({
      appointment: getAppointment(db, id),
      signer: { nome: 'Marina Fictícia', papel: 'mae', parentesco: 'Mãe' },
      traco: TRACO,
      assinado_em: registro.assinado_em,
      fuso_minutos: registro.fuso_minutos,
      computador: 'Recepção'
    })
    expect(registro.registro_sha256).toBe(createHash('sha256').update(esperado).digest('hex'))
  })

  it('só no dia da sessão, uma vez e com assinatura de verdade', () => {
    const amanha = sessao('2026-10-20T14:00', '2026-10-20T14:45')
    expect(() => signArrival(db, amanha, assinante, 'Recepção', HOJE)).toThrow(/no dia da sessão/)
    const id = sessao()
    expect(() => signArrival(db, id, { ...assinante, traco: PONTO }, 'Recepção', HOJE)).toThrow(
      /Assine no quadro/
    )
    expect(() => signArrival(db, id, { ...assinante, traco: 'xx' }, 'Recepção', HOJE)).toThrow(
      /Assine no quadro/
    )
    signArrival(db, id, assinante, 'Recepção', HOJE)
    expect(() => signArrival(db, id, assinante, 'Recepção', HOJE)).toThrow(/já tem a chegada/)
  })

  it('sessão assinada não muda de horário, tipo nem presença e não pode ser excluída', () => {
    const id = sessao()
    const a = signArrival(db, id, assinante, 'Recepção', HOJE)
    const base = {
      patient_id: patientId,
      inicio: a.inicio,
      fim: a.fim,
      observacao: '',
      tipo: a.tipo,
      presenca: a.presenca
    }
    expect(() =>
      updateAppointment(db, id, { ...base, inicio: '2026-10-19T15:00', fim: '2026-10-19T15:45' })
    ).toThrow(/não mudam mais/)
    expect(() => updateAppointment(db, id, { ...base, presenca: 'falta' })).toThrow(
      /não mudam mais/
    )
    expect(() => updateAppointment(db, id, { ...base, tipo: 'avaliacao' })).toThrow(
      /não mudam mais/
    )
    const editada = updateAppointment(db, id, { ...base, evolucao: 'Boa sessão', observacao: 'ok' })
    expect(editada.evolucao).toBe('Boa sessão')
    expect(() => removeAppointment(db, id)).toThrow(/não pode ser excluída/)
  })

  it('a assinatura gravada não muda nem some', () => {
    signArrival(db, sessao(), assinante, 'Recepção', HOJE)
    expect(() =>
      db.prepare("UPDATE attendance_signatures SET signer_nome = 'Outra'").run()
    ).toThrow(/não pode ser alterada/)
    expect(() => db.prepare('DELETE FROM attendance_signatures').run()).toThrow(
      /não pode ser apagada/
    )
  })

  it('anular destrava a sessão, guarda o motivo e permite assinar de novo', () => {
    const id = sessao()
    const assinada = signArrival(db, id, assinante, 'Recepção', HOJE)
    const anulada = voidArrival(db, assinada.assinatura!.id, 'Assinou na sessão errada', 'Recepção')
    expect(anulada.assinatura).toBeNull()
    expect(() => voidArrival(db, assinada.assinatura!.id, 'de novo', 'Recepção')).toThrow(
      /já foi anulada/
    )
    const mudou = updateAppointment(db, id, {
      patient_id: patientId,
      inicio: anulada.inicio,
      fim: anulada.fim,
      observacao: '',
      presenca: 'falta'
    })
    expect(mudou.presenca).toBe('falta')
    expect(() => removeAppointment(db, id)).toThrow(/não pode ser excluída/)
    const de_novo = signArrival(db, id, { ...assinante, signer_nome: 'Paulo' }, 'Recepção', HOJE)
    expect(de_novo.assinatura?.signer_nome).toBe('Paulo')
    const registros = listPatientAttendance(db, patientId)
    expect(registros.map((r) => [r.signer_nome, r.anulada?.motivo ?? null])).toEqual([
      ['Paulo', null],
      ['Marina Fictícia', 'Assinou na sessão errada']
    ])
    expect(() => db.prepare('DELETE FROM attendance_voids').run()).toThrow(/não pode ser apagada/)
  })
})

describe('relatório de presença', () => {
  it('junta as sessões do período, da mais antiga para a mais nova, com as assinaturas', () => {
    sessao('2026-09-30T14:00', '2026-09-30T14:45')
    const primeira = sessao('2026-10-05T14:00', '2026-10-05T14:45')
    const hoje = sessao()
    sessao('2026-11-02T14:00', '2026-11-02T14:45')
    signArrival(db, hoje, assinante, 'Recepção', HOJE)

    const report = attendanceReport(db, patientId, '2026-10-01', '2026-10-31')
    expect(report.patient).toMatchObject({ id: patientId, nome: 'Helena Fictícia' })
    expect(report.clinic.nome).toBe('')
    expect(report.sessions.map((s) => s.id)).toEqual([primeira, hoje])
    expect(report.sessions[0].records).toEqual([])
    expect(report.sessions[1].records).toMatchObject([
      { signer_nome: 'Marina Fictícia', anulada: null }
    ])
  })

  it('inclui o último dia do período', () => {
    const ultima = sessao('2026-10-31T10:00', '2026-10-31T10:45')
    const report = attendanceReport(db, patientId, '2026-10-01', '2026-10-31')
    expect(report.sessions.map((s) => s.id)).toEqual([ultima])
  })
})
