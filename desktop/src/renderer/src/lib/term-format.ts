const PREFIXO = /^(#{1,2} |- )/

export function formatar(
  texto: string,
  start: number,
  end: number,
  linha: string | null
): { texto: string; start: number; end: number } {
  if (linha === null) {
    const trecho = texto.slice(start, end) || 'texto'
    return {
      texto: `${texto.slice(0, start)}**${trecho}**${texto.slice(end)}`,
      start: start + 2,
      end: start + 2 + trecho.length
    }
  }
  const inicio = start === 0 ? 0 : texto.lastIndexOf('\n', start - 1) + 1
  const fimBruto = texto.indexOf('\n', Math.max(end - 1, start))
  const fim = fimBruto === -1 ? texto.length : fimBruto
  const linhas = texto
    .slice(inicio, fim)
    .split('\n')
    .map((atual) => linha + atual.replace(PREFIXO, ''))
    .join('\n')
  return {
    texto: texto.slice(0, inicio) + linhas + texto.slice(fim),
    start: inicio + linhas.length,
    end: inicio + linhas.length
  }
}
