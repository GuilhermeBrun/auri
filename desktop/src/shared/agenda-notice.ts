import { parseIsoLocalDateTime, toIsoDate } from './dates'

export const AGENDA_CHANGES = [
  'marcou',
  'remarcou',
  'alterou',
  'confirmou',
  'desmarcou',
  'faltou',
  'excluiu',
  'chegou'
] as const
export type AgendaChange = (typeof AGENDA_CHANGES)[number]

export type AgendaNotice = {
  change: AgendaChange
  kind: 'sessao' | 'compromisso'
  nome: string
  inicio: string
  antes?: string
  autor: string
}

export type AgendaNoticeDraft = Omit<AgendaNotice, 'autor'>

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const pad = (n: number): string => String(n).padStart(2, '0')

export function noticeWhen(iso: string, hoje: Date = new Date()): string {
  const date = parseIsoLocalDateTime(iso)
  const hora = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const dia = toIsoDate(date)
  const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1)
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)
  if (dia === toIsoDate(hoje)) return `hoje às ${hora}`
  if (dia === toIsoDate(amanha)) return `amanhã às ${hora}`
  if (dia === toIsoDate(ontem)) return `ontem às ${hora}`
  return `${DIAS[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)} às ${hora}`
}

const VERBOS: Record<Exclude<AgendaChange, 'chegou'>, string> = {
  marcou: 'marcou',
  remarcou: 'remarcou',
  alterou: 'alterou',
  confirmou: 'confirmou',
  desmarcou: 'desmarcou',
  faltou: 'marcou falta de',
  excluiu: 'excluiu'
}

export function noticeText(
  notice: AgendaNotice,
  hoje: Date = new Date()
): { title: string; body: string } {
  const quando = noticeWhen(notice.inicio, hoje)
  const Quando = quando.charAt(0).toUpperCase() + quando.slice(1)
  if (notice.change === 'chegou') {
    return { title: `${notice.nome} chegou`, body: `${Quando}, assinado em ${notice.autor}` }
  }
  const antes =
    notice.antes && notice.antes.slice(0, 10) === notice.inicio.slice(0, 10)
      ? `às ${notice.antes.slice(11, 16)}`
      : notice.antes && noticeWhen(notice.antes, hoje)
  const body = antes && notice.antes !== notice.inicio ? `Agora ${quando}, era ${antes}` : Quando
  const objeto =
    notice.kind === 'sessao' && notice.change !== 'faltou'
      ? `a sessão de ${notice.nome}`
      : notice.nome
  return { title: `${notice.autor} ${VERBOS[notice.change]} ${objeto}`, body }
}
