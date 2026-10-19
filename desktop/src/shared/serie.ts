import type { PatientFields, SerieEtapa, SerieTipo } from './schemas'
import { normalizeText } from './search'

export const SERIE_TIPO_LABEL: Record<SerieTipo, string> = {
  ano: 'ano',
  serie: 'série',
  grau: 'grau'
}

export const SERIE_ETAPA_LABEL: Record<SerieEtapa, string> = {
  infantil: 'Infantil',
  fundamental: 'Fundamental',
  medio: 'Médio'
}

type Serie = Pick<PatientFields, 'serie_numero' | 'serie_tipo' | 'serie_etapa' | 'serie'>

export type SerieEstruturada = {
  serie_numero: string
  serie_tipo: SerieTipo
  serie_etapa: SerieEtapa | ''
}

export function ordinal(numero: string, tipo: SerieTipo): string {
  return `${numero}${tipo === 'serie' ? 'ª' : 'º'}`
}

export function formatSerie(p: Serie): string {
  if (p.serie_numero !== '' && p.serie_tipo !== '') {
    const base = `${ordinal(p.serie_numero, p.serie_tipo)} ${SERIE_TIPO_LABEL[p.serie_tipo]}`
    return p.serie_etapa === '' ? base : `${base} do ${SERIE_ETAPA_LABEL[p.serie_etapa]}`
  }
  return p.serie.trim()
}

const ETAPAS: [RegExp, SerieEtapa][] = [
  [/^(ensino )?fundamental( (i|ii|1|2))?$|^e\.? ?f\.?( (i|ii|1|2))?$/, 'fundamental'],
  [/^(ensino )?medio$|^e\.? ?m\.?$/, 'medio'],
  [/^(educacao )?infantil$|^e\.? ?i\.?$/, 'infantil']
]

export function parseSerie(texto: string): SerieEstruturada | null {
  const t = normalizeText(texto).replace(/\s+/g, ' ').trim()
  const m = /^(\d{1,2}) ?(?:º|°|ª|o|a|\.)? ?(ano|serie|grau)s?\b(.*)$/.exec(t)
  if (!m || +m[1] === 0) return null
  const resto = m[3]
    .replace(/[()\-–,]/g, ' ')
    .replace(/^\s*(do|da|de)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const etapa = resto === '' ? '' : ETAPAS.find(([re]) => re.test(resto))?.[1]
  if (etapa === undefined) return null
  return {
    serie_numero: String(+m[1]),
    serie_tipo: m[2] as SerieTipo,
    serie_etapa: etapa
  }
}
