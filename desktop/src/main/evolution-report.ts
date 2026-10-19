import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { parseIsoDate, parseIsoLocalDateTime } from '../shared/dates'
import type { Appointment, EvolutionReport, Presenca } from '../shared/schemas'
import {
  birthLabel,
  capitalize,
  documentFacts,
  documentHeader,
  documentHtml,
  documentStyle,
  esc,
  fileName,
  generatedAt,
  periodLabel,
  professionalLabel
} from './document'

const PRESENCA: Record<Presenca, string> = {
  presente: 'Presente',
  falta: 'Faltou',
  desmarcou: 'Desmarcou'
}

const TIPO = { sessao: 'Sessão', avaliacao: 'Avaliação' } as const

export function evolutionReportName(report: EvolutionReport): string {
  const periodo = periodLabel(report.de, report.ate).replaceAll('/', '-')
  return fileName('Evolução', report.patient.nome, periodo)
}

function entry(a: Appointment): string {
  const inicio = parseIsoLocalDateTime(a.inicio)
  const fim = parseIsoLocalDateTime(a.fim)
  const meta = [
    `${format(inicio, 'HH:mm')}–${format(fim, 'HH:mm')}`,
    TIPO[a.tipo],
    a.presenca ? PRESENCA[a.presenca] : ''
  ].filter(Boolean)
  return `<article>
<div class="when"><span class="day">${format(inicio, 'dd/MM/yyyy')}</span><span class="soft">${esc(capitalize(format(inicio, 'EEEE', { locale: ptBR })))}</span><span class="soft">${meta.map(esc).join(' · ')}</span></div>
<div class="text">${esc(a.evolucao)}</div>
</article>`
}

const STYLE = (font: string): string => `${documentStyle(font, {
  margin: '16mm 16mm 18mm',
  fontSize: '9.5pt',
  lineHeight: 1.4
})}
.facts{grid-template-columns:2fr 1fr 2fr}
.summary{margin:16px 0 6px;font-size:9pt;font-weight:600}
article{display:grid;grid-template-columns:34mm 1fr;gap:16px;padding:10px 0}
.when{display:flex;flex-direction:column;font-variant-numeric:tabular-nums;break-inside:avoid}
.when .day{font-weight:600}
.when .soft{font-size:8pt}
.text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:10pt;line-height:1.5}
.empty{margin:24px 0;color:#5f5f68}
`

export function evolutionReportHtml(
  report: EvolutionReport,
  options: { font: string; now?: Date }
): string {
  const { clinic, patient } = report
  const now = options.now ?? new Date()
  const total = report.sessions.length

  return documentHtml(
    `Relatório de evolução · ${patient.nome}`,
    STYLE(options.font),
    `${documentHeader(clinic, {
      titulo: 'Relatório de evolução',
      subtitulo: capitalize(periodLabel(report.de, report.ate))
    })}
${documentFacts([
  ['Paciente', patient.nome],
  ['Nascimento', birthLabel(patient.data_nascimento, parseIsoDate(report.ate))],
  ['Profissional', professionalLabel(clinic.profissional, clinic.registro) || '—']
])}
${
  total === 0
    ? '<p class="empty">Nenhuma evolução registrada neste período.</p>'
    : `<p class="summary">${total === 1 ? '1 evolução' : `${total} evoluções`}</p>
<main>${report.sessions.map(entry).join('\n')}</main>`
}
<p class="note">${generatedAt(now)}</p>`
  )
}
