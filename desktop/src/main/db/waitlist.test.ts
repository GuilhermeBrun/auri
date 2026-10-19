import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { runOperation } from '../operations'
import { createAppointment } from './appointments'
import { openDatabase, type Db } from './connection'
import { readAtividades, readFuncionamento, suggestSlots, whoFits } from './encaixe'
import { createPatient, setPatientAtivo } from './patients'
import {
  addToWaitlist,
  closeWaitlist,
  getPatientWaitlist,
  listWaitlist,
  updateWaitlist
} from './waitlist'

let db: Db
let ana: number
let bruno: number

beforeEach(() => {
  db = openDatabase(':memory:')
  ana = createPatient(db, { ...emptyPatientInput(), nome: 'Ana Fictícia' }).id
  bruno = createPatient(db, { ...emptyPatientInput(), nome: 'Bruno Fictício' }).id
})

function stamp(id: number, created: string): void {
  db.prepare('UPDATE waitlist_entries SET created_at = ? WHERE id = ?').run(created, id)
}

describe('lista de espera', () => {
  it('põe na lista com as preferências e devolve com o nome', () => {
    const entry = addToWaitlist(db, {
      patient_id: ana,
      duracao: 45,
      dias: [5, 1, 1],
      periodos: ['tarde', 'manha'],
      observacao: '  Só depois da escola  '
    })
    expect(entry).toMatchObject({
      patient_id: ana,
      patient_nome: 'Ana Fictícia',
      tipo_nome: 'Sessão',
      categoria: 'sessao',
      duracao: 45,
      dias: [1, 5],
      periodos: ['manha', 'tarde'],
      prioridade: 'normal',
      observacao: 'Só depois da escola'
    })
    expect(getPatientWaitlist(db, ana)).toEqual(entry)
    expect(getPatientWaitlist(db, bruno)).toBeNull()
    expect(db.prepare('SELECT dias, periodos FROM waitlist_entries').get()).toEqual({
      dias: '1,5',
      periodos: 'manha,tarde'
    })
  })

  it('sem preferências guarda listas vazias', () => {
    const entry = addToWaitlist(db, { patient_id: ana, duracao: 30 })
    expect(entry).toMatchObject({ dias: [], periodos: [], observacao: '' })
  })

  it('recusa duração fora da grade e paciente que não existe', () => {
    expect(() => addToWaitlist(db, { patient_id: ana, duracao: 40 })).toThrow(/15 minutos/)
    expect(() => addToWaitlist(db, { patient_id: ana, duracao: 300 })).toThrow(/240/)
    expect(() => addToWaitlist(db, { patient_id: 999, duracao: 30 })).toThrow(/não encontrado/)
  })

  it('um paciente fica na lista uma vez só', () => {
    addToWaitlist(db, { patient_id: ana, duracao: 30 })
    expect(() => addToWaitlist(db, { patient_id: ana, duracao: 45 })).toThrow(/já está/)
    expect(() =>
      db.prepare('INSERT INTO waitlist_entries (patient_id, duracao) VALUES (?, 30)').run(ana)
    ).toThrow(/UNIQUE/)
  })

  it('paciente inativo não entra e some da lista', () => {
    addToWaitlist(db, { patient_id: ana, duracao: 30 })
    setPatientAtivo(db, ana, false)
    expect(listWaitlist(db)).toEqual([])
    setPatientAtivo(db, bruno, false)
    expect(() => addToWaitlist(db, { patient_id: bruno, duracao: 30 })).toThrow(/Reative/)
  })

  it('lista a prioridade alta primeiro e depois quem espera há mais tempo', () => {
    const carla = createPatient(db, { ...emptyPatientInput(), nome: 'Carla Fictícia' }).id
    const a = addToWaitlist(db, { patient_id: ana, duracao: 30 })
    const b = addToWaitlist(db, { patient_id: bruno, duracao: 30 })
    const c = addToWaitlist(db, { patient_id: carla, duracao: 30, prioridade: 'alta' })
    stamp(a.id, '2026-10-10T12:00:00.000Z')
    stamp(b.id, '2026-10-01T12:00:00.000Z')
    stamp(c.id, '2026-10-18T12:00:00.000Z')
    expect(listWaitlist(db).map((e) => e.patient_nome)).toEqual([
      'Carla Fictícia',
      'Bruno Fictício',
      'Ana Fictícia'
    ])
  })

  it('edita e recusa salvar por cima de uma mudança de outro computador', () => {
    const entry = addToWaitlist(db, { patient_id: ana, duracao: 30 })
    const updated = updateWaitlist(
      db,
      entry.id,
      { tipo_id: 2, duracao: 60, dias: [3], prioridade: 'alta' },
      entry.updated_at
    )
    expect(updated).toMatchObject({
      tipo_nome: 'Avaliação',
      categoria: 'avaliacao',
      duracao: 60,
      dias: [3],
      prioridade: 'alta'
    })
    db.prepare("UPDATE waitlist_entries SET updated_at = '2000-01-01T00:00:00.000Z'").run()
    expect(() => updateWaitlist(db, entry.id, { duracao: 30 }, updated.updated_at)).toThrow(
      /outro computador/
    )
  })

  it('tira da lista sem apagar e deixa voltar depois', () => {
    const entry = addToWaitlist(db, { patient_id: ana, duracao: 30 })
    closeWaitlist(db, entry.id, { motivo: 'removido' })
    expect(listWaitlist(db)).toEqual([])
    expect(getPatientWaitlist(db, ana)).toBeNull()
    expect(() => closeWaitlist(db, entry.id, { motivo: 'removido' })).toThrow(/já saiu/)
    expect(() => updateWaitlist(db, entry.id, { duracao: 30 })).toThrow(/já saiu/)
    expect(db.prepare('SELECT encerrado_motivo FROM waitlist_entries').get()).toEqual({
      encerrado_motivo: 'removido'
    })
    const again = addToWaitlist(db, { patient_id: ana, duracao: 45 })
    expect(again.id).not.toBe(entry.id)
  })

  it('encerra como agendado ligando ao agendamento do próprio paciente', () => {
    const entry = addToWaitlist(db, { patient_id: ana, duracao: 30 })
    const outro = createAppointment(db, {
      patient_id: bruno,
      inicio: '2026-10-21T14:00',
      fim: '2026-10-21T14:30',
      observacao: ''
    })
    expect(() =>
      closeWaitlist(db, entry.id, { motivo: 'agendado', appointment_id: outro.id })
    ).toThrow(/outro paciente/)
    const sessao = createAppointment(
      db,
      { patient_id: ana, inicio: '2026-10-21T15:00', fim: '2026-10-21T15:30', observacao: '' },
      new Date(2026, 11, 1)
    )
    closeWaitlist(db, entry.id, { motivo: 'agendado', appointment_id: sessao.id })
    expect(
      db.prepare('SELECT encerrado_motivo, appointment_id FROM waitlist_entries').get()
    ).toEqual({ encerrado_motivo: 'agendado', appointment_id: sessao.id })
    db.prepare('DELETE FROM appointments WHERE id = ?').run(sessao.id)
    expect(db.prepare('SELECT appointment_id FROM waitlist_entries').get()).toEqual({
      appointment_id: null
    })
  })

  it('agendar o paciente em qualquer lugar tira ele da lista', () => {
    const entry = addToWaitlist(db, { patient_id: ana, duracao: 30 })
    addToWaitlist(db, { patient_id: bruno, duracao: 30 })
    const sessao = createAppointment(
      db,
      { patient_id: ana, inicio: '2026-10-21T15:00', fim: '2026-10-21T15:30', observacao: '' },
      new Date(2026, 9, 19, 9, 0)
    )
    expect(listWaitlist(db).map((e) => e.patient_nome)).toEqual(['Bruno Fictício'])
    expect(
      db
        .prepare('SELECT encerrado_motivo, appointment_id FROM waitlist_entries WHERE id = ?')
        .get(entry.id)
    ).toEqual({ encerrado_motivo: 'agendado', appointment_id: sessao.id })
  })

  it('lançar uma sessão que já passou não tira da lista', () => {
    addToWaitlist(db, { patient_id: ana, duracao: 30 })
    createAppointment(
      db,
      { patient_id: ana, inicio: '2026-10-14T15:00', fim: '2026-10-14T15:30', observacao: '' },
      new Date(2026, 9, 19, 9, 0)
    )
    expect(getPatientWaitlist(db, ana)).not.toBeNull()
  })

  it('o banco recusa encerramento pela metade', () => {
    const entry = addToWaitlist(db, { patient_id: ana, duracao: 30 })
    expect(() =>
      db
        .prepare("UPDATE waitlist_entries SET encerrado_motivo = 'removido' WHERE id = ?")
        .run(entry.id)
    ).toThrow(/CHECK/)
  })
})

