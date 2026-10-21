import { describe, expect, it, vi } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO } from '@shared/agenda'
import type { Commitment } from '@shared/commitments'
import type { Appointment } from '@shared/schemas'
import { fakeAppointment } from '@renderer/testing'
import {
  avisoDeErro,
  desfazer,
  destinoDe,
  gravar,
  HORARIO_PASSADO,
  mesmoLugar,
  podeArrastar,
  problemaNoDestino,
  tituloDoAviso,
  type Arrastavel
} from './arrastar'

const AGORA = new Date(2026, 9, 14, 10, 0)

const sessao = (over: Partial<Appointment> & { inicio: string }): Arrastavel => ({
  kind: 'appointment',
  appointment: fakeAppointment({ updated_at: 'v1', ...over })
})

const reuniao: Commitment = {
  id: 7,
  tipo: 'reuniao',
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
      { tipo: 'reuniao', titulo: 'Equipe', observacao: '', ...destino },
      'c1'
    )
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
