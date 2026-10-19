import { useEffect, useState } from 'react'
import { Aviso, Rodape } from './comum'
import { avaliarRecebido, copiar } from './estado'
import { Atualizar, Carregando, Computador, Copiar, LinkQuebrado } from './icones'

type Pagina = { endereco: string; fragmento: string }

const noComputador = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true

const abrirNoNavegador = (endereco: string): void => {
  location.href = endereco
}

function Pronto({
  endereco,
  fragmento,
  computador,
  abrir
}: {
  endereco: string
  fragmento: string
  computador: boolean
  abrir: (endereco: string) => void
}) {
  const auri = `auri://receber#${fragmento.replace(/^#/, '')}`
  const [esperando, setEsperando] = useState(computador)
  useEffect(() => {
    if (!computador) return
    abrir(auri)
    const espera = setTimeout(() => setEsperando(false), 2000)
    return () => clearTimeout(espera)
  }, [computador, abrir, auri])
  if (esperando) {
    return (
      <Aviso icone={<Carregando />} titulo="Abrindo o Auri…">
        <p>Se o navegador perguntar, permita abrir o Auri.</p>
      </Aviso>
    )
  }
  return <Copia endereco={endereco} auri={computador ? auri : null} />
}

function Copia({ endereco, auri }: { endereco: string; auri: string | null }) {
  const [copiado, setCopiado] = useState<boolean | null>(null)
  return (
    <Aviso
      icone={<Computador />}
      titulo="Resposta do termo assinado"
      acao={
        <>
          {auri && (
            <a className="botao botao-principal" href={auri}>
              <Computador />
              Abrir no Auri
            </a>
          )}
          <button
            type="button"
            className={auri ? 'botao' : 'botao botao-principal'}
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
      <p>
        {auri
          ? 'Se o Auri não abriu, copie a resposta e use "Colar resposta" na ficha do paciente.'
          : 'Abra este link no computador da recepção, copie a resposta e cole no Auri.'}
      </p>
      <p className="suave">
        A resposta está cifrada: só o Auri que enviou o termo consegue ler o que foi assinado.
      </p>
    </Aviso>
  )
}

export function PaginaRecebido({
  pagina,
  computador = noComputador(),
  abrir = abrirNoNavegador
}: {
  pagina?: Pagina
  computador?: boolean
  abrir?: (endereco: string) => void
}) {
  const [{ endereco, fragmento }] = useState<Pagina>(
    () => pagina ?? { endereco: location.href, fragmento: location.hash }
  )
  const situacao = avaliarRecebido(fragmento)
  return (
    <main className="folha">
      {situacao === 'pronto' && (
        <Pronto endereco={endereco} fragmento={fragmento} computador={computador} abrir={abrir} />
      )}
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
