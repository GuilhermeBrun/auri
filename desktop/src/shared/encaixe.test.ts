import fc from 'fast-check'
import { describe, expect, it } from 'vite-plus/test'
import {
  diaDaSemana,
  minutosDe,
  horariosLivres,
  periodoDe,
  quemCabe,
  sugerirHorarios,
  type AtividadeDoPaciente,
  type EsperaQueCabe,
  type Funcionamento,
  type Intervalo,
  type PedidoDeSugestao
} from './encaixe'

const SEG = '2026-10-19'
const QUA = '2026-10-21'
const SAB = '2026-10-24'
const DOM = '2026-10-25'

const SEMANA: Funcionamento[] = [
  ...[1, 2, 3, 4, 5].flatMap((dia) => [
    { dia_semana: dia, abre: '08:00', fecha: '12:00' },
    { dia_semana: dia, abre: '13:00', fecha: '18:00' }
  ]),
  { dia_semana: 6, abre: '08:00', fecha: '12:00' }
]

function pedido(over: Partial<PedidoDeSugestao>): PedidoDeSugestao {
  return { de: SEG, ate: SEG, duracao: 45, funcionamento: SEMANA, ocupados: [], ...over }
}

const horas = (lista: Intervalo[]): string[] => lista.map((s) => s.inicio.slice(11))
const ordem = (lista: Intervalo[]): Intervalo[] =>
  [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio))

describe('peças do motor', () => {
  it('confere a semana usada nos testes', () => {
    expect([SEG, QUA, SAB, DOM].map(diaDaSemana)).toEqual([1, 3, 6, 0])
  })

  it('lê horas e recusa o que não é hora', () => {
    expect(minutosDe('07:30')).toBe(450)
    expect(minutosDe('24:00')).toBe(1440)
    for (const ruim of ['7:30', '24:15', '12:60', '', '12h00']) expect(minutosDe(ruim)).toBeNull()
  })

  it('divide o dia em manhã, tarde e noite pelo início', () => {
    expect([periodoDe(11 * 60 + 45), periodoDe(12 * 60), periodoDe(17 * 60 + 45)]).toEqual([
      'manha',
      'tarde',
      'tarde'
    ])
    expect(periodoDe(18 * 60)).toBe('noite')
  })
})

