import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { tipoInputSchema } from '../../shared/tipos'
import { createAppointment, getAppointment, updateAppointment } from './appointments'
import { createCommitment } from './commitments'
import { openDatabase, type Db } from './connection'
import { lancarSessao, saveService, setBilling } from './finance'
import { migrate, SCHEMA_VERSION } from './migrations'
import { createPatient } from './patients'
import { archiveTipo, listTipos, saveTipo } from './tipos'
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

const id = (nome: string): number => listTipos(db).find((t) => t.nome === nome)!.id

const marca = (nome: string, cor = '#2563eb') =>
  saveTipo(db, null, { nome, categoria: 'marca', cor, duracao: null })

function versaoQueTem(sql: string): number {
  const probe = new Database(':memory:')
  try {
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      migrate(probe, v)
      if (probe.prepare(sql).get()) return v
    }
    throw new Error('migração não encontrada')
  } finally {
    probe.close()
  }
}

describe('migração dos tipos', () => {
  it('converte o tipo texto dos agendamentos e da lista de espera no tipo semeado', () => {
    const legacy = new Database(':memory:')
    legacy.pragma('foreign_keys = ON')
    migrate(
      legacy,
      versaoQueTem("SELECT 1 FROM sqlite_master WHERE name = 'appointment_types'") - 1
    )
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
          `SELECT a.id, t.nome, a.categoria FROM appointments a
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
    expect(legacy.pragma('foreign_key_check')).toEqual([])
    legacy.close()
  })
})

describe('migração para uma lista só de etiquetas', () => {
  function antigo(): Database.Database {
    const legacy = new Database(':memory:')
    legacy.pragma('foreign_keys = ON')
    migrate(
      legacy,
      versaoQueTem("SELECT 1 FROM pragma_table_info('commitments') WHERE name = 'etiqueta_id'") - 1
    )
    legacy.exec(`
      INSERT INTO patients (id, nome) VALUES (1, 'Ana Fictícia');
      INSERT INTO appointment_types (id, nome, categoria, cor, duracao, arquivado_em) VALUES
        (4, 'Audiometria', 'exame', 'rosa', 45, NULL),
        (5, 'Antigo', 'sessao', 'areia', 30, '2026-01-01T00:00:00.000Z');
      INSERT INTO tags (id, nome, cor, arquivado_em) VALUES
        (1, 'Convênio', 'azul', NULL),
        (2, 'Primeira vez', 'ardosia', '2026-02-01T00:00:00.000Z'),
        (3, 'Exame', 'violeta', NULL);
      INSERT INTO appointments (id, patient_id, inicio, fim, tipo_id) VALUES
        (10, 1, '2026-10-19T09:00', '2026-10-19T09:30', 1),
        (11, 1, '2026-10-20T09:00', '2026-10-20T09:45', 4);
      INSERT INTO appointment_tags (appointment_id, tag_id) VALUES (10, 1), (10, 2), (11, 3);
      INSERT INTO commitments (id, tipo, titulo, inicio, fim) VALUES
        (20, 'palestra', 'Escola', '2026-10-21T08:00', '2026-10-21T09:00'),
        (21, 'reserva', NULL, '2026-10-21T10:00', '2026-10-21T11:00'),
        (22, 'reuniao', NULL, '2026-10-21T12:00', '2026-10-21T13:00');
    `)
    migrate(legacy)
    return legacy
  }

  it('leva tipos, etiquetas e compromissos para a mesma tabela sem perder nada', () => {
    const legacy = antigo()
    const linhas = legacy
      .prepare(
        `SELECT id, nome, categoria, cor, duracao, sistema, arquivado_em IS NOT NULL AS arquivado
         FROM appointment_types ORDER BY id`
      )
      .all()
    expect(linhas).toEqual([
      {
        id: 1,
        nome: 'Sessão',
        categoria: 'sessao',
        cor: '#6b7280',
        duracao: 30,
        sistema: null,
        arquivado: 0
      },
      {
        id: 2,
        nome: 'Avaliação',
        categoria: 'avaliacao',
        cor: '#2563eb',
        duracao: 60,
        sistema: null,
        arquivado: 0
      },
      {
        id: 3,
        nome: 'Exame',
        categoria: 'exame',
        cor: '#7c3aed',
        duracao: 60,
        sistema: null,
        arquivado: 0
      },
      {
        id: 4,
        nome: 'Audiometria',
        categoria: 'exame',
        cor: '#db2777',
        duracao: 45,
        sistema: null,
        arquivado: 0
      },
      {
        id: 5,
        nome: 'Antigo',
        categoria: 'sessao',
        cor: '#d97706',
        duracao: 30,
        sistema: null,
        arquivado: 1
      },
      {
        id: 6,
        nome: 'Convênio',
        categoria: 'marca',
        cor: '#2563eb',
        duracao: null,
        sistema: null,
        arquivado: 0
      },
      {
        id: 7,
        nome: 'Primeira vez',
        categoria: 'marca',
        cor: '#0ea5e9',
        duracao: null,
        sistema: null,
        arquivado: 1
      },
      {
        id: 8,
        nome: 'Exame (Marca)',
        categoria: 'marca',
        cor: '#7c3aed',
        duracao: null,
        sistema: null,
        arquivado: 0
      },
      {
        id: 9,
        nome: 'Palestra',
        categoria: 'compromisso',
        cor: '#ea580c',
        duracao: 60,
        sistema: null,
        arquivado: 0
      },
      {
        id: 10,
        nome: 'Curso',
        categoria: 'compromisso',
        cor: '#4f46e5',
        duracao: 60,
        sistema: null,
        arquivado: 0
      },
      {
        id: 11,
        nome: 'Hospital',
        categoria: 'compromisso',
        cor: '#e11d48',
        duracao: 60,
        sistema: null,
        arquivado: 0
      },
      {
        id: 12,
        nome: 'Reunião',
        categoria: 'compromisso',
        cor: '#0d9488',
        duracao: 60,
        sistema: null,
        arquivado: 0
      },
      {
        id: 13,
        nome: 'Reserva',
        categoria: 'compromisso',
        cor: '#6b7280',
        duracao: 60,
        sistema: 'reserva',
        arquivado: 0
      }
    ])
    expect(
      legacy.prepare('SELECT appointment_id, tag_id FROM appointment_tags ORDER BY 1, 2').all()
    ).toEqual([
      { appointment_id: 10, tag_id: 6 },
      { appointment_id: 10, tag_id: 7 },
      { appointment_id: 11, tag_id: 8 }
    ])
    expect(
      legacy.prepare('SELECT id, etiqueta_id, titulo FROM commitments ORDER BY id').all()
    ).toEqual([
      { id: 20, etiqueta_id: 9, titulo: 'Escola' },
      { id: 21, etiqueta_id: 13, titulo: null },
      { id: 22, etiqueta_id: 12, titulo: null }
    ])
    expect(legacy.prepare('SELECT id, categoria FROM appointments ORDER BY id').all()).toEqual([
      { id: 10, categoria: 'sessao' },
      { id: 11, categoria: 'exame' }
    ])
    expect(legacy.prepare("SELECT 1 FROM sqlite_master WHERE name = 'tags'").get()).toBeUndefined()
    expect(legacy.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(legacy.pragma('foreign_key_check')).toEqual([])
    expect(legacy.pragma('integrity_check', { simple: true })).toBe('ok')
    legacy.close()
  })

  it('a reserva migrada continua virando agendamento, mesmo renomeada', () => {
    const legacy = antigo()
    saveTipo(legacy, 13, { nome: 'Encaixe', categoria: 'compromisso', cor: '#16a34a', duracao: 60 })
    expect(
      legacy.prepare('SELECT sistema FROM appointment_types WHERE nome = ?').get('Encaixe')
    ).toEqual({ sistema: 'reserva' })
    expect(() =>
      saveTipo(legacy, 13, { nome: 'Encaixe', categoria: 'marca', cor: '#16a34a', duracao: null })
    ).toThrow('A Reserva é sempre um compromisso.')
    legacy.close()
  })
})

describe('etiquetas principais', () => {
  it('semeia Sessão, Avaliação, Exame e os compromissos', () => {
    expect(listTipos(db).map(({ nome, categoria }) => [nome, categoria])).toEqual([
      ['Sessão', 'sessao'],
      ['Avaliação', 'avaliacao'],
      ['Exame', 'exame'],
      ['Palestra', 'compromisso'],
      ['Curso', 'compromisso'],
      ['Hospital', 'compromisso'],
      ['Reunião', 'compromisso'],
      ['Reserva', 'compromisso']
    ])
    expect(listTipos(db).find((t) => t.sistema === 'reserva')?.nome).toBe('Reserva')
  })

  it('cadastra exames e os agenda com nome, cor e categoria', () => {
    const audiometria = saveTipo(db, null, {
      nome: 'Audiometria',
      categoria: 'exame',
      cor: '#7C3AED',
      duracao: 45
    })
    expect(audiometria.cor).toBe('#7c3aed')
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T09:45'),
      tipo_id: audiometria.id
    })
    expect(a).toMatchObject({
      tipo_id: audiometria.id,
      tipo_nome: 'Audiometria',
      tipo_cor: '#7c3aed',
      categoria: 'exame'
    })
  })

  it('sem etiqueta, agenda como a primeira sessão ativa e mantém a etiqueta na edição', () => {
    const a = createAppointment(db, at('2026-10-19T09:00', '2026-10-19T09:30'))
    expect(a.categoria).toBe('sessao')
    const b = updateAppointment(db, a.id, { ...at(a.inicio, a.fim), tipo_id: 2 })
    expect(b).toMatchObject({ tipo_nome: 'Avaliação', categoria: 'avaliacao' })
    const c = updateAppointment(db, a.id, { ...at(a.inicio, a.fim), observacao: 'ok' })
    expect(c.tipo_nome).toBe('Avaliação')
  })

  it('compromisso e marca não viram etiqueta principal da sessão', () => {
    const convenio = marca('Convênio')
    expect(() =>
      createAppointment(db, { ...at('2026-10-19T09:00', '2026-10-19T09:30'), tipo_id: convenio.id })
    ).toThrow('não é uma etiqueta de sessão')
    expect(() =>
      db
        .prepare(
          "INSERT INTO appointments (patient_id, inicio, fim, tipo_id) VALUES (?, '2026-10-19T10:00', '2026-10-19T10:30', ?)"
        )
        .run(patientId, id('Reunião'))
    ).toThrow('Escolha uma etiqueta de sessão')
  })

  it('recusa nome repetido em qualquer categoria e arquivar a última principal', () => {
    expect(() =>
      saveTipo(db, null, { nome: ' reunião ', categoria: 'marca', cor: '#2563eb', duracao: null })
    ).toThrow('Já existe uma etiqueta chamada')
    expect(() => db.prepare('DELETE FROM appointment_types WHERE id = 3').run()).toThrow(/arquive/)
    archiveTipo(db, 2, true)
    archiveTipo(db, 3, true)
    expect(() => archiveTipo(db, 1, true)).toThrow('pelo menos uma etiqueta de sessão')
    for (const nome of ['Palestra', 'Curso', 'Hospital', 'Reunião']) archiveTipo(db, id(nome), true)
    expect(() => archiveTipo(db, id('Reserva'), true)).toThrow('etiqueta de compromisso')
  })

  it('etiqueta arquivada sai das escolhas, mas os agendamentos antigos continuam com ela', () => {
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T10:00'),
      tipo_id: 2
    })
    archiveTipo(db, 2, true)
    expect(listTipos(db).at(-1)).toMatchObject({ id: 2, arquivado: true })
    expect(() =>
      createAppointment(db, { ...at('2026-10-20T09:00', '2026-10-20T10:00'), tipo_id: 2 })
    ).toThrow('foi arquivada')
    expect(updateAppointment(db, a.id, { ...at(a.inicio, a.fim), tipo_id: 2 }).tipo_nome).toBe(
      'Avaliação'
    )
    expect(archiveTipo(db, 2, false).arquivado).toBe(false)
  })

  it('a lista de espera guarda a etiqueta', () => {
    const entry = addToWaitlist(db, { patient_id: patientId, duracao: 60, tipo_id: 3 })
    expect(entry).toMatchObject({ tipo_id: 3, tipo_nome: 'Exame', categoria: 'exame' })
    expect(listWaitlist(db)[0].tipo_nome).toBe('Exame')
  })
})

describe('troca de categoria', () => {
  const AGORA = new Date(2026, 9, 20, 12, 0)

  it('entre sessão, avaliação e exame vale dali para frente; o lançado não muda', () => {
    const servico = saveService(db, null, { nome: 'Sessão', valor_centavos: 19000 }).id
    setBilling(db, patientId, {
      forma: 'particular',
      service_id: servico,
      insurer_id: null,
      carteirinha: '',
      desde: '2026-10-01'
    })
    const lancada = createAppointment(db, at('2026-10-19T09:00', '2026-10-19T09:30'))
    db.prepare("UPDATE appointments SET presenca = 'presente' WHERE id = ?").run(lancada.id)
    lancarSessao(db, lancada.id, 'Recepção')
    const passada = createAppointment(db, at('2026-10-19T10:00', '2026-10-19T10:30'))
    const futura = createAppointment(db, at('2026-10-22T09:00', '2026-10-22T09:30'))

    saveTipo(db, 1, { nome: 'Sessão', categoria: 'avaliacao', cor: '#6b7280', duracao: 30 }, AGORA)

    expect(getAppointment(db, lancada.id).categoria).toBe('sessao')
    expect(getAppointment(db, passada.id).categoria).toBe('sessao')
    expect(getAppointment(db, futura.id).categoria).toBe('avaliacao')
    const nova = createAppointment(db, {
      ...at('2026-10-23T09:00', '2026-10-23T09:30'),
      tipo_id: 1
    })
    expect(nova.categoria).toBe('avaliacao')
  })

  it('para compromisso ou marca só sem uso incompatível', () => {
    const audiometria = saveTipo(db, null, {
      nome: 'Audiometria',
      categoria: 'exame',
      cor: '#7c3aed',
      duracao: 45
    })
    createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T09:45'),
      tipo_id: audiometria.id
    })
    expect(() =>
      saveTipo(db, audiometria.id, { ...audiometria, categoria: 'marca', duracao: null })
    ).toThrow('“Audiometria” está em 1 agendamento. Para virar Marca, crie outra etiqueta.')

    const livre = saveTipo(db, null, {
      nome: 'Triagem',
      categoria: 'exame',
      cor: '#16a34a',
      duracao: 30
    })
    expect(saveTipo(db, livre.id, { ...livre, categoria: 'marca', duracao: null })).toMatchObject({
      categoria: 'marca',
      duracao: null
    })

    const convenio = marca('Convênio')
    createAppointment(db, {
      ...at('2026-10-19T10:00', '2026-10-19T10:30'),
      etiquetas: [convenio.id]
    })
    expect(() =>
      saveTipo(db, convenio.id, { ...convenio, categoria: 'sessao', duracao: 30 })
    ).toThrow('está em 1 agendamento')

    createCommitment(db, {
      etiqueta_id: id('Curso'),
      inicio: '2026-10-21T14:00',
      fim: '2026-10-21T15:00'
    })
    expect(() =>
      saveTipo(db, id('Curso'), {
        nome: 'Curso',
        categoria: 'marca',
        cor: '#4f46e5',
        duracao: null
      })
    ).toThrow('está em 1 compromisso')
    expect(
      saveTipo(db, id('Palestra'), {
        nome: 'Palestra',
        categoria: 'marca',
        cor: '#ea580c',
        duracao: null
      }).categoria
    ).toBe('marca')
  })

  it('o banco também recusa a troca que deixaria dados incoerentes', () => {
    createAppointment(db, at('2026-10-19T09:00', '2026-10-19T09:30'))
    expect(() =>
      db
        .prepare("UPDATE appointment_types SET categoria = 'marca', duracao = NULL WHERE id = 1")
        .run()
    ).toThrow('está em uso')
  })
})

describe('cor', () => {
  it('aceita só hex de seis dígitos e guarda em minúsculas', () => {
    const base = { nome: 'X', categoria: 'marca' as const, duracao: null }
    expect(tipoInputSchema.parse({ ...base, cor: ' #AbCdEf ' }).cor).toBe('#abcdef')
    for (const cor of ['azul', '#abc', '#abcdeg', 'abcdef', '#abcdef0']) {
      expect(tipoInputSchema.safeParse({ ...base, cor }).success).toBe(false)
    }
    expect(() =>
      db.prepare("UPDATE appointment_types SET cor = '#ABCDEF' WHERE id = 1").run()
    ).toThrow(/CHECK/)
    expect(() =>
      db.prepare("UPDATE appointment_types SET cor = 'azul' WHERE id = 1").run()
    ).toThrow(/CHECK/)
  })

  it('marca não tem duração e as outras categorias exigem', () => {
    expect(
      tipoInputSchema.parse({ nome: 'X', categoria: 'marca', cor: '#2563eb', duracao: 30 }).duracao
    ).toBeNull()
    expect(
      tipoInputSchema.safeParse({ nome: 'X', categoria: 'exame', cor: '#2563eb', duracao: null })
        .success
    ).toBe(false)
  })
})

describe('marcas', () => {
  it('cadastra, marca várias num agendamento e mantém quando a edição não manda', () => {
    const convenio = marca('Convênio', '#2563eb')
    const primeira = marca('Primeira vez', '#db2777')
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T09:30'),
      etiquetas: [primeira.id, convenio.id, convenio.id]
    })
    expect(a.etiquetas).toEqual([
      { id: convenio.id, nome: 'Convênio', cor: '#2563eb' },
      { id: primeira.id, nome: 'Primeira vez', cor: '#db2777' }
    ])
    const semCampo = updateAppointment(db, a.id, { ...at(a.inicio, a.fim), observacao: 'x' })
    expect(semCampo.etiquetas).toHaveLength(2)
    const so = updateAppointment(db, a.id, { ...at(a.inicio, a.fim), etiquetas: [convenio.id] })
    expect(so.etiquetas.map((e) => e.nome)).toEqual(['Convênio'])
    expect(getAppointment(db, a.id).etiquetas).toEqual(so.etiquetas)
  })

  it('só marca entra nas marcas da sessão', () => {
    expect(() =>
      createAppointment(db, { ...at('2026-10-19T09:00', '2026-10-19T09:30'), etiquetas: [2] })
    ).toThrow('“Avaliação” não é uma marca.')
  })

  it('marca arquivada não entra em agendamento novo, mas fica nos que já tinham', () => {
    const e = marca('Convênio')
    const a = createAppointment(db, {
      ...at('2026-10-19T09:00', '2026-10-19T09:30'),
      etiquetas: [e.id]
    })
    archiveTipo(db, e.id, true)
    expect(listTipos(db).at(-1)).toMatchObject({ id: e.id, arquivado: true })
    expect(() =>
      createAppointment(db, { ...at('2026-10-20T09:00', '2026-10-20T09:30'), etiquetas: [e.id] })
    ).toThrow('foi arquivada')
    expect(
      updateAppointment(db, a.id, { ...at(a.inicio, a.fim), etiquetas: [e.id] }).etiquetas
    ).toHaveLength(1)
  })
})
