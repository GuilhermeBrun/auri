import { Fragment, useMemo } from 'react'
import { lerConteudo, type Trecho } from '../../contrato/assinatura/conteudo'

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return trechos.map(({ texto, negrito }, i) =>
    negrito ? <strong key={i}>{texto}</strong> : <Fragment key={i}>{texto}</Fragment>
  )
}

export function Conteudo({ texto }: { texto: string }) {
  const blocos = useMemo(() => lerConteudo(texto), [texto])
  return blocos.map((bloco, i) => {
    if (bloco.tipo === 'lista') {
      return (
        <ul key={i}>
          {bloco.itens.map((item, j) => (
            <li key={j}>
              <Trechos trechos={item} />
            </li>
          ))}
        </ul>
      )
    }
    const Elemento = bloco.tipo === 'paragrafo' ? 'p' : bloco.nivel === 1 ? 'h2' : 'h3'
    return (
      <Elemento key={i}>
        <Trechos trechos={bloco.trechos} />
      </Elemento>
    )
  })
}