describe('operações do encaixe', () => {
  it('passam pelo canal e avisam o tópico da lista', () => {
    const topics: string[][] = []
    const added = runOperation(db, 'waitlist:add', [{ patient_id: ana, duracao: 30 }], (t) =>
      topics.push(t)
    )
    expect(added.ok).toBe(true)
    expect(topics).toEqual([['waitlist']])
    const list = runOperation(db, 'waitlist:list', [])
    expect(list).toMatchObject({ ok: true, data: [{ patient_nome: 'Ana Fictícia' }] })
    expect(runOperation(db, 'waitlist:add', [{ patient_id: ana, duracao: 7 }])).toEqual({
      ok: false,
      error: 'Use pelo menos 15 minutos'
    })
    expect(runOperation(db, 'waitlist:close', [1, { motivo: 'sumiu' }]).ok).toBe(false)
  })

  it('usa o funcionamento padrão da clínica e nenhuma atividade', () => {
    expect(readFuncionamento(db).map((f) => f.dia_semana)).toEqual([1, 2, 3, 4, 5, 6])
    expect(readAtividades(db, [ana])).toEqual([])
  })

  it('lê o funcionamento e as atividades do banco', () => {
    db.exec(`
      DELETE FROM clinic_hours;
      INSERT INTO clinic_hours (dia_semana, abre, fecha) VALUES (6, '08:00', '12:00');
    `)
    db.prepare(
      "INSERT INTO patient_activities (patient_id, atividade, dia_semana, inicio, fim) VALUES (?, 'Futebol', 6, '09:00', '10:00')"
    ).run(ana)
    db.prepare(
      "INSERT INTO patient_activities (patient_id, atividade, dia_semana, inicio, fim) VALUES (?, 'Judô', 6, '08:00', '09:00')"
    ).run(bruno)
    expect(readFuncionamento(db)).toEqual([{ dia_semana: 6, abre: '08:00', fecha: '12:00' }])
    expect(readAtividades(db, [ana]).map((a) => a.atividade)).toEqual(['Futebol'])

    const sugestoes = suggestSlots(
      db,
      { patient_id: ana, duracao: 45, de: '2026-10-24', ate: '2026-10-24' },
      new Date(2026, 9, 19, 9, 0)
    )
    expect(sugestoes.map((s) => s.inicio.slice(11))).toEqual(['11:15', '10:30'])
  })

  it('sugere fugindo da agenda e do que já passou, e libera a sessão que vai ser remarcada', () => {
    const ocupada = createAppointment(db, {
      patient_id: bruno,
      inicio: '2026-10-19T07:00',
      fim: '2026-10-19T19:15',
      observacao: ''
    })
    const agora = new Date(2026, 9, 19, 6, 0)
    const pedido = { patient_id: ana, duracao: 45, de: '2026-10-19', ate: '2026-10-19' }
    expect(suggestSlots(db, pedido, agora).map((s) => s.inicio.slice(11))).toEqual(['19:15'])
    const remarcar = suggestSlots(db, { ...pedido, ignorar_appointment_id: ocupada.id }, agora)
    expect(remarcar.map((s) => s.inicio.slice(11))).toEqual(['07:00', '19:15', '07:45'])
    expect(suggestSlots(db, pedido, new Date(2026, 9, 19, 19, 30))).toEqual([])
    expect(() => suggestSlots(db, { ...pedido, ate: '2027-01-30' }, agora)).toThrow(/62 dias/)
  })

  it('diz quem da lista cabe num horário vago', () => {
    db.prepare(
      "INSERT INTO patient_activities (patient_id, atividade, dia_semana, inicio, fim) VALUES (?, 'Natação', 3, '13:00', '14:00')"
    ).run(bruno)
    addToWaitlist(db, { patient_id: ana, duracao: 60 })
    addToWaitlist(db, { patient_id: bruno, duracao: 30, prioridade: 'alta' })
    const cabem = whoFits(db, { inicio: '2026-10-21T14:00', fim: '2026-10-21T15:00' })
    expect(cabem.map((c) => [c.espera.patient_nome, c.inicio.slice(11), c.fim.slice(11)])).toEqual([
      ['Bruno Fictício', '14:30', '15:00'],
      ['Ana Fictícia', '14:00', '15:00']
    ])
    expect(whoFits(db, { inicio: '2026-10-21T14:00', fim: '2026-10-21T14:30' })).toHaveLength(0)
    expect(() => whoFits(db, { inicio: '2026-10-21T15:00', fim: '2026-10-21T14:00' })).toThrow()
  })
})