describe('sugerirHorarios', () => {
  it('dia fechado não tem horário', () => {
    expect(horariosLivres(pedido({ de: DOM, ate: DOM }))).toEqual([])
  })

  it('sábado só de manhã: termina até o meio-dia', () => {
    const sugestoes = ordem(horariosLivres(pedido({ de: SAB, ate: SAB })))
    expect(sugestoes[0]).toMatchObject({ inicio: `${SAB}T08:00`, fim: `${SAB}T08:45` })
    expect(sugestoes.at(-1)).toMatchObject({ inicio: `${SAB}T11:15`, fim: `${SAB}T12:00` })
    expect(sugestoes).toHaveLength(14)
  })

  it('respeita o intervalo do almoço entre os turnos', () => {
    const inicios = horas(ordem(horariosLivres(pedido({ duracao: 60 }))))
    expect(inicios).toContain('11:00')
    expect(inicios).not.toContain('11:15')
    expect(inicios).not.toContain('12:00')
    expect(inicios).toContain('13:00')
    expect(inicios.at(-1)).toBe('17:00')
  })

  it('atividade no meio da tarde fica longe pela margem de deslocamento', () => {
    const natacao = { atividade: 'Natação', dia_semana: 3, inicio: '15:00', fim: '16:00' }
    const inicios = horas(
      ordem(horariosLivres(pedido({ de: QUA, ate: QUA, atividades: [natacao] })))
    )
    expect(inicios).toContain('13:45')
    for (const perto of ['14:00', '14:30', '15:00', '15:45', '16:15']) {
      expect(inicios).not.toContain(perto)
    }
    expect(inicios).toContain('16:30')
  })

  it('a margem é configurável e a atividade vale só no dia dela', () => {
    const natacao = { atividade: 'Natação', dia_semana: 3, inicio: '15:00', fim: '16:00' }
    const semMargem = horas(
      horariosLivres(pedido({ de: QUA, ate: QUA, atividades: [natacao], margem: 0, duracao: 60 }))
    )
    expect(semMargem).toContain('14:00')
    expect(semMargem).toContain('16:00')
    expect(semMargem).not.toContain('14:15')
    const segunda = horariosLivres(pedido({ atividades: [natacao] }))
    expect(horas(segunda)).toContain('15:00')
  })

  it('agenda cheia não tem horário', () => {
    const ocupados = [
      { inicio: `${SEG}T08:00`, fim: `${SEG}T12:00` },
      { inicio: `${SEG}T13:00`, fim: `${SEG}T18:00` }
    ]
    expect(horariosLivres(pedido({ ocupados }))).toEqual([])
  })

  it('só sobra o buraco que cabe a sessão inteira', () => {
    const ocupados = [
      { inicio: `${SEG}T08:00`, fim: `${SEG}T10:00` },
      { inicio: `${SEG}T10:30`, fim: `${SEG}T11:00` },
      { inicio: `${SEG}T11:45`, fim: `${SEG}T12:00` },
      { inicio: `${SEG}T13:00`, fim: `${SEG}T18:00` }
    ]
    const sugestoes = horariosLivres(pedido({ ocupados }))
    expect(sugestoes).toEqual([
      {
        inicio: `${SEG}T11:00`,
        fim: `${SEG}T11:45`,
        preferida: true,
        encostada: true
      }
    ])
  })

  it('agendamento que atravessa a meia-noite ocupa os dois dias', () => {
    const funcionamento = [0, 1].map((dia) => ({ dia_semana: dia, abre: '00:00', fecha: '24:00' }))
    const ocupados = [{ inicio: `${DOM}T23:00`, fim: '2026-10-26T01:00' }]
    const sugestoes = horariosLivres(
      pedido({ de: DOM, ate: '2026-10-26', duracao: 60, funcionamento, ocupados })
    )
    const inicios = sugestoes.map((s) => s.inicio)
    expect(inicios).not.toContain(`${DOM}T22:15`)
    expect(inicios).toContain(`${DOM}T22:00`)
    expect(inicios).not.toContain('2026-10-26T00:30')
    expect(inicios).toContain('2026-10-26T01:00')
    expect(sugestoes.find((s) => s.inicio === `${DOM}T22:00`)?.fim).toBe(`${DOM}T23:00`)
  })

  it('abertura fora da grade começa no próximo quarto de hora', () => {
    const funcionamento = [{ dia_semana: 1, abre: '08:10', fecha: '09:30' }]
    expect(horas(ordem(horariosLivres(pedido({ funcionamento }))))).toEqual([
      '08:15',
      '08:30',
      '08:45'
    ])
  })

  it('ignora linhas de funcionamento inválidas', () => {
    const funcionamento = [
      { dia_semana: 1, abre: '12:00', fecha: '08:00' },
      { dia_semana: 1, abre: '8h', fecha: '18:00' },
      { dia_semana: 1, abre: '09:00', fecha: '09:45' }
    ]
    expect(horas(horariosLivres(pedido({ funcionamento })))).toEqual(['09:00'])
  })

  it('não sugere o que já passou', () => {
    const inicios = horas(ordem(horariosLivres(pedido({ depoisDe: `${SEG}T16:20` }))))
    expect(inicios).toEqual(['16:30', '16:45', '17:00', '17:15'])
  })

  it('dias preferidos vêm primeiro, sem esconder os outros', () => {
    const sugestoes = sugerirHorarios(
      pedido({ ate: SAB, preferencias: { dias: [3], periodos: [] }, porDia: 2, limite: 6 })
    )
    expect(sugestoes.slice(0, 2).map((s) => s.inicio.slice(0, 10))).toEqual([QUA, QUA])
    expect(sugestoes[0].preferida).toBe(true)
    expect(sugestoes[2].inicio.slice(0, 10)).toBe(SEG)
    expect(sugestoes[2].preferida).toBe(false)
  })

  it('período preferido vem antes do outro período do mesmo dia', () => {
    const sugestoes = sugerirHorarios(
      pedido({ preferencias: { dias: [], periodos: ['tarde'] }, porDia: 4 })
    )
    expect(sugestoes.map((s) => s.inicio.slice(11))).toEqual(['13:00', '17:15', '13:45', '14:30'])
    expect(sugestoes.every((s) => s.preferida)).toBe(true)
  })

  it('prefere o horário encostado em outro, para não deixar buraco', () => {
    const ocupados = [{ inicio: `${SEG}T09:00`, fim: `${SEG}T09:30` }]
    const sugestoes = sugerirHorarios(pedido({ ocupados, porDia: 5, duracao: 30 }))
    expect(horas(sugestoes)).toEqual(['08:00', '08:30', '09:30', '11:30', '13:00'])
    expect(sugestoes.every((s) => s.encostada)).toBe(true)
    const soltos = sugerirHorarios(pedido({ ocupados, porDia: 6, duracao: 30 }))
    expect(soltos.at(-1)).toMatchObject({ encostada: true, inicio: `${SEG}T17:30` })
  })

  it('não sugere dois horários sobrepostos no mesmo dia', () => {
    const sugestoes = sugerirHorarios(pedido({ porDia: 10 }))
    expect(horas(ordem(sugestoes))).toEqual([
      '08:00',
      '08:45',
      '09:30',
      '10:15',
      '11:15',
      '13:00',
      '13:45',
      '14:30',
      '15:15',
      '17:15'
    ])
  })

  it('limita por dia e no total, espalhando pelos dias', () => {
    const sugestoes = sugerirHorarios(pedido({ ate: SAB }))
    expect(sugestoes).toHaveLength(12)
    const porDia = new Map<string, number>()
    for (const s of sugestoes)
      porDia.set(s.inicio.slice(0, 10), (porDia.get(s.inicio.slice(0, 10)) ?? 0) + 1)
    expect([...porDia.values()].every((n) => n <= 3)).toBe(true)
    expect(porDia.size).toBe(4)
  })

  it('recusa pedido sem sentido', () => {
    expect(sugerirHorarios(pedido({ duracao: 0 }))).toEqual([])
    expect(sugerirHorarios(pedido({ duracao: 12.5 }))).toEqual([])
    expect(sugerirHorarios(pedido({ de: SAB, ate: SEG }))).toEqual([])
    expect(sugerirHorarios(pedido({ de: 'amanhã' }))).toEqual([])
    expect(sugerirHorarios(pedido({ funcionamento: [] }))).toEqual([])
  })

  it('nunca sugere fora do funcionamento, sobre ocupado ou perto de atividade', () => {
    const hora = fc
      .integer({ min: 0, max: 95 })
      .map(
        (q) =>
          `${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}`
      )
    const dia = fc.integer({ min: 0, max: 6 })
    const data = fc.integer({ min: 19, max: 25 }).map((d) => `2026-10-${d}`)
    fc.assert(
      fc.property(
        fc.array(fc.record({ dia_semana: dia, abre: hora, fecha: hora }), { maxLength: 6 }),
        fc.array(fc.record({ data, inicio: hora, fim: hora }), { maxLength: 8 }),
        fc.array(
          fc.record({ atividade: fc.constant('x'), dia_semana: dia, inicio: hora, fim: hora }),
          {
            maxLength: 3
          }
        ),
        fc.constantFrom(15, 30, 45, 60, 90),
        fc.integer({ min: 0, max: 60 }),
        (funcionamento, brutos, atividades, duracao, margem) => {
          const ocupados = brutos
            .filter((o) => o.fim > o.inicio)
            .map((o) => ({ inicio: `${o.data}T${o.inicio}`, fim: `${o.data}T${o.fim}` }))
          const sugestoes = sugerirHorarios({
            de: SEG,
            ate: DOM,
            duracao,
            funcionamento,
            ocupados,
            atividades,
            margem,
            porDia: 2,
            limite: 20
          })
          expect(sugestoes.length).toBeLessThanOrEqual(14)
          for (const a of sugestoes) {
            const outras = sugestoes.filter((b) => b !== a && b.inicio < a.fim && a.inicio < b.fim)
            expect(outras).toEqual([])
          }
          for (const s of sugestoes) {
            const data = s.inicio.slice(0, 10)
            const ini = minutosDe(s.inicio.slice(11))!
            const fim = minutosDe(s.fim.slice(11))!
            const d = diaDaSemana(data)
            expect(ini % 15).toBe(0)
            expect(fim - ini).toBe(duracao)
            expect(
              funcionamento.some(
                (f) => f.dia_semana === d && minutosDe(f.abre)! <= ini && fim <= minutosDe(f.fecha)!
              )
            ).toBe(true)
            for (const o of ocupados) {
              if (o.inicio.slice(0, 10) !== data) continue
              expect(o.inicio < s.fim && s.inicio < o.fim).toBe(false)
            }
            for (const a of atividades.filter((x) => x.dia_semana === d)) {
              const a0 = minutosDe(a.inicio)! - margem
              const a1 = minutosDe(a.fim)! + margem
              if (minutosDe(a.fim)! > minutosDe(a.inicio)!) expect(ini < a1 && a0 < fim).toBe(false)
            }
          }
        }
      ),
      { seed: 20261019, numRuns: 300 }
    )
  })
})

