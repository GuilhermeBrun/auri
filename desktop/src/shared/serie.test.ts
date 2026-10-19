import { describe, expect, it } from 'vite-plus/test'
import { formatSerie, parseSerie } from './serie'

const serie = (
  serie_numero: string,
  serie_tipo: '' | 'ano' | 'serie' | 'grau',
  serie_etapa: '' | 'infantil' | 'fundamental' | 'medio' = '',
  texto = ''
): Parameters<typeof formatSerie>[0] => ({ serie_numero, serie_tipo, serie_etapa, serie: texto })

describe('formatSerie', () => {
  it('usa º para ano e grau e ª para série', () => {
    expect(formatSerie(serie('3', 'ano'))).toBe('3º ano')
    expect(formatSerie(serie('2', 'serie'))).toBe('2ª série')
    expect(formatSerie(serie('1', 'grau'))).toBe('1º grau')
  })

  it('acrescenta a etapa quando escolhida', () => {
    expect(formatSerie(serie('5', 'ano', 'fundamental'))).toBe('5º ano do Fundamental')
    expect(formatSerie(serie('2', 'serie', 'medio'))).toBe('2ª série do Médio')
  })

  it('cai no texto livre quando não há número e tipo', () => {
    expect(formatSerie(serie('', '', '', ' Maternal II '))).toBe('Maternal II')
    expect(formatSerie(serie('', ''))).toBe('')
  })
})

describe('parseSerie', () => {
  it('entende as formas comuns de escrever', () => {
    for (const texto of ['3 ano', '3º ano', '3° Ano', '3o ano', '3ºano', ' 3  ANO '])
      expect(parseSerie(texto)).toEqual({ serie_numero: '3', serie_tipo: 'ano', serie_etapa: '' })
    for (const texto of ['2a série', '2ª serie', '2ª Série', '2 series'])
      expect(parseSerie(texto)).toEqual({ serie_numero: '2', serie_tipo: 'serie', serie_etapa: '' })
    expect(parseSerie('1º grau')).toEqual({
      serie_numero: '1',
      serie_tipo: 'grau',
      serie_etapa: ''
    })
  })

  it('entende a etapa depois da série', () => {
    expect(parseSerie('5º ano do Ensino Fundamental')?.serie_etapa).toBe('fundamental')
    expect(parseSerie('5 ano EF')?.serie_etapa).toBe('fundamental')
    expect(parseSerie('1ª série - Ensino Médio')?.serie_etapa).toBe('medio')
    expect(parseSerie('2º ano (EM)')?.serie_etapa).toBe('medio')
    expect(parseSerie('1 ano infantil')?.serie_etapa).toBe('infantil')
  })

  it('devolve null para o que não dá para entender', () => {
    for (const texto of ['', 'Maternal II', 'Pré I', '3º ano B', 'ano 3', '0 ano', 'terceiro ano'])
      expect(parseSerie(texto)).toBeNull()
  })
})
