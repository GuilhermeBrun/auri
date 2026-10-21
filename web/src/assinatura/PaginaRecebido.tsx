import { useState } from 'react'
import { Devolucao, type Pagina } from './Devolucao'
import { avaliarRecebido } from './estado'

const TEXTOS = {
  titulo: 'Resposta do termo assinado',
  comAuri: 'Se o Auri não abriu, copie a resposta e use "Colar resposta" na ficha do paciente.',
  semAuri: 'Abra este link no computador da recepção, copie a resposta e cole no Auri.',
  cifrada: 'A resposta está cifrada: só o Auri que enviou o termo consegue ler o que foi assinado.',
  incompleta: 'Peça para quem assinou enviar de novo pelo mesmo link.'
}

export function PaginaRecebido({
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
      esquema="auri://receber"
      situacao={avaliarRecebido(atual.fragmento)}
      computador={computador}
      abrir={abrir}
      textos={TEXTOS}
      rodape="Esta página não manda nada pela internet. Ela só mostra a resposta, cifrada."
    />
  )
}
