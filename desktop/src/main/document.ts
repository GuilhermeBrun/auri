import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { logoDataUrl } from '../shared/clinic'
import { formatAge, isoToBrDate, parseIsoDate, toIsoDate } from '../shared/dates'
import type { Clinic } from '../shared/schemas'
import { deBase64url } from '../../../web/contrato/assinatura/base64url'
import { ALTURA, LARGURA, decodificar, tracoParaSvg } from '../../../web/contrato/assinatura/traco'

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

const pad = (n: number): string => String(n).padStart(2, '0')

export function signedAt(instante: string | number, fuso: number): { data: string; hora: string } {
  const ms = typeof instante === 'number' ? instante * 1000 : Date.parse(instante)
  const d = new Date(ms + fuso * 60_000)
  return {
    data: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    hora: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
}

export function utcLabel(fuso: number): string {
  const sinal = fuso < 0 ? '−' : '+'
  const total = Math.abs(fuso)
  const minutos = total % 60
  return `UTC${sinal}${Math.floor(total / 60)}${minutos ? `:${pad(minutos)}` : ''}`
}

export function signatureSvg(traco: string, className: string): string {
  let paths: string[]
  try {
    paths = decodificar(deBase64url(traco)).map(tracoParaSvg)
  } catch {
    paths = []
  }
  return `<svg class="${className}" viewBox="0 0 ${LARGURA} ${ALTURA}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${paths
    .map((d) => `<path d="${esc(d)}"/>`)
    .join('')}</svg>`
}

export function fontFace(font: string): string {
  return `@font-face{font-family:'Bricolage';src:url(data:font/woff2;base64,${font}) format('woff2-variations');font-weight:200 800}`
}

export const DOCUMENT_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">`

export const PAGE_FOOTER = `<div style="width:100%;padding:0 16mm;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:7.5px;color:#77777f;text-align:right"><span class="pageNumber"></span> de <span class="totalPages"></span></div>`

export function documentStyle(
  font: string,
  page: { margin: string; fontSize: string; lineHeight: number }
): string {
  return `
${fontFace(font)}
@page{size:A4;margin:${page.margin}}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Bricolage',-apple-system,'Segoe UI',sans-serif;font-optical-sizing:auto;font-size:${page.fontSize};line-height:${page.lineHeight};color:#1d1d22}
.soft{color:#5f5f68}.faint{color:#8e8e96}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
.brand{display:flex;align-items:center;gap:14px;min-width:0}
.brand img{max-height:52px;max-width:150px;object-fit:contain}
.clinic{font-size:15pt;font-weight:600;letter-spacing:-.01em;margin:0}
.contact{margin-top:2px;font-size:8pt;color:#5f5f68}
.title{text-align:right;flex-shrink:0}
.title h1{font-size:12pt;font-weight:600;margin:0}
.title p{margin:2px 0 0;color:#5f5f68}
.facts{display:grid;gap:16px;margin:22px 0 0;padding:12px 14px;background:#f4f4f6;border-radius:8px;break-inside:avoid}
.facts dt{font-size:7.5pt;color:#77777f}.facts dd{margin:1px 0 0;font-weight:500}
.note{margin-top:18px;font-size:7.5pt;color:#5f5f68;max-width:150mm}
`
}

export function documentHtml(title: string, style: string, body: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
${DOCUMENT_CSP}
<title>${esc(title)}</title><style>${style}</style></head><body>
${body}
</body></html>`
}

export type DocumentClinic = Pick<Clinic, 'nome' | 'logo'> &
  Partial<Pick<Clinic, 'documento' | 'endereco' | 'telefone'>>

export function documentHeader(
  clinic: DocumentClinic,
  title: { titulo: string; subtitulo: string }
): string {
  const contact = [clinic.documento, clinic.endereco, clinic.telefone].filter(Boolean) as string[]
  return `<header>
<div class="brand">${clinic.logo ? `<img src="${logoDataUrl(clinic.logo)}" alt="">` : ''}<div>${
    clinic.nome ? `<p class="clinic">${esc(clinic.nome)}</p>` : ''
  }${contact.length ? `<div class="contact">${contact.map(esc).join(' · ')}</div>` : ''}</div></div>
<div class="title"><h1>${esc(title.titulo)}</h1><p>${esc(title.subtitulo)}</p></div>
</header>`
}

export function documentFacts(facts: [string, string][]): string {
  return `<dl class="facts">
${facts.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join('\n')}
</dl>`
}

export function professionalLabel(nome: string, registro: string): string {
  return [nome, registro].filter(Boolean).join(' · ')
}

export function birthLabel(nascimento: string, ref: Date): string {
  if (!nascimento) return '—'
  const idade = formatAge(nascimento, ref)
  return `${isoToBrDate(nascimento)}${idade ? ` (${idade})` : ''}`
}

export function generatedAt(now: Date): string {
  return `Gerado pelo Auri em ${format(now, "dd/MM/yyyy 'às' HH:mm")}.`
}

export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

export function fileName(...parts: string[]): string {
  return `${parts.map((p) => p.replace(/[\\/:*?"<>|]/g, '').trim()).join(' - ')}.pdf`
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
