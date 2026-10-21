import { describe, expect, it, vi } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO } from '@shared/agenda'
import type { Commitment } from '@shared/commitments'
import type { Appointment } from '@shared/schemas'
import { fakeAppointment } from '@renderer/testing'
import {
  alvoNoPonto,
  aoSoltar,
  avisoDeErro,
  desfazer,
  destinoDe,
  gravar,
  HORARIO_PASSADO,
  horarioDe,
  mesmoLugar,
  minutosDaGrade,
  passouDoLimiar,
  podeArrastar,
  posicaoLivre,
  problemaNoDestino,
  rolagemNaBorda,
  tituloDoAviso,
  topoDoMinuto,
  type Arrastavel,
  type Grade
} from './arrastar'

const AGORA = new Date(2026, 9, 14, 10, 0)

const sessao = (over: Partial<Appointment> & { inicio: string }): Arrastavel => ({
  kind: 'appointment',
  appointment: fakeAppointment({ updated_at: 'v1', ...over })
})

const reuniao: Commitment = {
  id: 7,
  etiqueta_id: 7,
  etiqueta_nome: 'Reunião',
  cor: '#0d9488',
  reserva: false,
  titulo: 'Equipe',
  inicio: '2026-10-15T12:00',
  fim: '2026-10-15T13:00',
  observacao: '',
  created_at: 'x',
  updated_at: 'c1'
}

type Api = Parameters<typeof gravar>[0]

function fakeApi() {
  const fakes = {
    appointments: {
      move: vi.fn(async (id: number, slot: { inicio: string; fim: string }) =>
        fakeAppointment({ id, ...slot, updated_at: 'v2' })
      ),
      update: vi.fn(async (id: number, input: { inicio: string; fim: string }) =>
        fakeAppointment({ id, inicio: input.inicio, fim: input.fim, updated_at: 'v3' })
      )
    },
    commitments: {
      update: vi.fn(async (id: number, input: { inicio: string; fim: string }) => ({
        ...reuniao,
        id,
        inicio: input.inicio,
        fim: input.fim,
        updated_at: 'c2'
      }))
    }
  }
  return { ...fakes, api: fakes as unknown as Api }
}

