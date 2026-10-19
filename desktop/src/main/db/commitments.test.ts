import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { CommitmentInput } from '../../shared/commitments'
import { emptyPatientInput } from '../../shared/schemas'
import { runOperation } from '../operations'
import {
  createAppointment,
  getAppointment,
  moveAppointment,
  updateAppointment
} from './appointments'
import { signArrival } from './attendance'
import { getClinic, saveClinic } from './clinic'
import {
  createCommitment,
  listCommitments,
  removeCommitment,
  scheduleOnReserve,
  updateCommitment
} from './commitments'
import { openDatabase, type Db } from './connection'
import { suggestSlots, whoFits } from './encaixe'
import { createPatient } from './patients'
import { addToWaitlist } from './waitlist'

const QUA = '2026-10-21'
const AGORA = new Date(2026, 9, 19, 9, 0)

let db: Db
let ana: number
let bruno: number

beforeEach(() => {
  db = openDatabase(':memory:')
  ana = createPatient(db, { ...emptyPatientInput(), nome: 'Ana Fictícia' }).id
  bruno = createPatient(db, { ...emptyPatientInput(), nome: 'Bruno Fictício' }).id
})

function compromisso(inicio: string, fim: string, over: Partial<CommitmentInput> = {}) {
  return createCommitment(db, {
    tipo: 'reuniao',
    inicio: `${QUA}T${inicio}`,
    fim: `${QUA}T${fim}`,
    ...over
  })
}

function sessao(patient_id: number, inicio: string, fim: string, presenca: '' | 'desmarcou' = '') {
  return createAppointment(
    db,
    { patient_id, inicio: `${QUA}T${inicio}`, fim: `${QUA}T${fim}`, observacao: '', presenca },
    AGORA
  )
}

describe('compromissos', () => {
  it('cria, lista por intervalo, edita e exclui', () => {
    const palestra = compromisso('14:00', '16:00', {
      tipo: 'palestra',
      titulo: '  Escola Fictícia  ',
      observacao: 'Levar o projetor'
    })
    expect(palestra).toMatchObject({
      tipo: 'palestra',
      titulo: 'Escola Fictícia',
      observacao: 'Levar o projetor'
    })
    expect(listCommitments(db, `${QUA}T00:00`, '2026-10-22T00:00')).toEqual([palestra])
    expect(listCommitments(db, '2026-10-22T00:00', '2026-10-23T00:00')).toEqual([])
    const curso = updateCommitment(
      db,
      palestra.id,
      { tipo: 'curso', inicio: `${QUA}T15:00`, fim: `${QUA}T17:00` },
      palestra.updated_at
    )
    expect(curso).toMatchObject({ tipo: 'curso', titulo: '', observacao: '' })
    removeCommitment(db, curso.id)
    expect(listCommitments(db, `${QUA}T00:00`, '2026-10-22T00:00')).toEqual([])
    expect(() => removeCommitment(db, curso.id)).toThrow(/não encontrado/)
  })

  it('respeita o horário de funcionamento', () => {
    expect(() => compromisso('19:30', '20:30')).toThrow(/Fora do horário/)
    expect(() =>
      createCommitment(db, {
        tipo: 'hospital',
        inicio: '2026-10-25T09:00',
        fim: '2026-10-25T10:00'
      })
    ).toThrow(/não abre no domingo/)
  })

  it('recusa salvar por cima de uma mudança de outro computador', () => {
    const c = compromisso('14:00', '15:00')
    db.prepare("UPDATE commitments SET updated_at = '2000-01-01T00:00:00.000Z'").run()
    expect(() =>
      updateCommitment(db, c.id, { tipo: 'reuniao', inicio: c.inicio, fim: c.fim }, c.updated_at)
    ).toThrow(/outro computador/)
  })
})

