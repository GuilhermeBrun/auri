import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { paraBase64url } from '../../../../web/contrato/assinatura/base64url'
import { codificar } from '../../../../web/contrato/assinatura/traco'
import { emptyPatientInput } from '../../shared/schemas'
import { tipoInputSchema } from '../../shared/tipos'
import { createAppointment, getAppointment, updateAppointment } from './appointments'
import { signArrival } from './attendance'
import { createCommitment, getCommitment } from './commitments'
import { openDatabase, type Db } from './connection'
import { lancarSessao, saveService, setBilling } from './finance'
import { migrate, SCHEMA_VERSION } from './migrations'
import { createPatient } from './patients'
import { listTipos, removeTipo, saveTipo, usoDoTipo } from './tipos'
import { addToWaitlist, closeWaitlist, listWaitlist } from './waitlist'

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
  const unificada = (): number =>
    versaoQueTem("SELECT 1 FROM pragma_table_info('commitments') WHERE name = 'etiqueta_id'")

  function antigo(alvo = SCHEMA_VERSION): Database.Database {
    const legacy = new Database(':memory:')
    legacy.pragma('foreign_keys = ON')
    migrate(legacy, unificada() - 1)
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
    migrate(legacy, alvo)
    return legacy
  }

  it('leva tipos, etiquetas e compromissos para a mesma tabela sem perder nada', () => {
    const legacy = antigo(unificada())
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
      saveTipo(legacy, 13, { nome: 'Encaixe', categoria: 'sessao', cor: '#16a34a', duracao: 60 })
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

  it('compromisso não vira etiqueta da sessão', () => {
    expect(() =>
      createAppointment(db, { ...at('2026-10-19T09:00', '2026-10-19T09:30'), tipo_id: id('Curso') })
    ).toThrow('não é uma etiqueta de sessão')
    expect(() =>
      db
        .prepare(
          "INSERT INTO appointments (patient_id, inicio, fim, tipo_id) VALUES (?, '2026-10-19T10:00', '2026-10-19T10:30', ?)"
        )
        .run(patientId, id('Reunião'))
    ).toThrow('Escolha uma etiqueta de sessão')
  })

  it('recusa nome repetido em qualquer categoria', () => {
    expect(() =>
      saveTipo(db, null, { nome: ' reunião ', categoria: 'sessao', cor: '#2563eb', duracao: 30 })
    ).toThrow('Já existe uma etiqueta chamada')
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

  it('para compromisso só sem uso incompatível', () => {
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
      saveTipo(db, audiometria.id, { ...audiometria, categoria: 'compromisso' })
    ).toThrow('“Audiometria” está em 1 agendamento. Para virar Compromisso, crie outra etiqueta.')

    const livre = saveTipo(db, null, {
      nome: 'Triagem',
      categoria: 'exame',
      cor: '#16a34a',
      duracao: 30
    })
    expect(saveTipo(db, livre.id, { ...livre, categoria: 'compromisso' })).toMatchObject({
      categoria: 'compromisso',
      duracao: 30
    })

    createCommitment(db, {
      etiqueta_id: id('Curso'),
      inicio: '2026-10-21T14:00',
      fim: '2026-10-21T15:00'
    })
    expect(() =>
      saveTipo(db, id('Curso'), {
        nome: 'Curso',
        categoria: 'sessao',
        cor: '#4f46e5',
        duracao: 60
      })
    ).toThrow('está em 1 compromisso')
    expect(
      saveTipo(db, id('Palestra'), {
        nome: 'Palestra',
        categoria: 'sessao',
        cor: '#ea580c',
        duracao: 60
      }).categoria
    ).toBe('sessao')
  })

  it('o banco também recusa a troca que deixaria dados incoerentes', () => {
    createAppointment(db, at('2026-10-19T09:00', '2026-10-19T09:30'))
    expect(() =>
      db.prepare("UPDATE appointment_types SET categoria = 'compromisso' WHERE id = 1").run()
    ).toThrow('está em uso')
  })
})

describe('cor', () => {
  it('aceita só hex de seis dígitos e guarda em minúsculas', () => {
    const base = { nome: 'X', categoria: 'sessao' as const, duracao: 30 }
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

  it('toda etiqueta tem duração e não há mais a categoria Marca', () => {
    expect(
      tipoInputSchema.safeParse({ nome: 'X', categoria: 'exame', cor: '#2563eb', duracao: null })
        .success
    ).toBe(false)
    expect(
      tipoInputSchema.safeParse({ nome: 'X', categoria: 'marca', cor: '#2563eb', duracao: 30 })
        .success
    ).toBe(false)
    expect(() =>
      db
        .prepare(
          "INSERT INTO appointment_types (nome, categoria, cor, duracao) VALUES ('X', 'marca', '#2563eb', 30)"
        )
        .run()
    ).toThrow(/CHECK/)
  })
})

describe('excluir etiqueta', () => {
  const AGORA = new Date(2026, 9, 20, 12, 0)
  const TRACO = paraBase64url(
    codificar([
      [
        [100, 200],
        [300, 120],
        [500, 260]
      ]
    ])
  )

  it('sem uso, exclui; recusa a Reserva e a última de sessão, avaliação ou exame', () => {
    expect(usoDoTipo(db, 3)).toEqual({ agendamentos: 0, compromissos: 0, espera: 0 })
    removeTipo(db, 3, null)
    removeTipo(db, 2, null)
    expect(() => removeTipo(db, 1, null)).toThrow(
      'Deixe pelo menos uma etiqueta de sessão, avaliação ou exame.'
    )
    expect(() => removeTipo(db, id('Reserva'), null)).toThrow('A Reserva não pode ser excluída.')
    for (const nome of ['Palestra', 'Curso', 'Hospital', 'Reunião']) removeTipo(db, id(nome), null)
    expect(listTipos(db).map((t) => t.nome)).toEqual(['Sessão', 'Reserva'])
    expect(() =>
      db.prepare("DELETE FROM appointment_types WHERE sistema = 'reserva'").run()
    ).toThrow('A Reserva não pode ser excluída.')
    expect(
      saveTipo(db, null, { nome: 'Exame', categoria: 'exame', cor: '#7c3aed', duracao: 60 }).nome
    ).toBe('Exame')
  })

  it('em uso, passa agendamentos e lista de espera para outra do grupo, numa transação', () => {
    const servico = saveService(db, null, { nome: 'Exame', valor_centavos: 19000 }).id
    setBilling(db, patientId, {
      forma: 'particular',
      service_id: servico,
      insurer_id: null,
      carteirinha: '',
      desde: '2026-10-01'
    })
    const audiometria = saveTipo(db, null, {
      nome: 'Audiometria',
      categoria: 'exame',
      cor: '#7c3aed',
      duracao: 45
    })
    const com = (inicio: string, fim: string) =>
      createAppointment(db, { ...at(inicio, fim), tipo_id: audiometria.id })
    const lancada = com('2026-10-19T09:00', '2026-10-19T09:45')
    db.prepare("UPDATE appointments SET presenca = 'presente' WHERE id = ?").run(lancada.id)
    lancarSessao(db, lancada.id, 'Recepção')
    const assinada = com('2026-10-20T09:00', '2026-10-20T09:45')
    signArrival(
      db,
      assinada.id,
      { signer_nome: 'Mãe Fictícia', signer_papel: 'mae', signer_parentesco: 'Mãe', traco: TRACO },
      'Recepção',
      new Date(2026, 9, 20, 8, 55)
    )
    const futura = com('2026-10-22T09:00', '2026-10-22T09:45')
    const outro = createPatient(db, { ...emptyPatientInput(), nome: 'Outro Fictício' }).id
    addToWaitlist(db, { patient_id: outro, duracao: 45, tipo_id: audiometria.id })

    expect(usoDoTipo(db, audiometria.id)).toEqual({ agendamentos: 3, compromissos: 0, espera: 1 })
    expect(() => removeTipo(db, audiometria.id, null)).toThrow(
      'Escolha a etiqueta que fica no lugar de “Audiometria”.'
    )
    expect(() => removeTipo(db, audiometria.id, id('Reunião'))).toThrow(
      '“Reunião” não pode ficar no lugar de “Audiometria”.'
    )
    expect(() => removeTipo(db, audiometria.id, audiometria.id)).toThrow('não pode ficar no lugar')
    expect(listTipos(db).some((t) => t.id === audiometria.id)).toBe(true)

    removeTipo(db, audiometria.id, 2, AGORA)

    expect(listTipos(db).some((t) => t.id === audiometria.id)).toBe(false)
    expect(
      [lancada, assinada, futura].map((a) => {
        const depois = getAppointment(db, a.id)
        return [depois.tipo_nome, depois.categoria]
      })
    ).toEqual([
      ['Avaliação', 'exame'],
      ['Avaliação', 'exame'],
      ['Avaliação', 'avaliacao']
    ])
    expect(getAppointment(db, assinada.id).assinatura).not.toBeNull()
    expect(listWaitlist(db)[0]).toMatchObject({ tipo_id: 2, tipo_nome: 'Avaliação' })
    expect(() =>
      updateAppointment(db, assinada.id, { ...at(assinada.inicio, assinada.fim), tipo_id: 1 })
    ).toThrow('foi assinada')
    expect(db.pragma('foreign_key_check')).toEqual([])
  })

  it('compromisso passa para outro compromisso, nunca para a Reserva', () => {
    const c = createCommitment(db, {
      etiqueta_id: id('Curso'),
      inicio: '2026-10-21T14:00',
      fim: '2026-10-21T15:00'
    })
    expect(usoDoTipo(db, id('Curso'))).toEqual({ agendamentos: 0, compromissos: 1, espera: 0 })
    expect(() => removeTipo(db, id('Curso'), id('Reserva'))).toThrow(
      '“Reserva” não pode ficar no lugar de “Curso”.'
    )
    expect(() => removeTipo(db, id('Curso'), 1)).toThrow(
      '“Sessão” não pode ficar no lugar de “Curso”.'
    )
    removeTipo(db, id('Curso'), id('Reunião'))
    expect(getCommitment(db, c.id).etiqueta_nome).toBe('Reunião')
  })

  it('quem já saiu da lista de espera não segura a etiqueta e fica com a padrão', () => {
    const entry = addToWaitlist(db, { patient_id: patientId, duracao: 60, tipo_id: 3 })
    closeWaitlist(db, entry.id, { motivo: 'removido' })
    expect(usoDoTipo(db, 3)).toEqual({ agendamentos: 0, compromissos: 0, espera: 0 })
    removeTipo(db, 3, null)
    expect(db.prepare('SELECT tipo_id FROM waitlist_entries').get()).toEqual({ tipo_id: 1 })
  })

  it('o banco não apaga etiqueta em uso por fora da troca', () => {
    createAppointment(db, at('2026-10-19T09:00', '2026-10-19T09:30'))
    expect(() => db.prepare('DELETE FROM appointment_types WHERE id = 1').run()).toThrow(
      /FOREIGN KEY/
    )
  })
})
