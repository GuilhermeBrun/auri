import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { logoDataUrl } from '../shared/clinic'
import {
  formatAge,
  isoToBrDate,
  parseIsoDate,
  parseIsoLocalDateTime,
  toIsoDate
} from '../shared/dates'
import type { AttendanceRecord, AttendanceReport, Presenca } from '../shared/schemas'
import { deBase64url } from '../../../web/contrato/assinatura/base64url'
import { ALTURA, LARGURA, decodificar, tracoParaSvg } from '../../../web/contrato/assinatura/traco'

const PRESENCA: Record<Presenca, string> = {
  presente: 'Presente',
  falta: 'Faltou',
  desmarcou: 'Desmarcou'
}

const TIPO = { sessao: 'Sessão', avaliacao: 'Avaliação' } as const

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c])
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

const pad = (n: number): string => String(n).padStart(2, '0')

function signedAt(iso: string, fuso: number): { data: string; hora: string } {
  const d = new Date(Date.parse(iso) + fuso * 60_000)
  return {
    data: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    hora: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
}

function localAt(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm")
}

function signatureSvg(traco: string): string {
  let paths: string[]
  try {
    paths = decodificar(deBase64url(traco)).map(tracoParaSvg)
  } catch {
    paths = []
  }
  return `<svg class="sig" viewBox="0 0 ${LARGURA} ${ALTURA}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${paths
    .map((d) => `<path d="${esc(d)}"/>`)
    .join('')}</svg>`
}

function isWholeMonth(de: string, ate: string): boolean {
  const start = parseIsoDate(de)
  return toIsoDate(startOfMonth(start)) === de && toIsoDate(endOfMonth(start)) === ate
}

export function periodLabel(de: string, ate: string): string {
  if (isWholeMonth(de, ate)) return format(parseIsoDate(de), "MMMM 'de' yyyy", { locale: ptBR })
  if (de === ate) return isoToBrDate(de)
  return `${isoToBrDate(de)} a ${isoToBrDate(ate)}`
}

export function attendanceReportName(report: AttendanceReport): string {
  const periodo = periodLabel(report.de, report.ate).replaceAll('/', '-')
  const nome = report.patient.nome.replace(/[\\/:*?"<>|]/g, '').trim()
  return `Presença - ${nome} - ${periodo}.pdf`
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
    ? `<div class="arrival">${signatureSvg(active.traco)}<div class="signer">${signer(active)}</div></div>`
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

const STYLE = (font: string): string => `
@font-face{font-family:'Bricolage';src:url(data:font/woff2;base64,${font}) format('woff2-variations');font-weight:200 800}
@page{size:A4;margin:16mm 16mm 18mm}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Bricolage',-apple-system,'Segoe UI',sans-serif;font-optical-sizing:auto;font-size:9.5pt;line-height:1.4;color:#1d1d22}
.soft{color:#5f5f68}.faint{color:#8e8e96}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
.brand{display:flex;align-items:center;gap:14px;min-width:0}
.brand img{max-height:52px;max-width:150px;object-fit:contain}
.clinic{font-size:15pt;font-weight:600;letter-spacing:-.01em;margin:0}
.contact{margin-top:2px;font-size:8pt;color:#5f5f68}
.title{text-align:right;flex-shrink:0}
.title h1{font-size:12pt;font-weight:600;margin:0}
.title p{margin:2px 0 0;color:#5f5f68}
.facts{display:grid;grid-template-columns:2fr 1fr 2fr;gap:16px;margin:22px 0 0;padding:12px 14px;background:#f4f4f6;border-radius:8px}
.facts dt{font-size:7.5pt;color:#77777f}.facts dd{margin:1px 0 0;font-weight:500}
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
.note{margin-top:18px;font-size:7.5pt;color:#5f5f68;max-width:150mm}
`

export function attendanceReportHtml(
  report: AttendanceReport,
  options: { font: string; now?: Date }
): string {
  const { clinic, patient } = report
  const now = options.now ?? new Date()
  const contact = [clinic.documento, clinic.endereco, clinic.telefone].filter(Boolean)
  const profissional = [clinic.profissional, clinic.registro].filter(Boolean).join(' · ')
  const idade = formatAge(patient.data_nascimento, parseIsoDate(report.ate))
  const nascimento = patient.data_nascimento
    ? `${isoToBrDate(patient.data_nascimento)}${idade ? ` (${idade})` : ''}`
    : '—'
  const records = report.sessions.flatMap((s) => s.records)

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">
<title>Relatório de presença · ${esc(patient.nome)}</title><style>${STYLE(options.font)}</style></head><body>
<header>
<div class="brand">${clinic.logo ? `<img src="${logoDataUrl(clinic.logo)}" alt="">` : ''}<div>${
    clinic.nome ? `<p class="clinic">${esc(clinic.nome)}</p>` : ''
  }${contact.length ? `<div class="contact">${contact.map(esc).join(' · ')}</div>` : ''}</div></div>
<div class="title"><h1>Relatório de presença</h1><p>${esc(capitalize(periodLabel(report.de, report.ate)))}</p></div>
</header>
<dl class="facts">
<div><dt>Paciente</dt><dd>${esc(patient.nome)}</dd></div>
<div><dt>Nascimento</dt><dd>${esc(nascimento)}</dd></div>
<div><dt>Profissional</dt><dd>${profissional ? esc(profissional) : '—'}</dd></div>
</dl>
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
<p class="note">Assinaturas eletrônicas simples, feitas na tela do computador da recepção na chegada para a sessão. O código de cada registro é calculado no momento da assinatura a partir da sessão, do paciente, de quem assinou, do traço e da hora; qualquer alteração nesses dados muda o código. Gerado pelo Auri em ${format(now, "dd/MM/yyyy 'às' HH:mm")}.</p>
</body></html>`
}
