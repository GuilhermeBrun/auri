import { useEffect, useState, type ReactNode } from 'react'
import { Aviso, Rodape } from './comum'
import { copiar } from './estado'
import { Atualizar, Carregando, Computador, Copiar, LinkQuebrado } from './icones'

export type Pagina = { endereco: string; fragmento: string }

export type Situacao = 'pronto' | 'incompleto' | 'versao'

export type Textos = {
  titulo: string
  comAuri: string
  semAuri: string
  cifrada: string
  incompleta: string
}

const noComputador = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true

const abrirNoNavegador = (endereco: string): void => {
  location.href = endereco
}

function Pronto({
  endereco,
  auri,
  computador,
  abrir,
  textos
}: {
  endereco: string
  auri: string
  computador: boolean
  abrir: (endereco: string) => void
  textos: Textos
}) {
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
  return <Copia endereco={endereco} auri={computador ? auri : null} textos={textos} />
}

function Copia({
  endereco,
  auri,
  textos
}: {
  endereco: string
  auri: string | null
  textos: Textos
}) {
  const [copiado, setCopiado] = useState<boolean | null>(null)
  return (
    <Aviso
      icone={<Computador />}
      titulo={textos.titulo}
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
      <p>{auri ? textos.comAuri : textos.semAuri}</p>
      <p className="suave">{textos.cifrada}</p>
    </Aviso>
  )
}

export function Devolucao({
  pagina,
  esquema,
  situacao,
  computador = noComputador(),
  abrir = abrirNoNavegador,
  textos,
  rodape
}: {
  pagina: Pagina
  esquema: string
  situacao: Situacao
  computador?: boolean
  abrir?: (endereco: string) => void
  textos: Textos
  rodape: ReactNode
}) {
  const auri = `${esquema}#${pagina.fragmento.replace(/^#/, '')}`
  return (
    <main className="folha">
      {situacao === 'pronto' && (
        <Pronto
          endereco={pagina.endereco}
          auri={auri}
          computador={computador}
          abrir={abrir}
          textos={textos}
        />
      )}
      {situacao === 'incompleto' && (
        <Aviso icone={<LinkQuebrado />} titulo="Esta resposta está incompleta">
          <p>{textos.incompleta}</p>
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
      <Rodape>{rodape}</Rodape>
    </main>
  )
}
