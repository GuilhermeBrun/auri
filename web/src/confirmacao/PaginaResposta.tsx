import { useState } from 'react'
import { Devolucao, type Pagina } from '../assinatura/Devolucao'
import { avaliarResposta } from './estado'

const TEXTOS = {
  titulo: 'Resposta da confirmação',
  comAuri: 'Se o Auri não abriu, copie a resposta e cole no Auri da recepção.',
  semAuri: 'Abra este link no computador da recepção, copie a resposta e cole no Auri.',
  cifrada:
    'A resposta está cifrada: só o Auri que pediu a confirmação consegue ler o que foi respondido.',
  incompleta: 'Peça para quem respondeu enviar de novo pelo mesmo link.'
}

export function PaginaResposta({
  pagina,
  computador,
  abrir
}: {
  pagina?: Pagina
  computador?: boolean
  abrir?: (endereco: string) => void
}) {
  const [atual] = useState<Pagina>(
    () => pagina ?? { endereco: location.href, fragmento: location.hash }
  )
  return (
    <Devolucao
      pagina={atual}
      esquema="auri://confirmacao"
      situacao={avaliarResposta(atual.fragmento)}
      computador={computador}
      abrir={abrir}
      textos={TEXTOS}
      rodape="Esta página não manda nada pela internet. Ela só mostra a resposta, cifrada."
    />
  )
}
