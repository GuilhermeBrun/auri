import { format } from 'date-fns'
import { logoDataUrl } from '../shared/clinic'
import { formatAge, isoToBrDate, parseIsoDate } from '../shared/dates'
import { formatCpf, formatPhone } from '../shared/masks'
import type { SignedTermRecord } from '../shared/schemas'
import { lerConteudo, type Trecho } from '../../../web/contrato/assinatura/conteudo'
import { DOCUMENT_CSP, esc, fontFace, signatureSvg, signedAt, utcLabel } from './document'

function trechos(lista: Trecho[]): string {
  return lista
    .map(({ texto, negrito }) => {
      const html = esc(texto).replaceAll('\n', '<br>')
      return negrito ? `<strong>${html}</strong>` : html
    })
    .join('')
}

export function termBodyHtml(texto: string): string {
  return lerConteudo(texto)
    .map((bloco) => {
      if (bloco.tipo === 'titulo') {
        const tag = bloco.nivel === 1 ? 'h2' : 'h3'
        return `<${tag}>${trechos(bloco.trechos)}</${tag}>`
      }
      if (bloco.tipo === 'lista')
        return `<ul>${bloco.itens.map((item) => `<li>${trechos(item)}</li>`).join('')}</ul>`
      return `<p>${trechos(bloco.trechos)}</p>`
    })
    .join('')
}

function phone(numero: string): string {
  const local = numero.startsWith('55') && numero.length >= 12 ? numero.slice(2) : numero
  return formatPhone(local)
}

export function termPdfName(record: SignedTermRecord): string {
  const clean = (text: string): string => text.replace(/[\\/:*?"<>|]/g, '').trim()
  const { data } = signedAt(record.assinado_em, record.fuso_minutos)
  return `${clean(record.titulo)} - ${clean(record.paciente.nome)} - ${data.replaceAll('/', '-')}.pdf`
}

const STYLE = (font: string): string => `
${fontFace(font)}
@page{size:A4;margin:16mm 18mm 18mm}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Bricolage',-apple-system,'Segoe UI',sans-serif;font-optical-sizing:auto;font-size:10pt;line-height:1.5;color:#1d1d22}
.soft{color:#5f5f68}.faint{color:#8e8e96}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:14px;min-width:0}
.brand img{max-height:52px;max-width:150px;object-fit:contain}
.clinic{font-size:14pt;font-weight:600;letter-spacing:-.01em;margin:0}
.title{text-align:right;flex-shrink:0;max-width:60%}
.title h1{font-size:12pt;font-weight:600;margin:0}
.title p{margin:2px 0 0;color:#5f5f68;font-size:9pt}
.texto h2{font-size:13pt;font-weight:600;margin:18px 0 6px;letter-spacing:-.01em}
.texto h3{font-size:11pt;font-weight:600;margin:16px 0 4px}
.texto p{margin:0 0 8px}
.texto ul{margin:0 0 8px;padding-left:18px}
.texto li{margin:2px 0}
.texto strong{font-weight:650}
.facts{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin:22px 0 0;padding:12px 14px;background:#f4f4f6;border-radius:8px;break-inside:avoid}
.facts dt{font-size:7.5pt;color:#77777f}.facts dd{margin:1px 0 0;font-weight:500}
.signature{margin-top:22px;break-inside:avoid}
.sig{width:260px;height:104px;display:block}
.sig path{fill:none;stroke:#1d1d22;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.signer{padding-top:6px;margin-top:2px;width:300px;background:linear-gradient(#1d1d22,#1d1d22) top/100% .6px no-repeat}
.signer .who{font-weight:600}
.when{margin-top:12px;font-size:9pt;color:#5f5f68}
.tech{margin-top:26px;font-size:7.5pt;color:#5f5f68;break-inside:avoid}
.tech h2{font-size:8.5pt;font-weight:600;color:#1d1d22;margin:0 0 6px}
.tech dl{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;margin:0}
.tech dt{color:#77777f}.tech dd{margin:0}
.hash{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:6.8pt;word-break:break-all}
.legal{margin-top:10px}
`

export function termHtml(record: SignedTermRecord, options: { font: string }): string {
  const assinado = signedAt(record.assinado_em, record.fuso_minutos)
  const recebido = format(new Date(record.recebido_em), "dd/MM/yyyy 'às' HH:mm")
  const enviado = format(new Date(record.enviado_em), "dd/MM/yyyy 'às' HH:mm")
  const idade = formatAge(record.paciente.nascimento, parseIsoDate(record.recebido_em.slice(0, 10)))
  const profissional = [record.profissional.nome, record.profissional.registro]
    .filter(Boolean)
    .join(' · ')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
${DOCUMENT_CSP}
<title>${esc(record.titulo)} · ${esc(record.paciente.nome)}</title><style>${STYLE(options.font)}</style></head><body>
<header>
<div class="brand">${record.logo ? `<img src="${logoDataUrl(record.logo)}" alt="">` : ''}<p class="clinic">${esc(record.clinica)}</p></div>
<div class="title"><h1>${esc(record.titulo)}</h1><p>Versão ${record.versao}</p></div>
</header>
<main class="texto">${termBodyHtml(record.texto)}</main>
<dl class="facts">
<div><dt>Paciente</dt><dd>${esc(record.paciente.nome)}</dd></div>
<div><dt>Nascimento</dt><dd>${isoToBrDate(record.paciente.nascimento)}${idade ? ` (${idade})` : ''}</dd></div>
</dl>
<section class="signature">
${signatureSvg(record.traco, 'sig')}
<div class="signer"><div class="who">${esc(record.nome)}</div><div class="soft">CPF ${formatCpf(record.cpf)} · ${esc(record.parentesco)}</div></div>
<p class="when">Assinado no celular em ${assinado.data} às ${assinado.hora} (hora do aparelho, ${utcLabel(record.fuso_minutos)}). Recebido pelo Auri em ${recebido}.${
    profissional ? `<br>Profissional responsável: ${esc(profissional)}.` : ''
  }</p>
</section>
<section class="tech">
<h2>Registro técnico</h2>
<dl>
<dt>Envio</dt><dd>${esc(record.envio)} · para ${esc(phone(record.destino_numero))} em ${enviado}</dd>
<dt>SHA-256 do texto</dt><dd class="hash">${esc(record.texto_sha256)}</dd>
<dt>SHA-256 do documento</dt><dd class="hash">${esc(record.registro_sha256)}</dd>
</dl>
<p class="legal">Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I), aceita pelas partes nos termos da MP 2.200-2/2001, art. 10, § 2º. O SHA-256 do documento é calculado no recebimento a partir do texto, do paciente, de quem assinou, do traço, das horas e do número de destino; qualquer alteração nesses dados muda o código.</p>
</section>
</body></html>`
}
