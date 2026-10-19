import type { Confirmacao, Decisao } from './formato'

const DIAS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado'
]

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
]

const dois = (numero: number): string => String(numero).padStart(2, '0')

type Relogio = { ano: number; mes: number; dia: number; semana: number; hora: number; min: number }

export function relogio(segundos: number, tz: number): Relogio {
  const data = new Date((segundos + tz * 60) * 1000)
  return {
    ano: data.getUTCFullYear(),
    mes: data.getUTCMonth(),
    dia: data.getUTCDate(),
    semana: data.getUTCDay(),
    hora: data.getUTCHours(),
    min: data.getUTCMinutes()
  }
}

export const hora = (segundos: number, tz: number): string => {
  const r = relogio(segundos, tz)
  return `${dois(r.hora)}:${dois(r.min)}`
}

export const diaCurto = (segundos: number, tz: number): string => {
  const r = relogio(segundos, tz)
  return `${dois(r.dia)}/${dois(r.mes + 1)}`
}

export const diaDaSemana = (segundos: number, tz: number): string =>
  DIAS[relogio(segundos, tz).semana]

export function diaPorExtenso(segundos: number, tz: number): string {
  const r = relogio(segundos, tz)
  const semana = DIAS[r.semana]
  return `${semana[0].toUpperCase()}${semana.slice(1)}, ${r.dia} de ${MESES[r.mes]}`
}

const mesmoDia = (a: Relogio, b: Relogio): boolean =>
  a.ano === b.ano && a.mes === b.mes && a.dia === b.dia

export function horario({ ses, tz }: Confirmacao): string {
  return `${hora(ses.ini, tz)} às ${hora(ses.ini + ses.dur * 60, tz)}`
}

export function quando({ ses, tz }: Confirmacao): string {
  return `${diaDaSemana(ses.ini, tz)}, ${diaCurto(ses.ini, tz)}, às ${hora(ses.ini, tz)}`
}

export function prazo({ ate, tz }: Confirmacao, agora: number = Date.now()): string {
  const hoje = mesmoDia(relogio(ate, tz), relogio(Math.floor(agora / 1000), tz))
  return hoje ? `até as ${hora(ate, tz)} de hoje` : `até ${diaCurto(ate, tz)} às ${hora(ate, tz)}`
}

const artigo = (confirmacao: Confirmacao): string =>
  relogio(confirmacao.ses.ini, confirmacao.tz).semana % 6 === 0 ? 'no' : 'na'

export const politica = (confirmacao: Confirmacao): string =>
  confirmacao.cob
    ? 'Sem resposta até lá, o horário fica livre para outro paciente e a sessão é cobrada.'
    : 'Sem resposta até lá, o horário fica livre para outro paciente.'

export function mensagemDaIda(confirmacao: Confirmacao, link: string): string {
  const { cli, pac, ses, ate, tz } = confirmacao
  return [
    `Olá! A ${cli.nome} pede a confirmação da sessão de ${pac.nome} com ${ses.prof} ${artigo(confirmacao)} ${quando(confirmacao)}.`,
    `Responda pelo link até as ${hora(ate, tz)}. ${politica(confirmacao)}`,
    link
  ].join('\n')
}

const ROTULO: Record<Decisao, string> = {
  confirmada: 'Sessão confirmada',
  desmarcada: 'Sessão desmarcada'
}

export const mensagemDaVolta = (confirmacao: Confirmacao, res: Decisao, link: string): string =>
  `${ROTULO[res]}: ${confirmacao.pac.nome} · ${quando(confirmacao)}\n${link}`