describe('conflito de horário entre compromissos e agendamentos', () => {
  it('o agendamento não entra num horário bloqueado', () => {
    compromisso('14:00', '15:00', { tipo: 'hospital', titulo: 'Hospital Fictício' })
    expect(() => sessao(ana, '14:30', '15:00')).toThrow(
      'Esse horário está bloqueado: Hospital: Hospital Fictício, das 14:00 às 15:00.'
    )
    expect(sessao(ana, '15:00', '15:30').inicio).toBe(`${QUA}T15:00`)
  })

  it('mover ou editar um agendamento para cima de um compromisso também é recusado', () => {
    compromisso('14:00', '15:00')
    const a = sessao(ana, '13:00', '13:30')
    expect(() =>
      updateAppointment(db, a.id, {
        patient_id: ana,
        inicio: `${QUA}T14:00`,
        fim: `${QUA}T14:30`,
        observacao: ''
      })
    ).toThrow(/bloqueado: Reunião/)
    expect(() =>
      moveAppointment(db, a.id, { inicio: `${QUA}T14:45`, fim: `${QUA}T15:15` })
    ).toThrow(/bloqueado/)
  })

  it('o compromisso não entra sobre um agendamento nem sobre outro compromisso', () => {
    sessao(ana, '14:00', '14:30')
    expect(() => compromisso('13:00', '15:00')).toThrow(
      'Esse horário já está ocupado: Ana Fictícia, das 14:00 às 14:30.'
    )
    const reuniao = compromisso('15:00', '16:00')
    expect(() => compromisso('15:30', '16:30', { tipo: 'curso' })).toThrow(/bloqueado: Reunião/)
    expect(() =>
      updateCommitment(db, reuniao.id, {
        tipo: 'reuniao',
        inicio: `${QUA}T14:15`,
        fim: `${QUA}T15:00`
      })
    ).toThrow(/ocupado: Ana Fictícia/)
    expect(
      updateCommitment(db, reuniao.id, {
        tipo: 'reuniao',
        inicio: `${QUA}T15:30`,
        fim: `${QUA}T16:30`
      }).inicio
    ).toBe(`${QUA}T15:30`)
  })

  it('conta o resto do que bate no horário', () => {
    sessao(ana, '14:00', '14:30')
    sessao(bruno, '14:30', '15:00')
    compromisso('15:00', '15:30')
    expect(() => compromisso('14:00', '16:00')).toThrow(
      'Esse horário já está ocupado: Ana Fictícia, das 14:00 às 14:30 e mais 2 horários.'
    )
    expect(() => compromisso('13:00', '15:00')).toThrow(/e mais 1 sessão\./)
  })

  it('sessão desmarcada não bloqueia mais o horário', () => {
    const desmarcada = sessao(ana, '14:00', '14:30', 'desmarcou')
    expect(sessao(bruno, '14:00', '14:30').patient_nome).toBe('Bruno Fictício')
    expect(compromisso('14:30', '15:00').tipo).toBe('reuniao')
    expect(() =>
      updateAppointment(db, desmarcada.id, {
        patient_id: ana,
        inicio: desmarcada.inicio,
        fim: desmarcada.fim,
        observacao: '',
        presenca: ''
      })
    ).toThrow(/ocupado: Bruno Fictício/)
  })
})

describe('reserva', () => {
  it('vira agendamento de paciente no mesmo horário', () => {
    const reserva = compromisso('14:00', '15:00', { tipo: 'reserva' })
    addToWaitlist(db, { patient_id: ana, duracao: 60 })
    const a = scheduleOnReserve(
      db,
      reserva.id,
      { patient_id: ana, inicio: `${QUA}T14:00`, fim: `${QUA}T15:00`, observacao: '' },
      AGORA
    )
    expect(a.patient_nome).toBe('Ana Fictícia')
    expect(listCommitments(db, `${QUA}T00:00`, '2026-10-22T00:00')).toEqual([])
    expect(
      db.prepare('SELECT encerrado_motivo FROM waitlist_entries WHERE patient_id = ?').get(ana)
    ).toEqual({ encerrado_motivo: 'agendado' })
  })

  it('só reserva vira agendamento, e um erro mantém a reserva', () => {
    const reuniao = compromisso('14:00', '15:00')
    const input = { patient_id: ana, inicio: `${QUA}T14:00`, fim: `${QUA}T15:00`, observacao: '' }
    expect(() => scheduleOnReserve(db, reuniao.id, input)).toThrow(/Só uma reserva/)
    const reserva = compromisso('15:00', '16:00', { tipo: 'reserva' })
    sessao(bruno, '16:00', '16:30')
    expect(() =>
      scheduleOnReserve(db, reserva.id, { ...input, inicio: `${QUA}T15:30`, fim: `${QUA}T16:30` })
    ).toThrow(/ocupado: Bruno/)
    expect(listCommitments(db, `${QUA}T00:00`, '2026-10-22T00:00')).toHaveLength(2)
  })
})