describe('arrastar na agenda', () => {
  it('só arrasta sessões que ainda não começaram e sem chegada assinada', () => {
    expect(podeArrastar(sessao({ inicio: '2026-10-14T11:00' }), AGORA)).toBe(true)
    expect(podeArrastar(sessao({ inicio: '2026-10-14T09:00' }), AGORA)).toBe(false)
    expect(
      podeArrastar(
        sessao({
          inicio: '2026-10-14T11:00',
          assinatura: { id: 1, signer_nome: 'Mãe', signer_parentesco: 'Mãe', assinado_em: 'x' }
        }),
        AGORA
      )
    ).toBe(false)
    expect(podeArrastar({ kind: 'commitment', commitment: reuniao }, AGORA)).toBe(true)
  })

  it('recusa destino que já passou ou fora do funcionamento', () => {
    const item = sessao({ inicio: '2026-10-14T11:00' })
    expect(
      problemaNoDestino(
        item,
        destinoDe(new Date(2026, 9, 14, 9), new Date(2026, 9, 14, 9, 30)),
        FUNCIONAMENTO_PADRAO,
        AGORA
      )
    ).toBe(HORARIO_PASSADO)
    expect(
      problemaNoDestino(
        item,
        { inicio: '2026-10-18T09:00', fim: '2026-10-18T09:30' },
        FUNCIONAMENTO_PADRAO,
        AGORA
      )
    ).toMatch(/não abre/)
    expect(
      problemaNoDestino(
        item,
        { inicio: '2026-10-15T09:00', fim: '2026-10-15T09:30' },
        FUNCIONAMENTO_PADRAO,
        AGORA
      )
    ).toBeNull()
  })

  it('mover a sessão é remarcar, com o controle de concorrência', async () => {
    const { api, ...fake } = fakeApi()
    const item = sessao({ id: 3, inicio: '2026-10-15T09:00' })
    const destino = { inicio: '2026-10-16T10:00', fim: '2026-10-16T10:30' }
    expect(mesmoLugar(item, destino)).toBe(false)
    expect(tituloDoAviso(item, destino)).toBe('Sessão remarcada')
    await gravar(api, item, destino, 'Recepção')
    expect(fake.appointments.move).toHaveBeenCalledWith(3, destino, 'v1', 'Recepção')
    expect(fake.appointments.update).not.toHaveBeenCalled()
  })

  it('esticar pela borda de baixo só muda a duração', async () => {
    const { api, ...fake } = fakeApi()
    const item = sessao({ id: 4, inicio: '2026-10-15T09:00' })
    const destino = { inicio: '2026-10-15T09:00', fim: '2026-10-15T10:00' }
    expect(tituloDoAviso(item, destino)).toBe('Duração alterada')
    await gravar(api, item, destino, 'Recepção')
    expect(fake.appointments.move).not.toHaveBeenCalled()
    expect(fake.appointments.update).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        inicio: '2026-10-15T09:00',
        fim: '2026-10-15T10:00',
        patient_id: 1
      }),
      'v1',
      'Recepção'
    )
  })

  it('desfazer remarca de volta e devolve a confirmação', async () => {
    const { api, ...fake } = fakeApi()
    const original = sessao({
      id: 5,
      inicio: '2026-10-15T09:00',
      confirmado_em: '2026-10-14T08:00:00Z'
    })
    const gravado = await gravar(
      api,
      original,
      { inicio: '2026-10-16T09:00', fim: '2026-10-16T09:30' },
      'Recepção'
    )
    await desfazer(api, original, gravado, 'Recepção')
    expect(fake.appointments.move).toHaveBeenLastCalledWith(
      5,
      { inicio: '2026-10-15T09:00', fim: '2026-10-15T09:30' },
      'v2',
      'Recepção'
    )
    expect(fake.appointments.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ confirmado: true, inicio: '2026-10-15T09:00' }),
      'v2',
      'Recepção'
    )
  })

  it('compromisso move pela edição comum', async () => {
    const { api, ...fake } = fakeApi()
    const destino = { inicio: '2026-10-15T14:00', fim: '2026-10-15T15:00' }
    await gravar(api, { kind: 'commitment', commitment: reuniao }, destino, 'Recepção')
    expect(fake.commitments.update).toHaveBeenCalledWith(
      7,
      { etiqueta_id: 7, titulo: 'Equipe', observacao: '', ...destino },
      'c1'
    )
  })
})

