import { addDays, differenceInCalendarDays } from 'date-fns'
import { parseIsoDate, toIsoDate } from './dates'

export const GRADE_MINUTOS = 15
export const MARGEM_PADRAO = 30
export const SUGESTOES_POR_DIA = 3
export const SUGESTOES_LIMITE = 12
const DIAS_NO_MAXIMO = 366

export const PERIODOS = ['manha', 'tarde', 'noite'] as const
export type Periodo = (typeof PERIODOS)[number]

export type Funcionamento = { dia_semana: number; abre: string; fecha: string }
export type Atividade = { atividade: string; dia_semana: number; inicio: string; fim: string }
export type AtividadeDoPaciente = Atividade & { patient_id: number }
export type Intervalo = { inicio: string; fim: string }
export type Preferencias = { dias: readonly number[]; periodos: readonly Periodo[] }

export const SEM_PREFERENCIA: Preferencias = { dias: [], periodos: [] }

type Faixa = readonly [number, number]

const HORA = /^(\d{2}):(\d{2})$/
const DATA_HORA = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/

export function minutosDe(hora: string): number | null {
  const m = HORA.exec(hora)
  if (!m) return null
  const [h, min] = [Number(m[1]), Number(m[2])]
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null
  return h * 60 + min
}

export function horaDe(minutos: number): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(Math.floor(minutos / 60))}:${pad(minutos % 60)}`
}

export function periodoDe(minutos: number): Periodo {
  if (minutos < 12 * 60) return 'manha'
  if (minutos < 18 * 60) return 'tarde'
  return 'noite'
}

export function diaDaSemana(data: string): number {
  return parseIsoDate(data).getDay()
}

function partes(dataHora: string): { data: string; minutos: number } | null {
  const m = DATA_HORA.exec(dataHora)
  if (!m) return null
  const minutos = minutosDe(m[2])
  return minutos === null || minutos >= 24 * 60 ? null : { data: m[1], minutos }
}

const sobrepoe = (a: Faixa, b: Faixa): boolean => a[0] < b[1] && b[0] < a[1]

function faixa(inicio: string, fim: string): Faixa | null {
  const a = minutosDe(inicio)
  const b = minutosDe(fim)
  return a === null || b === null || b <= a ? null : [a, b]
}

function turnosDoDia(funcionamento: readonly Funcionamento[], dia: number): Faixa[] {
  return funcionamento
    .filter((f) => f.dia_semana === dia)
    .map((f) => faixa(f.abre, f.fecha))
    .filter((f): f is Faixa => f !== null)
    .sort((a, b) => a[0] - b[0])
}

function ocupadosDoDia(ocupados: readonly Intervalo[], data: string): Faixa[] {
  const doDia: Faixa[] = []
  for (const o of ocupados) {
    const inicio = partes(o.inicio)
    const fim = partes(o.fim)
    if (!inicio || !fim || inicio.data > data || fim.data < data) continue
    const a = inicio.data < data ? 0 : inicio.minutos
    const b = fim.data > data ? 24 * 60 : fim.minutos
    if (b > a) doDia.push([a, b])
  }
  return doDia
}

function bloqueiosDoDia(atividades: readonly Atividade[], dia: number, margem: number): Faixa[] {
  return atividades
    .filter((a) => a.dia_semana === dia)
    .map((a) => faixa(a.inicio, a.fim))
    .filter((f): f is Faixa => f !== null)
    .map(([a, b]) => [a - margem, b + margem] as const)
}

function bate(preferencias: Preferencias, dia: number, inicio: number): [boolean, boolean] {
  const diaOk = preferencias.dias.length === 0 || preferencias.dias.includes(dia)
  const periodoOk =
    preferencias.periodos.length === 0 || preferencias.periodos.includes(periodoDe(inicio))
  return [diaOk, periodoOk]
}

const duracaoValida = (duracao: number): boolean =>
  Number.isInteger(duracao) && duracao > 0 && duracao <= 24 * 60

export type Sugestao = Intervalo & { preferida: boolean; encostada: boolean }

export type PedidoDeSugestao = {
  de: string
  ate: string
  duracao: number
  funcionamento: readonly Funcionamento[]
  ocupados: readonly Intervalo[]
  atividades?: readonly Atividade[]
  preferencias?: Preferencias
  margem?: number
  depoisDe?: string
  porDia?: number
  limite?: number
}

type Candidata = { sugestao: Sugestao; nota: number; data: string }

function candidatas(pedido: PedidoDeSugestao): Candidata[] {
  const {
    duracao,
    funcionamento,
    ocupados,
    atividades = [],
    preferencias = SEM_PREFERENCIA,
    margem = MARGEM_PADRAO,
    depoisDe
  } = pedido
  const primeiro = parseIsoDate(pedido.de)
  const dias = differenceInCalendarDays(parseIsoDate(pedido.ate), primeiro) + 1
  if (!duracaoValida(duracao) || !(dias > 0) || dias > DIAS_NO_MAXIMO) return []

  const lista: Candidata[] = []
  for (let i = 0; i < dias; i++) {
    const dataDoDia = addDays(primeiro, i)
    const data = toIsoDate(dataDoDia)
    const dia = dataDoDia.getDay()
    const turnos = turnosDoDia(funcionamento, dia)
    if (turnos.length === 0) continue
    const ocupado = ocupadosDoDia(ocupados, data)
    const bloqueio = bloqueiosDoDia(atividades, dia, Math.max(0, margem))

    for (const [abre, fecha] of turnos) {
      const comeco = Math.ceil(abre / GRADE_MINUTOS) * GRADE_MINUTOS
      for (let inicio = comeco; inicio + duracao <= fecha; inicio += GRADE_MINUTOS) {
        const horario: Faixa = [inicio, inicio + duracao]
        if (ocupado.some((o) => sobrepoe(horario, o))) continue
        if (bloqueio.some((b) => sobrepoe(horario, b))) continue
        const comecoIso = `${data}T${horaDe(inicio)}`
        if (depoisDe !== undefined && comecoIso < depoisDe) continue

        const encostada =
          inicio === abre ||
          horario[1] === fecha ||
          ocupado.some(([a, b]) => b === inicio || a === horario[1])
        const [diaOk, periodoOk] = bate(preferencias, dia, inicio)
        lista.push({
          data,
          sugestao: {
            inicio: comecoIso,
            fim: `${data}T${horaDe(horario[1])}`,
            preferida: diaOk && periodoOk,
            encostada
          },
          nota: (diaOk ? 0 : 4) + (periodoOk ? 0 : 2) + (encostada ? 0 : 1)
        })
      }
    }
  }

  return lista
}

export function horariosLivres(pedido: PedidoDeSugestao): Sugestao[] {
  return candidatas(pedido).map((c) => c.sugestao)
}

export function sugerirHorarios(pedido: PedidoDeSugestao): Sugestao[] {
  const { porDia = SUGESTOES_POR_DIA, limite = SUGESTOES_LIMITE } = pedido
  const ordenadas = candidatas(pedido).sort(
    (a, b) => a.nota - b.nota || a.sugestao.inicio.localeCompare(b.sugestao.inicio)
  )
  const porData = new Map<string, Sugestao[]>()
  const escolhidas: Sugestao[] = []
  for (const { data, sugestao } of ordenadas) {
    if (escolhidas.length >= limite) break
    const doDia = porData.get(data) ?? []
    if (doDia.length >= porDia) continue
    if (doDia.some((s) => s.inicio < sugestao.fim && sugestao.inicio < s.fim)) continue
    porData.set(data, [...doDia, sugestao])
    escolhidas.push(sugestao)
  }
  return escolhidas
}

export type Prioridade = 'normal' | 'alta'

export type EsperaQueCabe = Preferencias & {
  id: number
  patient_id: number
  duracao: number
  prioridade: Prioridade
  created_at: string
}

export type Encaixe<T extends EsperaQueCabe> = Intervalo & { espera: T; preferida: boolean }

export type PedidoDeVaga<T extends EsperaQueCabe> = {
  vaga: Intervalo
  esperas: readonly T[]
  atividades?: readonly AtividadeDoPaciente[]
  margem?: number
}

export function quemCabe<T extends EsperaQueCabe>({
  vaga,
  esperas,
  atividades = [],
  margem = MARGEM_PADRAO
}: PedidoDeVaga<T>): Encaixe<T>[] {
  const inicio = partes(vaga.inicio)
  const fim = partes(vaga.fim)
  if (!inicio || !fim || fim.data < inicio.data) return []
  const { data } = inicio
  const abre = inicio.minutos
  const fecha = fim.data > data ? 24 * 60 : fim.minutos
  const dia = diaDaSemana(data)

  const encaixes: Encaixe<T>[] = []
  for (const espera of esperas) {
    if (!duracaoValida(espera.duracao)) continue
    const bloqueio = bloqueiosDoDia(
      atividades.filter((a) => a.patient_id === espera.patient_id),
      dia,
      Math.max(0, margem)
    )
    for (let comeco = abre; comeco + espera.duracao <= fecha; comeco += GRADE_MINUTOS) {
      const horario: Faixa = [comeco, comeco + espera.duracao]
      if (bloqueio.some((b) => sobrepoe(horario, b))) continue
      const [diaOk, periodoOk] = bate(espera, dia, comeco)
      encaixes.push({
        espera,
        inicio: `${data}T${horaDe(horario[0])}`,
        fim: `${data}T${horaDe(horario[1])}`,
        preferida: diaOk && periodoOk
      })
      break
    }
  }

  const peso = (p: Prioridade): number => (p === 'alta' ? 0 : 1)
  return encaixes.sort(
    (a, b) =>
      peso(a.espera.prioridade) - peso(b.espera.prioridade) ||
      Number(b.preferida) - Number(a.preferida) ||
      a.espera.created_at.localeCompare(b.espera.created_at) ||
      a.espera.id - b.espera.id
  )
}