describe('remarcar', () => {
  it('move a sessão, limpa a confirmação e respeita a agenda', () => {
    const a = createAppointment(
      db,
      {
        patient_id: ana,
        inicio: `${QUA}T14:00`,
        fim: `${QUA}T14:45`,
        observacao: 'Trazer o caderno',
        confirmado: true
      },
      AGORA
    )
    sessao(bruno, '16:00', '16:30')
    expect(() =>
      moveAppointment(db, a.id, { inicio: `${QUA}T15:30`, fim: `${QUA}T16:15` }, a.updated_at)
    ).toThrow(/ocupado: Bruno/)
    expect(() =>
      moveAppointment(db, a.id, { inicio: '2026-10-24T11:30', fim: '2026-10-24T12:15' })
    ).toThrow(/Fora do horário/)
    const moved = moveAppointment(
      db,
      a.id,
      { inicio: '2026-10-22T09:00', fim: '2026-10-22T09:45' },
      a.updated_at
    )
    expect(moved).toMatchObject({
      inicio: '2026-10-22T09:00',
      fim: '2026-10-22T09:45',
      observacao: 'Trazer o caderno',
      confirmado_em: null
    })
    db.prepare("UPDATE appointments SET updated_at = '2000-01-01T00:00:00.000Z'").run()
    expect(() =>
      moveAppointment(db, a.id, { inicio: moved.inicio, fim: moved.fim }, moved.updated_at)
    ).toThrow(/outro computador/)
  })

  it('sessão com a chegada assinada não muda de horário', () => {
    const hoje = new Date()
    const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    db.exec(`DELETE FROM clinic_hours;
      INSERT INTO clinic_hours VALUES (0,'00:00','23:59'),(1,'00:00','23:59'),(2,'00:00','23:59'),
        (3,'00:00','23:59'),(4,'00:00','23:59'),(5,'00:00','23:59'),(6,'00:00','23:59');`)
    const a = createAppointment(db, {
      patient_id: ana,
      inicio: `${dia}T00:00`,
      fim: `${dia}T00:30`,
      observacao: ''
    })
    signArrival(
      db,
      a.id,
      {
        signer_nome: 'Mãe Fictícia',
        signer_papel: 'mae',
        signer_parentesco: 'Mãe',
        traco: 'AQRkyAGQA58BkAOYApAD7wE'
      },
      'Recepção'
    )
    expect(() =>
      moveAppointment(db, a.id, { inicio: `${dia}T01:00`, fim: `${dia}T01:30` })
    ).toThrow(/assinada/)
    expect(getAppointment(db, a.id).inicio).toBe(`${dia}T00:00`)
  })
})

describe('encaixe com compromissos', () => {
  const pedido = (): { patient_id: number; duracao: number; de: string; ate: string } => ({
    patient_id: ana,
    duracao: 60,
    de: QUA,
    ate: QUA
  })

  it('compromissos ocupam e sessões desmarcadas liberam o horário', () => {
    compromisso('07:00', '12:00')
    compromisso('13:00', '20:00', { tipo: 'curso' })
    expect(suggestSlots(db, pedido(), AGORA).map((s) => s.inicio.slice(11))).toEqual(['12:00'])
    sessao(bruno, '12:00', '12:30', 'desmarcou')
    expect(suggestSlots(db, pedido(), AGORA)).toHaveLength(1)
    sessao(bruno, '12:00', '12:30')
    expect(suggestSlots(db, pedido(), AGORA)).toEqual([])
  })

  it('a margem de deslocamento vem da clínica', () => {
    db.prepare(
      "INSERT INTO patient_activities (patient_id, atividade, dia_semana, inicio, fim) VALUES (?, 'Natação', 3, '13:00', '14:00')"
    ).run(ana)
    compromisso('07:00', '12:00')
    compromisso('16:00', '20:00')
    const inicios = (): string[] =>
      suggestSlots(db, { ...pedido(), duracao: 30 }, AGORA)
        .map((s) => s.inicio.slice(11))
        .sort()
    expect(getClinic(db).margem_deslocamento).toBe(30)
    expect(inicios().slice(0, 2)).toEqual(['12:00', '14:30'])
    const clinic = getClinic(db)
    saveClinic(db, { ...clinic, margem_deslocamento: 60 }, clinic.updated_at)
    expect(getClinic(db).margem_deslocamento).toBe(60)
    expect(inicios()[0]).toBe('15:00')
    expect(inicios()).not.toContain('12:00')
    expect(
      whoFits(db, { inicio: `${QUA}T14:30`, fim: `${QUA}T15:30` }).map((c) => c.espera.patient_id)
    ).toEqual([])
    addToWaitlist(db, { patient_id: ana, duracao: 30 })
    expect(whoFits(db, { inicio: `${QUA}T14:30`, fim: `${QUA}T15:30` })[0].inicio).toBe(
      `${QUA}T15:00`
    )
  })

  it('o banco recusa margem fora do intervalo', () => {
    expect(() => db.prepare('UPDATE clinic SET margem_deslocamento = 200').run()).toThrow(/CHECK/)
  })
})

describe('operações', () => {
  it('avisam os tópicos certos', () => {
    const topics: string[][] = []
    const on = (t: string[]): number => topics.push(t)
    expect(
      runOperation(
        db,
        'commitments:create',
        [{ tipo: 'reserva', inicio: `${QUA}T14:00`, fim: `${QUA}T15:00` }],
        on
      ).ok
    ).toBe(true)
    expect(
      runOperation(
        db,
        'appointments:scheduleOnReserve',
        [1, { patient_id: ana, inicio: `${QUA}T14:00`, fim: `${QUA}T15:00`, observacao: '' }],
        on
      ).ok
    ).toBe(true)
    expect(
      runOperation(
        db,
        'appointments:move',
        [1, { inicio: `${QUA}T15:00`, fim: `${QUA}T16:00` }],
        on
      )
    ).toMatchObject({ ok: true, data: { inicio: `${QUA}T15:00` } })
    expect(runOperation(db, 'commitments:create', [{ tipo: 'feriado' }]).ok).toBe(false)
    expect(topics).toEqual([
      ['commitments'],
      ['appointments', 'commitments', 'waitlist'],
      ['appointments']
    ])
  })
})
