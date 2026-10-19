import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO } from '../../shared/agenda'
import type { ClinicInput } from '../../shared/schemas'
import { getClinic, getFuncionamento, saveClinic } from './clinic'
import { openDatabase, type Db } from './connection'

let db: Db

const LOGO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString('base64')

const dados: Required<ClinicInput> = {
  nome: 'Clínica Fictícia',
  documento: '00.000.000/0001-00',
  endereco: 'Rua Inventada, 10',
  telefone: '(65) 3333-4444',
  whatsapp: '(65) 99999-0000',
  profissional: 'Lara Fictícia',
  registro: 'CRFa 0-0000',
  logo: LOGO,
  margem_deslocamento: 30,
  funcionamento: { 1: { abre: '08:00', fecha: '18:00' }, 6: { abre: '08:00', fecha: '12:00' } }
}

beforeEach(() => {
  db = openDatabase(':memory:')
})

describe('dados da clínica', () => {
  it('começa em branco', () => {
    expect(getClinic(db)).toMatchObject({ nome: '', whatsapp: '', logo: '' })
  })

  it('guarda os dados e o logo', () => {
    const before = getClinic(db)
    const saved = saveClinic(db, dados, before.updated_at)
    expect(saved).toMatchObject(dados)
    expect(getClinic(db)).toEqual(saved)
    const row = db.prepare('SELECT logo FROM clinic').get() as { logo: Buffer }
    expect(row.logo).toBeInstanceOf(Buffer)
  })

  it('tira o logo e esvazia campos', () => {
    saveClinic(db, dados)
    const saved = saveClinic(db, { ...dados, logo: '', documento: '' })
    expect(saved).toMatchObject({ logo: '', documento: '', nome: 'Clínica Fictícia' })
    const row = db.prepare('SELECT logo, documento FROM clinic').get()
    expect(row).toEqual({ logo: null, documento: null })
  })

  it('recusa salvar por cima de uma mudança feita em outro computador', () => {
    const stale = getClinic(db).updated_at
    db.prepare("UPDATE clinic SET updated_at = '2000-01-01T00:00:00.000Z'").run()
    expect(() => saveClinic(db, dados, stale)).toThrow(/outro computador/)
  })

  it('tem uma linha só', () => {
    expect(() => db.prepare('INSERT INTO clinic (id) VALUES (2)').run()).toThrow()
    expect(db.prepare('SELECT count(*) AS n FROM clinic').get()).toEqual({ n: 1 })
  })
})

describe('horário de funcionamento', () => {
  it('começa de segunda a sexta das 7h às 20h, sábado até o meio-dia e domingo fechado', () => {
    expect(getFuncionamento(db)).toEqual(FUNCIONAMENTO_PADRAO)
    expect(getClinic(db).funcionamento).toEqual(FUNCIONAMENTO_PADRAO)
    expect(db.prepare('SELECT * FROM clinic_hours WHERE dia_semana = 0').get()).toBeUndefined()
  })

  it('salva com os dados da clínica: dia ausente é fechado', () => {
    const saved = saveClinic(db, dados)
    expect(saved.funcionamento).toEqual(dados.funcionamento)
    expect(db.prepare('SELECT * FROM clinic_hours ORDER BY dia_semana').all()).toEqual([
      { dia_semana: 1, abre: '08:00', fecha: '18:00' },
      { dia_semana: 6, abre: '08:00', fecha: '12:00' }
    ])
  })

  it('mantém o horário quando quem salva não manda o funcionamento', () => {
    const { funcionamento: _, ...semHorario } = dados
    saveClinic(db, semHorario)
    expect(getFuncionamento(db)).toEqual(FUNCIONAMENTO_PADRAO)
  })

  it('não guarda horário que fecha antes de abrir nem dia fora da semana', () => {
    expect(() => db.prepare("INSERT INTO clinic_hours VALUES (0, '12:00', '08:00')").run()).toThrow(
      /CHECK/
    )
    expect(() => db.prepare("INSERT INTO clinic_hours VALUES (7, '08:00', '12:00')").run()).toThrow(
      /CHECK/
    )
    expect(() => db.prepare("INSERT INTO clinic_hours VALUES (0, '8h', '12:00')").run()).toThrow(
      /CHECK/
    )
  })

  it('desfaz o horário junto quando os dados da clínica não podem ser salvos', () => {
    const stale = getClinic(db).updated_at
    db.prepare("UPDATE clinic SET updated_at = '2000-01-01T00:00:00.000Z'").run()
    expect(() => saveClinic(db, dados, stale)).toThrow(/outro computador/)
    expect(getFuncionamento(db)).toEqual(FUNCIONAMENTO_PADRAO)
  })
})
