import { describe, expect, it } from 'vite-plus/test'
import {
  abertoNoHorario,
  confirmacao,
  dentroDoFuncionamento,
  diaAberto,
  FUNCIONAMENTO_PADRAO,
  foraDoFuncionamento,
  foraDoFuncionamentoIso,
  horarios,
  horariosDoDia,
  limitesDoFuncionamento,
  resumoFuncionamento
} from './agenda'
import { parseIsoLocalDateTime } from './dates'
import { funcionamentoSchema } from './schemas'

const at = parseIsoLocalDateTime
const SEGUNDA = '2026-10-19'
const SABADO = '2026-10-24'
const DOMINGO = '2026-10-25'

describe('funcionamento padrão', () => {
  it('abre de segunda a sábado e fecha no domingo', () => {
    expect(diaAberto(FUNCIONAMENTO_PADRAO, at(`${SEGUNDA}T10:00`))).toBe(true)
    expect(diaAberto(FUNCIONAMENTO_PADRAO, at(`${SABADO}T10:00`))).toBe(true)
    expect(diaAberto(FUNCIONAMENTO_PADRAO, at(`${DOMINGO}T10:00`))).toBe(false)
  })

  it('sábado só de manhã', () => {
    expect(abertoNoHorario(FUNCIONAMENTO_PADRAO, at(`${SABADO}T11:30`))).toBe(true)
    expect(abertoNoHorario(FUNCIONAMENTO_PADRAO, at(`${SABADO}T12:00`))).toBe(false)
    expect(abertoNoHorario(FUNCIONAMENTO_PADRAO, at(`${SEGUNDA}T19:30`))).toBe(true)
    expect(abertoNoHorario(FUNCIONAMENTO_PADRAO, at(`${SEGUNDA}T06:59`))).toBe(false)
  })
})

describe('dentroDoFuncionamento', () => {
  const dentro = (inicio: string, fim: string): boolean =>
    dentroDoFuncionamento(FUNCIONAMENTO_PADRAO, at(inicio), at(fim))

  it('aceita a sessão que termina na hora de fechar', () => {
    expect(dentro(`${SEGUNDA}T19:30`, `${SEGUNDA}T20:00`)).toBe(true)
    expect(dentro(`${SABADO}T11:30`, `${SABADO}T12:00`)).toBe(true)
    expect(dentro(`${SEGUNDA}T07:00`, `${SEGUNDA}T08:30`)).toBe(true)
  })

  it('recusa começar antes, passar do fechamento, virar o dia ou cair num dia fechado', () => {
    expect(dentro(`${SEGUNDA}T06:30`, `${SEGUNDA}T07:30`)).toBe(false)
    expect(dentro(`${SEGUNDA}T19:30`, `${SEGUNDA}T20:15`)).toBe(false)
    expect(dentro(`${SABADO}T11:30`, `${SABADO}T12:30`)).toBe(false)
    expect(dentro(`${SEGUNDA}T19:30`, '2026-10-20T07:30')).toBe(false)
    expect(dentro(`${DOMINGO}T09:00`, `${DOMINGO}T09:30`)).toBe(false)
  })

  it('explica o motivo', () => {
    expect(
      foraDoFuncionamentoIso(FUNCIONAMENTO_PADRAO, `${DOMINGO}T09:00`, `${DOMINGO}T09:30`)
    ).toBe('A clínica não abre no domingo.')
    expect(
      foraDoFuncionamento(FUNCIONAMENTO_PADRAO, at(`${SABADO}T11:30`), at(`${SABADO}T12:30`))
    ).toBe('Fora do horário de funcionamento: no sábado, a clínica abre das 07:00 às 12:00.')
    expect(
      foraDoFuncionamentoIso(FUNCIONAMENTO_PADRAO, `${SEGUNDA}T09:00`, `${SEGUNDA}T09:30`)
    ).toBeNull()
  })
})

describe('horários', () => {
  it('vai de 15 em 15 minutos, da abertura até o último quarto de hora antes de fechar', () => {
    const semana = horariosDoDia(FUNCIONAMENTO_PADRAO, at(`${SEGUNDA}T10:00`))
    expect(semana[0]).toBe('07:00')
    expect(semana[1]).toBe('07:15')
    expect(semana.at(-1)).toBe('19:45')
    expect(semana).toHaveLength(52)
    expect(horariosDoDia(FUNCIONAMENTO_PADRAO, at(`${SABADO}T10:00`)).at(-1)).toBe('11:45')
    expect(horarios('09:30', '10:30', 30)).toEqual(['09:30', '10:00'])
  })

  it('num dia fechado, oferece os horários da semana', () => {
    expect(horariosDoDia(FUNCIONAMENTO_PADRAO, at(`${DOMINGO}T10:00`))).toHaveLength(52)
    expect(horariosDoDia({}, at(`${DOMINGO}T10:00`))).toEqual([])
  })

  it('limites da grade vêm dos dias abertos', () => {
    expect(limitesDoFuncionamento(FUNCIONAMENTO_PADRAO)).toEqual({ abre: 420, fecha: 1200 })
    expect(limitesDoFuncionamento(FUNCIONAMENTO_PADRAO, [6])).toEqual({ abre: 420, fecha: 720 })
    expect(limitesDoFuncionamento(FUNCIONAMENTO_PADRAO, [0])).toBeNull()
  })
})

describe('resumoFuncionamento', () => {
  it('junta os dias seguidos com o mesmo horário', () => {
    expect(resumoFuncionamento(FUNCIONAMENTO_PADRAO)).toBe('seg a sex 07:00–20:00, sáb 07:00–12:00')
    expect(
      resumoFuncionamento({
        0: { abre: '08:00', fecha: '12:00' },
        1: { abre: '08:00', fecha: '12:00' },
        3: { abre: '08:00', fecha: '12:00' }
      })
    ).toBe('seg 08:00–12:00, qua 08:00–12:00, dom 08:00–12:00')
    expect(resumoFuncionamento({})).toBe('Fechada todos os dias')
  })
})

describe('funcionamentoSchema', () => {
  it('aceita o padrão e recusa horário invertido, hora inválida e dia fora da semana', () => {
    expect(funcionamentoSchema.parse(FUNCIONAMENTO_PADRAO)).toEqual(FUNCIONAMENTO_PADRAO)
    expect(funcionamentoSchema.safeParse({ 1: { abre: '12:00', fecha: '08:00' } }).success).toBe(
      false
    )
    expect(funcionamentoSchema.safeParse({ 1: { abre: '7:00', fecha: '08:00' } }).success).toBe(
      false
    )
    expect(funcionamentoSchema.safeParse({ 7: { abre: '07:00', fecha: '08:00' } }).success).toBe(
      false
    )
  })
})

describe('confirmacao', () => {
  it('sem data de confirmação, não está confirmado', () => {
    expect(confirmacao({ confirmado_em: null })).toBe('pendente')
    expect(confirmacao({ confirmado_em: '2026-10-19T12:00:00.000Z' })).toBe('confirmado')
  })
})
