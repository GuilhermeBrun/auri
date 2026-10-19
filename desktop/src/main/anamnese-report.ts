import { isoToBrDate, parseIsoDate } from '../shared/dates'
import { ANAMNESE_TEMAS, type AnamneseDocument, type AnamneseTema } from '../shared/schemas'
import {
  birthLabel,
  documentFacts,
  documentHeader,
  documentHtml,
  documentStyle,
  esc,
  fileName,
  generatedAt,
  professionalLabel
} from './document'

export function anamneseName({ patient }: AnamneseDocument): string {
  return fileName('Anamnese', patient.nome)
}

const STYLE = (font: string): string => `${documentStyle(font, {
  margin: '16mm 18mm 18mm',
  fontSize: '10pt',
  lineHeight: 1.5
})}
.facts{grid-template-columns:2fr auto 2fr}
section{margin-top:22px}
h2{font-size:11pt;font-weight:600;margin:0 0 4px;break-after:avoid}
.text{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.empty{margin:24px 0;color:#5f5f68}
`

export function anamneseHtml(doc: AnamneseDocument, options: { font: string; now?: Date }): string {
  const { clinic, patient, anamnese } = doc
  const now = options.now ?? new Date()
  const data = isoToBrDate(anamnese.data)
  const temas = (Object.keys(ANAMNESE_TEMAS) as AnamneseTema[]).filter((t) => anamnese[t].trim())

  return documentHtml(
    `Anamnese · ${patient.nome}`,
    STYLE(options.font),
    `${documentHeader(clinic, { titulo: 'Anamnese', subtitulo: data })}
${documentFacts([
  ['Paciente', patient.nome],
  ['Nascimento', birthLabel(patient.data_nascimento, data ? parseIsoDate(anamnese.data) : now)],
  ['Profissional', professionalLabel(clinic.profissional, clinic.registro) || '—']
])}
${
  temas.length === 0
    ? '<p class="empty">Nenhum tema da anamnese foi preenchido.</p>'
    : temas
        .map(
          (t) =>
            `<section><h2>${esc(ANAMNESE_TEMAS[t])}</h2><p class="text">${esc(anamnese[t])}</p></section>`
        )
        .join('\n')
}
<p class="note">${generatedAt(now)}</p>`
  )
}
