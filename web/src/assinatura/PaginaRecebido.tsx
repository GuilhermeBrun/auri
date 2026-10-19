import { useState } from 'react'
import { Aviso, Rodape } from './comum'
import { avaliarRecebido, copiar } from './estado'
import { Atualizar, Computador, Copiar, LinkQuebrado } from './icones'

type Pagina = { endereco: string; fragmento: string }

function Pronto({ endereco }: { endereco: string }) {
  const [copiado, setCopiado] = useState<boolean | null>(null)
  return (
    <Aviso
      icone={<Computador />}
      titulo="Resposta do termo assinado"
      acao={
        <>
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => void copiar(endereco).then(setCopiado)}
          >
            <Copiar />
            Copiar resposta
          </button>
          <p className="estado-da-copia" role="status">
            {copiado === true && 'Resposta copiada. Cole no Auri da recepção.'}
            {copiado === false && 'Não deu para copiar. Selecione o link abaixo e copie.'}
          </p>
          {copiado === false && (
            <textarea
              className="mensagem"
              readOnly
              value={endereco}
              aria-label="Resposta"
              onFocus={(evento) => evento.currentTarget.select()}
            />
          )}
        </>
      }
    >
      <p>Abra este link no computador da recepção, copie a resposta e cole no Auri.</p>
      <p className="suave">
        A resposta está cifrada: só o Auri que enviou o termo consegue ler o que foi assinado.
      </p>
    </Aviso>
  )
}

export function PaginaRecebido({ pagina }: { pagina?: Pagina }) {
  const [{ endereco, fragmento }] = useState<Pagina>(
    () => pagina ?? { endereco: location.href, fragmento: location.hash }
  )
  const situacao = avaliarRecebido(fragmento)
  return (
    <main className="folha">
      {situacao === 'pronto' && <Pronto endereco={endereco} />}
      {situacao === 'incompleto' && (
        <Aviso icone={<LinkQuebrado />} titulo="Esta resposta está incompleta">
          <p>Peça para quem assinou enviar de novo pelo mesmo link.</p>
        </Aviso>
      )}
      {situacao === 'versao' && (
        <Aviso
          icone={<Atualizar />}
          titulo="Atualize a página"
          acao={
            <button
              type="button"
              className="botao botao-principal"
              onClick={() => location.reload()}
            >
              <Atualizar />
              Atualizar
            </button>
          }
        >
          <p>Esta resposta é de uma versão mais nova do Auri.</p>
        </Aviso>
      )}
      <Rodape>Esta página não manda nada pela internet. Ela só mostra a resposta, cifrada.</Rodape>
    </main>
  )
}
