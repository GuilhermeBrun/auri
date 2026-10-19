export type Trecho = { texto: string; negrito: boolean }

export type Bloco =
  | { tipo: 'titulo'; nivel: 1 | 2; trechos: Trecho[] }
  | { tipo: 'paragrafo'; trechos: Trecho[] }
  | { tipo: 'lista'; itens: Trecho[][] }

const TITULO = /^(#{1,2})\s+(.*)$/
const ITEM = /^[-•]\s+(.*)$/

function trechos(texto: string): Trecho[] {
  const partes = texto.split('**')
  if (partes.length % 2 === 0) {
    const sobra = partes.pop()
    partes[partes.length - 1] += `**${sobra}`
  }
  const lista: Trecho[] = []
  partes.forEach((parte, i) => {
    if (parte === '') return
    const negrito = i % 2 === 1
    const anterior = lista.at(-1)
    if (anterior?.negrito === negrito) anterior.texto += parte
    else lista.push({ texto: parte, negrito })
  })
  return lista
}

const visivel = (lista: Trecho[]): boolean => lista.some(({ texto }) => texto.trim() !== '')

export function lerConteudo(texto: string): Bloco[] {
  const blocos: Bloco[] = []
  let paragrafo: string[] = []
  let itens: string[] = []

  const fecharParagrafo = (): void => {
    const lista = trechos(paragrafo.join('\n'))
    if (visivel(lista)) blocos.push({ tipo: 'paragrafo', trechos: lista })
    paragrafo = []
  }
  const fecharLista = (): void => {
    const lista = itens.map(trechos).filter(visivel)
    if (lista.length > 0) blocos.push({ tipo: 'lista', itens: lista })
    itens = []
  }
  const fechar = (): void => {
    fecharParagrafo()
    fecharLista()
  }

  for (const bruta of texto.split(/\r\n?|\n/)) {
    const linha = bruta.trim()
    const titulo = TITULO.exec(linha)
    const item = ITEM.exec(linha)
    if (linha === '') {
      fechar()
    } else if (titulo) {
      fechar()
      const lista = trechos(titulo[2])
      if (visivel(lista)) {
        blocos.push({ tipo: 'titulo', nivel: titulo[1].length === 1 ? 1 : 2, trechos: lista })
      }
    } else if (item) {
      fecharParagrafo()
      itens.push(item[1])
    } else {
      fecharLista()
      paragrafo.push(linha)
    }
  }
  fechar()
  return blocos
}
