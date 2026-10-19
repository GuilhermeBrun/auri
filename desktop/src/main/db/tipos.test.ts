import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { createAppointment, getAppointment, updateAppointment } from './appointments'
import { openDatabase, type Db } from './connection'
import { migrate, SCHEMA_VERSION } from './migrations'
import { createPatient } from './patients'
import {
  archiveEtiqueta,
  archiveTipo,
  listEtiquetas,
  listTipos,
  saveEtiqueta,
  saveTipo
} from './tipos'
import { addToWaitlist, listWaitlist } from './waitlist'

let db: Db
let patientId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  patientId = createPatient(db, { ...emptyPatientInput(), nome: 'Paciente Fictício' }).id
})

const at = (inicio: string, fim: string) => ({
  patient_id: patientId,
  inicio,
  fim,
  observacao: ''
})

function versaoDosTipos(): number {
  const probe = new Database(':memory:')
  try {
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      migrate(probe, v)
      const existe = probe
        .prepare("SELECT 1 FROM sqlite_master WHERE name = 'appointment_types'")
        .get()
      if (existe) return v
    }
    throw new Error('migração dos tipos não encontrada')
  } finally {
    probe.close()
  }
}

describe('migração dos tipos', () => {
  it('converte o tipo texto dos agendamentos e da lista de espera no tipo semeado', () => {
    const legacy = new Database(':memory:')
    legacy.pragma('foreign_keys = ON')
    migrate(legacy, versaoDosTipos() - 1)
    legacy.exec(`
      INSERT INTO patients (id, nome) VALUES (1, 'Ana Fictícia'), (2, 'Bruno Fictício');
      INSERT INTO appointments (id, patient_id, inicio, fim, tipo) VALUES
        (10, 1, '2026-10-19T09:00', '2026-10-19T09:30', 'sessao'),
        (11, 1, '2026-10-20T09:00', '2026-10-20T10:00', 'avaliacao');
      INSERT INTO waitlist_entries (patient_id, tipo, duracao) VALUES (2, 'avaliacao', 60);
    `)
    migrate(legacy)
    expect(legacy.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect(
      legacy
        .prepare(
          `SELECT a.id, t.nome, t.categoria FROM appointments a
           JOIN appointment_types t ON t.id = a.tipo_id ORDER BY a.id`
        )
        .all()
    ).toEqual([
      { id: 10, nome: 'Sessão', categoria: 'sessao' },
      { id: 11, nome: 'Avaliação', categoria: 'avaliacao' }
    ])
    expect(
      legacy
        .prepare(
          `SELECT t.categoria FROM waitlist_entries w JOIN appointment_types t ON t.id = w.tipo_id`
        )
        .get()
    ).toEqual({ categoria: 'avaliacao' })
    const colunas = legacy.prepare('PRAGMA table_info(appointments)').all() as { name: string }[]
    expect(colunas.map((c) => c.name)).not.toContain('tipo')
    expect(legacy.pragma('foreign_key_check')).toEqual([])
    legacy.close()
  })

  it('semeia Sessão, Avaliação e Exame', () => {
    expect(listTipos(db).map(({ nome, categoria, duracao }) => [nome, categoria, duracao])).toEqual(
      [
        ['Sessão', 'sessao', 30],
        ['Avaliação', 'avaliacao', 60],
        ['Exame', 'exame', 60]
      ]
    )
  })
})

describe('tipos de atendimento', () => {
  it('cadastra exames e os agenda com nome, cor e categoria', () => {
    const audiometria = saveTipo(db, null, {
      nome: 'Audiometria',
      categoria: 'exame',
      cor: 'violeta',
      duracao: 45
    })
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T09:45'),
      tipo_id: audiometria.id
    })
    expect(a).toMatchObject({
      tipo_id: audiometria.id,
      tipo_nome: 'Audiometria',
      tipo_cor: 'violeta',
      categoria: 'exame'
    })
  })

  it('sem tipo, agenda como a primeira sessão ativa e mantém o tipo na edição', () => {
    const a = createAppointment(db, at('2026-10-19T09:00', '2026-10-19T09:30'))
    expect(a.categoria).toBe('sessao')
    const avaliacao = listTipos(db).find((t) => t.categoria === 'avaliacao')!
    const b = updateAppointment(db, a.id, { ...at(a.inicio, a.fim), tipo_id: avaliacao.id })
    expect(b.tipo_nome).toBe('Avaliação')
    const c = updateAppointment(db, a.id, { ...at(a.inicio, a.fim), observacao: 'ok' })
    expect(c.tipo_nome).toBe('Avaliação')
  })

  it('recusa nome repetido, mudar a categoria e arquivar o último tipo', () => {
    expect(() =>
      saveTipo(db, null, { nome: ' sessão ', categoria: 'sessao', cor: 'azul', duracao: 30 })
    ).toThrow('Já existe um tipo chamado')
    expect(() =>
      saveTipo(db, 1, { nome: 'Sessão', categoria: 'exame', cor: 'grafite', duracao: 30 })
    ).toThrow('A categoria de um tipo não muda.')
    expect(() => db.prepare('DELETE FROM appointment_types WHERE id = 3').run()).toThrow(/arquive/)
    archiveTipo(db, 2, true)
    archiveTipo(db, 3, true)
    expect(() => archiveTipo(db, 1, true)).toThrow('pelo menos um tipo')
  })

  it('tipo arquivado sai das escolhas, mas os agendamentos antigos continuam com ele', () => {
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T10:00'),
      tipo_id: 2
    })
    archiveTipo(db, 2, true)
    expect(listTipos(db).at(-1)).toMatchObject({ id: 2, arquivado: true })
    expect(() =>
      createAppointment(db, { ...at('2026-10-20T09:00', '2026-10-20T10:00'), tipo_id: 2 })
    ).toThrow('foi arquivado')
    expect(updateAppointment(db, a.id, { ...at(a.inicio, a.fim), tipo_id: 2 }).tipo_nome).toBe(
      'Avaliação'
    )
    expect(archiveTipo(db, 2, false).arquivado).toBe(false)
  })

  it('a lista de espera guarda o tipo', () => {
    const entry = addToWaitlist(db, { patient_id: patientId, duracao: 60, tipo_id: 3 })
    expect(entry).toMatchObject({ tipo_id: 3, tipo_nome: 'Exame', categoria: 'exame' })
    expect(listWaitlist(db)[0].tipo_nome).toBe('Exame')
  })
})