describe('quemCabe', () => {
  let id = 0
  function espera(over: Partial<EsperaQueCabe>): EsperaQueCabe {
    id += 1
    return {
      id,
      patient_id: id,
      duracao: 45,
      prioridade: 'normal',
      dias: [],
      periodos: [],
      created_at: '2026-10-01T12:00:00.000Z',
      ...over
    }
  }

  const vaga = { inicio: `${QUA}T14:00`, fim: `${QUA}T15:00` }

  it('só cabe quem tem sessão do tamanho da vaga ou menor', () => {
    const curta = espera({ duracao: 30 })
    const exata = espera({ duracao: 60 })
    const longa = espera({ duracao: 90 })
    const cabem = quemCabe({ vaga, esperas: [curta, exata, longa] })
    expect(new Set(cabem.map((c) => c.espera.id))).toEqual(new Set([curta.id, exata.id]))
    expect(cabem.find((c) => c.espera === curta)).toMatchObject({
      inicio: `${QUA}T14:00`,
      fim: `${QUA}T14:30`
    })
  })

  it('desloca dentro da vaga para fugir da margem da atividade', () => {
    const ana = espera({ duracao: 30 })
    const atividades: AtividadeDoPaciente[] = [
      {
        patient_id: ana.patient_id,
        atividade: 'Inglês',
        dia_semana: 3,
        inicio: '13:00',
        fim: '14:00'
      }
    ]
    const [cabe] = quemCabe({ vaga, esperas: [ana], atividades })
    expect(cabe).toMatchObject({ inicio: `${QUA}T14:30`, fim: `${QUA}T15:00` })
    expect(quemCabe({ vaga, esperas: [ana], atividades, margem: 45 })).toEqual([])
  })

  it('atividade de outro paciente ou de outro dia não atrapalha', () => {
    const ana = espera({})
    const atividades: AtividadeDoPaciente[] = [
      { patient_id: 999, atividade: 'Balé', dia_semana: 3, inicio: '14:00', fim: '15:00' },
      {
        patient_id: ana.patient_id,
        atividade: 'Balé',
        dia_semana: 2,
        inicio: '14:00',
        fim: '15:00'
      }
    ]
    expect(quemCabe({ vaga, esperas: [ana], atividades })).toHaveLength(1)
  })

  it('ordena por prioridade, preferência e tempo de espera', () => {
    const antiga = espera({ created_at: '2026-09-01T12:00:00.000Z' })
    const nova = espera({ created_at: '2026-10-10T12:00:00.000Z' })
    const quarta = espera({
      created_at: '2026-10-15T12:00:00.000Z',
      dias: [3],
      periodos: ['tarde']
    })
    const outroDia = espera({ created_at: '2026-08-01T12:00:00.000Z', dias: [1] })
    const urgente = espera({ created_at: '2026-10-18T12:00:00.000Z', prioridade: 'alta' })
    const cabem = quemCabe({ vaga, esperas: [nova, outroDia, antiga, quarta, urgente] })
    expect(cabem.map((c) => c.espera)).toEqual([urgente, antiga, nova, quarta, outroDia])
    expect(cabem.map((c) => c.preferida)).toEqual([true, true, true, true, false])
  })

  it('vaga inválida não tem ninguém', () => {
    const ana = espera({})
    expect(quemCabe({ vaga: { inicio: 'ontem', fim: `${QUA}T15:00` }, esperas: [ana] })).toEqual([])
    expect(
      quemCabe({ vaga: { inicio: `${QUA}T15:00`, fim: `${QUA}T14:00` }, esperas: [ana] })
    ).toEqual([])
  })
})
