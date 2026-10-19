import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { isoToBrDate, parseIsoDate, parseIsoLocalDateTime } from '../shared/dates'
import type { AttendanceRecord, AttendanceReport, Presenca } from '../shared/schemas'
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
  professionalLabel,
  signatureSvg,
  signedAt
} from './document'

const PRESENCA: Record<Presenca, string> = {
  presente: 'Presente',
  falta: 'Faltou',
  desmarcou: 'Desmarcou'
}

const TIPO = { sessao: 'Sessão', avaliacao: 'Avaliação' } as const

function localAt(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm")
}

export function attendanceReportName(report: AttendanceReport): string {
  const periodo = periodLabel(report.de, report.ate).replaceAll('/', '-')
  return fileName('Presença', report.patient.nome, periodo)
}

type Totals = {
  sessoes: number
  presentes: number
  assinadas: number
  faltas: number
  desmarcadas: number
  semRegistro: number
}

function totals(report: AttendanceReport): Totals {
  const t: Totals = {
    sessoes: report.sessions.length,
    presentes: 0,
    assinadas: 0,
    faltas: 0,
    desmarcadas: 0,
    semRegistro: 0
  }
  for (const s of report.sessions) {
    if (s.presenca === 'presente') t.presentes++
    else if (s.presenca === 'falta') t.faltas++
    else if (s.presenca === 'desmarcou') t.desmarcadas++
    else t.semRegistro++
    if (s.records.some((r) => r.anulada === null)) t.assinadas++
  }
  return t
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

function summary(t: Totals): string {
  const parts = [
    plural(t.sessoes, 'sessão', 'sessões'),
    plural(t.presentes, 'presença', 'presenças'),
    plural(t.assinadas, 'chegada assinada', 'chegadas assinadas')
  ]
  if (t.faltas) parts.push(plural(t.faltas, 'falta', 'faltas'))
  if (t.desmarcadas) parts.push(plural(t.desmarcadas, 'desmarcada', 'desmarcadas'))
  if (t.semRegistro)
    parts.push(plural(t.semRegistro, 'sem presença marcada', 'sem presença marcada'))
  return parts.map((p) => `<span>${esc(p)}</span>`).join('')
}

function signer(r: AttendanceRecord): string {
  const { hora } = signedAt(r.assinado_em, r.fuso_minutos)
  return `<span class="who">${esc(r.signer_nome)}</span><span class="soft">${esc(r.signer_parentesco)} · ${hora}</span>`
}

function arrivalCell(s: AttendanceReport['sessions'][number]): string {
  const active = s.records.find((r) => r.anulada === null)
  const voided = s.records.filter((r) => r.anulada !== null)
  const main = active
    ? `<div class="arrival">${signatureSvg(active.traco, 'sig')}<div class="signer">${signer(active)}</div></div>`
    : s.presenca === 'presente'
      ? '<span class="faint">sem assinatura</span>'
      : ''
  const notes = voided
    .map(
      (r) =>
        `<div class="voided"><span>Assinatura de ${esc(r.signer_nome)} anulada em ${esc(localAt(r.anulada!.anulado_em))}</span><span class="faint">${esc(r.anulada!.motivo)}</span></div>`
    )
    .join('')
  return main + notes
}

function sessionRow(s: AttendanceReport['sessions'][number]): string {
  const inicio = parseIsoLocalDateTime(s.inicio)
  const fim = parseIsoLocalDateTime(s.fim)
  const presenca = s.presenca ? PRESENCA[s.presenca] : '—'
  return `<tr>
<td class="date"><span class="day">${format(inicio, 'dd/MM')}</span><span class="soft">${format(inicio, 'EEE', { locale: ptBR }).replace('.', '')}</span></td>
<td class="num">${format(inicio, 'HH:mm')}–${format(fim, 'HH:mm')}</td>
<td>${TIPO[s.tipo]}</td>
<td class="${s.presenca === 'presente' ? '' : 'soft'}">${presenca}</td>
<td>${arrivalCell(s)}</td>
</tr>`
}

function recordRow(r: AttendanceRecord): string {
  const { data, hora } = signedAt(r.assinado_em, r.fuso_minutos)
  return `<tr${r.anulada ? ' class="void"' : ''}>
<td class="num">${r.id}</td>
<td class="num">${isoToBrDate(r.inicio.slice(0, 10))}</td>
<td class="num">${data} ${hora}</td>
<td>${esc(r.computador)}</td>
<td class="hash">${esc(r.registro_sha256)}${r.anulada ? '<span class="status">anulada</span>' : ''}</td>
</tr>`
}

const STYLE = (font: string): string => `${documentStyle(font, {
  margin: '16mm 16mm 18mm',
  fontSize: '9.5pt',
  lineHeight: 1.4
})}
.facts{grid-template-columns:2fr 1fr 2fr}
.summary{display:flex;flex-wrap:wrap;gap:6px 16px;margin:16px 0 10px;font-size:9pt;color:#5f5f68}
.summary span:first-child{color:#1d1d22;font-weight:600}
table{width:100%;border-collapse:collapse}
th{font-size:7.5pt;font-weight:500;color:#77777f;text-align:left;padding:6px 8px}
td{padding:7px 8px;vertical-align:middle}
tbody tr{break-inside:avoid}
tbody tr:nth-child(odd) td{background:#f7f7f9}
.date .day{display:block;font-weight:600}
.date .soft{font-size:8pt}
.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.arrival{display:flex;align-items:center;gap:10px}
.sig{width:100px;height:40px;flex-shrink:0}
.sig path{fill:none;stroke:#1d1d22;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.signer{display:flex;flex-direction:column}
.who{font-weight:500}
.voided{display:flex;flex-direction:column;margin-top:4px;font-size:8pt;color:#5f5f68}
.empty{margin:24px 0;color:#5f5f68}
h2{font-size:10pt;font-weight:600;margin:28px 0 4px;break-after:avoid}
.records td,.records th{font-size:7.5pt;padding:4px 8px}
.records .hash{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:6.8pt;word-break:break-all}
.records .void td{color:#8e8e96}
.records .status{display:block;font-family:'Bricolage',-apple-system,'Segoe UI',sans-serif;font-size:7.5pt}
`

export function attendanceReportHtml(
  report: AttendanceReport,
  options: { font: string; now?: Date }
): string {
  const { clinic, patient } = report
  const now = options.now ?? new Date()
  const records = report.sessions.flatMap((s) => s.records)

  return documentHtml(
    `Relatório de presença · ${patient.nome}`,
    STYLE(options.font),
    `${documentHeader(clinic, {
      titulo: 'Relatório de presença',
      subtitulo: capitalize(periodLabel(report.de, report.ate))
    })}
${documentFacts([
  ['Paciente', patient.nome],
  ['Nascimento', birthLabel(patient.data_nascimento, parseIsoDate(report.ate))],
  ['Profissional', professionalLabel(clinic.profissional, clinic.registro) || '—']
])}
${
  report.sessions.length === 0
    ? '<p class="empty">Nenhuma sessão neste período.</p>'
    : `<div class="summary">${summary(totals(report))}</div>
<table><thead><tr><th>Data</th><th>Horário</th><th>Tipo</th><th>Presença</th><th>Chegada assinada</th></tr></thead>
<tbody>${report.sessions.map(sessionRow).join('')}</tbody></table>`
}
${
  records.length
    ? `<h2>Registros das assinaturas</h2>
<table class="records"><thead><tr><th>Nº</th><th>Sessão</th><th>Assinado em</th><th>Computador</th><th>Código do registro (SHA-256)</th></tr></thead>
<tbody>${records.map(recordRow).join('')}</tbody></table>`
    : ''
}
<p class="note">Assinaturas eletrônicas simples, feitas na tela do computador da recepção na chegada para a sessão. O código de cada registro é calculado no momento da assinatura a partir da sessão, do paciente, de quem assinou, do traço e da hora; qualquer alteração nesses dados muda o código. ${generatedAt(now)}</p>`
  )
}