describe('etiquetas', () => {
  it('cadastra, marca várias num agendamento e mantém quando a edição não manda', () => {
    const convenio = saveEtiqueta(db, null, { nome: 'Convênio', cor: 'azul' })
    const primeira = saveEtiqueta(db, null, { nome: 'Primeira vez', cor: 'rosa' })
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T09:30'),
      etiquetas: [primeira.id, convenio.id, convenio.id]
    })
    expect(a.etiquetas).toEqual([
      { id: convenio.id, nome: 'Convênio', cor: 'azul' },
      { id: primeira.id, nome: 'Primeira vez', cor: 'rosa' }
    ])
    const semCampo = updateAppointment(db, a.id, { ...at(a.inicio, a.fim), observacao: 'x' })
    expect(semCampo.etiquetas).toHaveLength(2)
    const so = updateAppointment(db, a.id, { ...at(a.inicio, a.fim), etiquetas: [convenio.id] })
    expect(so.etiquetas.map((e) => e.nome)).toEqual(['Convênio'])
    expect(getAppointment(db, a.id).etiquetas).toEqual(so.etiquetas)
  })

  it('etiqueta arquivada não entra em agendamento novo, mas fica nos que já tinham', () => {
    const e = saveEtiqueta(db, null, { nome: 'Convênio', cor: 'azul' })
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T09:30'),
      etiquetas: [e.id]
    })
    archiveEtiqueta(db, e.id, true)
    expect(listEtiquetas(db)[0].arquivado).toBe(true)
    expect(() =>
      createAppointment(db, { ...at('2026-10-20T09:00', '2026-10-20T09:30'), etiquetas: [e.id] })
    ).toThrow('foi arquivada')
    expect(
      updateAppointment(db, a.id, { ...at(a.inicio, a.fim), etiquetas: [e.id] }).etiquetas
    ).toHaveLength(1)
  })

  it('recusa nome repetido e não apaga etiqueta em uso', () => {
    saveEtiqueta(db, null, { nome: 'Convênio', cor: 'azul' })
    expect(() => saveEtiqueta(db, null, { nome: 'CONVÊNIO', cor: 'rosa' })).toThrow(
      'Já existe uma etiqueta'
    )
    expect(() => db.prepare('DELETE FROM tags').run()).toThrow(/arquive/)
  })
})