describe('cartão solto pela grade', () => {
  const grade: Grade = {
    colunas: [
      { dia: new Date(2026, 9, 15), esquerda: 100, direita: 200 },
      { dia: new Date(2026, 9, 16), esquerda: 200, direita: 300 }
    ],
    topo: 50,
    altura: 13 * 60,
    abre: 7 * 60,
    minutos: 13 * 60
  }
  const naGrade = (hora: number, minuto: number): number => grade.topo + hora * 60 + minuto - 7 * 60

  it('só desgruda depois do limiar de movimento', () => {
    expect(passouDoLimiar({ x: 10, y: 10 }, { x: 15, y: 5 })).toBe(false)
    expect(passouDoLimiar({ x: 10, y: 10 }, { x: 10, y: 16 })).toBe(true)
    expect(passouDoLimiar({ x: 10, y: 10 }, { x: 4, y: 10 })).toBe(true)
  })

  it('segue o ponteiro pixel a pixel, sem pular de faixa', () => {
    const pega = { x: 12, y: 9 }
    expect(posicaoLivre({ x: 150, y: 263 }, pega)).toEqual({ x: 138, y: 254 })
    expect(posicaoLivre({ x: 151, y: 264 }, pega)).toEqual({ x: 139, y: 255 })
  })

  it('o destino fica preso ao horário mais próximo, de 15 em 15 minutos', () => {
    expect(alvoNoPonto(grade, 150, naGrade(9, 7), 30)?.destino).toEqual({
      inicio: '2026-10-15T09:00',
      fim: '2026-10-15T09:30'
    })
    expect(alvoNoPonto(grade, 150, naGrade(9, 8), 30)?.destino).toEqual({
      inicio: '2026-10-15T09:15',
      fim: '2026-10-15T09:45'
    })
    expect(alvoNoPonto(grade, 250, naGrade(9, 8), 45)).toEqual({
      coluna: 1,
      minuto: 9 * 60 + 15,
      destino: { inicio: '2026-10-16T09:15', fim: '2026-10-16T10:00' }
    })
  })

  it('não passa do começo nem do fim da grade e fora das colunas não tem destino', () => {
    expect(alvoNoPonto(grade, 150, 0, 30)?.destino.inicio).toBe('2026-10-15T07:00')
    expect(alvoNoPonto(grade, 150, 2000, 60)?.destino).toEqual({
      inicio: '2026-10-15T19:00',
      fim: '2026-10-15T20:00'
    })
    expect(alvoNoPonto(grade, 99, naGrade(9, 0), 30)).toBeNull()
    expect(alvoNoPonto(grade, 300, naGrade(9, 0), 30)).toBeNull()
  })

  it('com a agenda rolada o destino acompanha a grade', () => {
    const rolada = { ...grade, topo: grade.topo - 60 }
    expect(alvoNoPonto(rolada, 150, naGrade(9, 0), 30)?.destino.inicio).toBe('2026-10-15T10:00')
    expect(topoDoMinuto(grade, 9 * 60)).toBe(naGrade(9, 0))
    expect(topoDoMinuto(rolada, 10 * 60)).toBe(naGrade(9, 0))
  })

  it('a escala acompanha as faixas de uma hora do calendário', () => {
    const dia = (h: number, m = 0): Date => new Date(2026, 9, 15, h, m)
    expect(minutosDaGrade(dia(7), dia(20), 60)).toEqual({ abre: 420, minutos: 780 })
    expect(minutosDaGrade(dia(7), dia(23, 59), 60)).toEqual({ abre: 420, minutos: 1020 })
  })

  it('perto da borda a agenda rola sozinha', () => {
    const area = { topo: 100, baixo: 500, esquerda: 0, direita: 400 }
    expect(rolagemNaBorda({ x: 200, y: 300 }, area)).toBe(0)
    expect(rolagemNaBorda({ x: 200, y: 130 }, area)).toBeLessThan(0)
    expect(rolagemNaBorda({ x: 200, y: 20 }, area)).toBe(-14)
    expect(rolagemNaBorda({ x: 200, y: 495 }, area)).toBeGreaterThan(0)
    expect(rolagemNaBorda({ x: 500, y: 495 }, area)).toBe(0)
  })

  it('ao soltar remarca, recusa ou volta para o lugar', () => {
    const item = sessao({ inicio: '2026-10-15T09:00' })
    const soltar = (destino: Parameters<typeof aoSoltar>[1]): ReturnType<typeof aoSoltar> =>
      aoSoltar(item, destino, FUNCIONAMENTO_PADRAO, AGORA)
    expect(soltar(null)).toEqual({ tipo: 'volta' })
    expect(soltar(horarioDe(item))).toEqual({ tipo: 'volta' })
    expect(soltar({ inicio: '2026-10-14T09:00', fim: '2026-10-14T09:30' })).toEqual({
      tipo: 'recusa',
      problema: HORARIO_PASSADO
    })
    const destino = { inicio: '2026-10-16T10:15', fim: '2026-10-16T10:45' }
    expect(soltar(destino)).toEqual({ tipo: 'move', destino })
  })
})

describe('aviso de erro ao mover', () => {
  it('usa o começo da mensagem como título', () => {
    expect(avisoDeErro('Esse horário já está ocupado: Ana Fictícia, das 08:00 às 08:45.')).toEqual({
      title: 'Esse horário já está ocupado',
      description: 'Ana Fictícia, das 08:00 às 08:45.'
    })
    expect(avisoDeErro('A clínica não abre no domingo.')).toEqual({
      title: 'Não foi possível mover',
      description: 'A clínica não abre no domingo.'
    })
  })
})
