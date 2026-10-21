import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { montarVolta, type Confirmacao, type Decisao } from '../../contrato/confirmacao/formato'
import {
  diaCurto,
  diaPorExtenso,
  hora,
  horario,
  mensagemDaVolta,
  politica,
  prazo,
  quando
} from '../../contrato/confirmacao/textos'
import { Aviso, Rodape } from '../assinatura/comum'
import { copiar } from '../assinatura/estado'
import {
  Alerta,
  Atualizar,
  Carregando,
  Confirmar,
  Conversa,
  Copiar,
  Desmarcar,
  Enviar,
  LinkQuebrado,
  Relogio,
  Voltar
} from '../assinatura/icones'
import { voltaCurta } from '../assinatura/link'
import { linkDoWhatsApp, telefone } from '../assinatura/textos'
import {
  abrir,
  guardarEnviado,
  mesmoFuso,
  respostaDe,
  situacao,
  type Aberta,
  type Estado
} from './estado'

type Voltas = Record<Decisao, string>

function Sessao({ confirmacao }: { confirmacao: Confirmacao }) {
  const { ses, tz, pac } = confirmacao
  return (
    <section className="sessao" aria-label="Sessão">
      <p className="dia">{diaPorExtenso(ses.ini, tz)}</p>
      <p className="hora numeros">{horario(confirmacao)}</p>
      <p className="quem">
        {pac.nome} · com {ses.prof}
        {!mesmoFuso(tz) && ' · horário da clínica'}
      </p>
    </section>
  )
}

const falarComAClinica = (confirmacao: Confirmacao): string =>
  linkDoWhatsApp(
    confirmacao.cli.whats,
    `Olá! Sobre a sessão de ${confirmacao.pac.nome}, ${quando(confirmacao)}: `
  )

function Pergunta({
  aberta,
  onFim,
  onEnviado
}: {
  aberta: Aberta
  onFim: (tela: 'passou' | 'vencido') => void
  onEnviado: (res: Decisao, mensagem: string) => void
}) {
  const { confirmacao, chave } = aberta
  const [passo, setPasso] = useState<'pergunta' | 'desmarcar'>('pergunta')
  const [voltas, setVoltas] = useState<Voltas | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [enviando, setEnviando] = useState<Decisao | null>(null)

  useEffect(() => {
    let ativo = true
    const montar = () => {
      const agora = new Date()
      const fim = situacao(confirmacao, agora.getTime())
      if (fim) return onFim(fim)
      const origem = { origem: location.origin }
      Promise.all([
        montarVolta(chave, respostaDe(confirmacao, 'confirmada', agora), origem),
        montarVolta(chave, respostaDe(confirmacao, 'desmarcada', agora), origem)
      ]).then(
        ([confirmada, desmarcada]) => ativo && setVoltas({ confirmada, desmarcada }),
        () => ativo && setFalhou(true)
      )
    }
    montar()
    const relogio = setInterval(montar, 30_000)
    return () => {
      ativo = false
      clearInterval(relogio)
    }
  }, [chave, confirmacao, onFim])

  useEffect(() => {
    scrollTo(0, 0)
  }, [passo])

  const mensagem = (res: Decisao): string | null =>
    voltas ? mensagemDaVolta(confirmacao, res, voltas[res]) : null

  function responder(res: Decisao, conteudo: ReactNode) {
    const texto = mensagem(res)
    if (!texto) {
      return (
        <button type="button" className="botao botao-principal" disabled>
          {conteudo}
        </button>
      )
    }
    const enviar = async (): Promise<void> => {
      if (enviando) return
      setEnviando(res)
      let longo = voltas![res]
      try {
        longo = await montarVolta(chave, respostaDe(confirmacao, res, new Date()), {
          origem: location.origin
        })
      } catch {}
      const final = mensagemDaVolta(confirmacao, res, await voltaCurta(longo))
      guardarEnviado(confirmacao.id, { res, mensagem: final })
      location.href = linkDoWhatsApp(confirmacao.cli.whats, final)
      setTimeout(() => onEnviado(res, final))
    }
    return (
      <a
        className="botao botao-principal"
        href={linkDoWhatsApp(confirmacao.cli.whats, texto)}
        aria-busy={enviando === res}
        onClick={(evento) => {
          evento.preventDefault()
          void enviar()
        }}
      >
        {enviando === res ? (
          <>
            <Carregando />
            Abrindo o WhatsApp…
          </>
        ) : (
          conteudo
        )}
      </a>
    )
  }

  const destino = (
    <p className="falta">
      Abre o WhatsApp com a resposta pronta para {confirmacao.cli.nome} ·{' '}
      <span className="numeros">{telefone(confirmacao.cli.whats)}</span>
    </p>
  )
  const erro = falhou && (
    <p className="erro" role="alert">
      <Alerta />
      Não deu para preparar a resposta. Recarregue a página e tente de novo.
    </p>
  )

  if (passo === 'desmarcar') {
    return (
      <>
        <header className="cabeca">
          <p className="clinica">{confirmacao.cli.nome}</p>
          <h1>Desmarcar a sessão?</h1>
        </header>
        <Sessao confirmacao={confirmacao} />
        <div className="politica">
          <p>O horário fica livre para outro paciente.</p>
          <p className="suave">Para remarcar, fale com a clínica depois de desmarcar.</p>
        </div>
        <div className="respostas">
          {erro}
          {responder(
            'desmarcada',
            <>
              <Desmarcar />
              Desmarcar sessão
            </>
          )}
          <button type="button" className="botao botao-leve" onClick={() => setPasso('pergunta')}>
            <Voltar />
            Voltar
          </button>
          {destino}
        </div>
      </>
    )
  }

  return (
    <>
      <header className="cabeca">
        <p className="clinica">{confirmacao.cli.nome}</p>
        <h1>Confirme a sessão</h1>
      </header>
      <Sessao confirmacao={confirmacao} />
      <div className="politica">
        <p className="prazo numeros">
          <Relogio />
          Responda {prazo(confirmacao)}.
        </p>
        <p className="suave">{politica(confirmacao)}</p>
      </div>
      <div className="respostas">
        {erro}
        {responder(
          'confirmada',
          <>
            <Confirmar />
            Confirmar presença
          </>
        )}
        <button
          type="button"
          className="botao botao-secundario"
          onClick={() => setPasso('desmarcar')}
        >
          <Desmarcar />
          Desmarcar
        </button>
        {destino}
      </div>
    </>
  )
}

function Enviado({
  confirmacao,
  res,
  mensagem
}: {
  confirmacao: Confirmacao
  res: Decisao
  mensagem: string
}) {
  const [copiado, setCopiado] = useState<boolean | null>(null)

  useEffect(() => {
    scrollTo(0, 0)
  }, [])

  return (
    <Aviso
      icone={<Enviar />}
      titulo="Falta um toque"
      acao={
        <>
          <a
            className="botao botao-principal"
            href={linkDoWhatsApp(confirmacao.cli.whats, mensagem)}
          >
            <Conversa />
            Abrir o WhatsApp de novo
          </a>
          <button
            type="button"
            className="botao botao-leve"
            onClick={() => void copiar(mensagem).then(setCopiado)}
          >
            <Copiar />
            Copiar mensagem
          </button>
          <p className="estado-da-copia" role="status">
            {copiado === true && 'Mensagem copiada. Cole na conversa com a clínica.'}
            {copiado === false && 'Não deu para copiar. Selecione a mensagem abaixo e copie.'}
          </p>
          {copiado === false && (
            <textarea
              className="mensagem"
              readOnly
              value={mensagem}
              aria-label="Mensagem para a clínica"
              onFocus={(evento) => evento.currentTarget.select()}
            />
          )}
        </>
      }
    >
      <p>
        O WhatsApp abriu na conversa com {confirmacao.cli.nome}, com{' '}
        {res === 'confirmada' ? 'a confirmação pronta' : 'o pedido para desmarcar pronto'}. Toque em
        enviar para concluir.
      </p>
      <p className="suave">
        {res === 'confirmada'
          ? 'Depois disso a sessão fica confirmada. Você não precisa fazer mais nada.'
          : 'Depois disso o horário fica livre. Para remarcar, fale com a clínica.'}
      </p>
    </Aviso>
  )
}

function Tela({
  estado,
  onFim,
  onEnviado
}: {
  estado: Estado
  onFim: (confirmacao: Confirmacao, tela: 'passou' | 'vencido') => void
  onEnviado: (confirmacao: Confirmacao, res: Decisao, mensagem: string) => void
}) {
  const aberta = estado.tela === 'pergunta' ? estado.aberta : null
  const fim = useCallback(
    (tela: 'passou' | 'vencido') => aberta && onFim(aberta.confirmacao, tela),
    [aberta, onFim]
  )
  switch (estado.tela) {
    case 'abrindo':
      return (
        <p className="abrindo" role="status">
          <Carregando />
          Abrindo a confirmação…
        </p>
      )
    case 'sem-suporte':
      return (
        <Aviso icone={<Alerta />} titulo="Este navegador não abre a confirmação">
          <p>Abra o link em outro navegador ou aparelho, ou responda direto para a clínica.</p>
          <p className="suave">No iPhone, a página precisa do iOS 16.4 ou mais novo.</p>
        </Aviso>
      )
    case 'incompleto':
      return (
        <Aviso icone={<LinkQuebrado />} titulo="Este link está incompleto">
          <p>
            Abra de novo pela mensagem da clínica. Se copiou o link, confira se ele veio inteiro.
          </p>
        </Aviso>
      )
    case 'sumiu':
      return (
        <Aviso icone={<Relogio />} titulo="Este link não vale mais">
          <p>O prazo para responder acabou ou a clínica mandou outro link. Fale com a clínica.</p>
        </Aviso>
      )
    case 'sem-conexao':
      return (
        <Aviso
          icone={<Atualizar />}
          titulo="Sem internet"
          acao={
            <button
              type="button"
              className="botao botao-principal"
              onClick={() => location.reload()}
            >
              <Atualizar />
              Tentar de novo
            </button>
          }
        >
          <p>A confirmação precisa de internet para abrir. Confira a conexão e tente de novo.</p>
        </Aviso>
      )
    case 'versao':
      return (
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
          <p>Este link é de uma versão mais nova do Auri.</p>
        </Aviso>
      )
    case 'passou':
      return (
        <Aviso
          icone={<Relogio />}
          titulo="Esta sessão já passou"
          acao={
            <a
              className="botao botao-secundario"
              href={linkDoWhatsApp(estado.confirmacao.cli.whats)}
            >
              <Conversa />
              Falar com a clínica
            </a>
          }
        >
          <p className="numeros">A sessão era {quando(estado.confirmacao)}.</p>
        </Aviso>
      )
    case 'vencido': {
      const { ate, tz } = estado.confirmacao
      return (
        <Aviso
          icone={<Relogio />}
          titulo="Passou o prazo para responder"
          acao={
            <a className="botao botao-secundario" href={falarComAClinica(estado.confirmacao)}>
              <Conversa />
              Falar com a clínica
            </a>
          }
        >
          <p className="numeros">
            O prazo era {diaCurto(ate, tz)} às {hora(ate, tz)}. O horário pode ter sido liberado
            para outro paciente.
          </p>
          <p className="suave">Fale com a clínica para saber da sessão.</p>
        </Aviso>
      )
    }
    case 'pergunta':
      return (
        <Pergunta
          aberta={estado.aberta}
          onFim={fim}
          onEnviado={(res, mensagem) => onEnviado(estado.aberta.confirmacao, res, mensagem)}
        />
      )
    case 'enviado':
      return (
        <Enviado confirmacao={estado.confirmacao} res={estado.res} mensagem={estado.mensagem} />
      )
  }
}

export function PaginaConfirmar({ inicial }: { inicial?: Estado }) {
  const [estado, setEstado] = useState<Estado>(inicial ?? { tela: 'abrindo' })

  useEffect(() => {
    if (inicial) return
    let ativo = true
    void abrir(location.hash).then((novo) => ativo && setEstado(novo))
    const recarregar = () => location.reload()
    addEventListener('hashchange', recarregar)
    return () => {
      ativo = false
      removeEventListener('hashchange', recarregar)
    }
  }, [inicial])

  const onFim = useCallback(
    (confirmacao: Confirmacao, tela: 'passou' | 'vencido') => setEstado({ tela, confirmacao }),
    []
  )

  return (
    <main className="folha">
      <Tela
        estado={estado}
        onFim={onFim}
        onEnviado={(confirmacao, res, mensagem) =>
          setEstado({ tela: 'enviado', confirmacao, res, mensagem })
        }
      />
      <Rodape>
        A sessão e a resposta vão cifradas: só a clínica consegue ler, nem o site do Auri.
      </Rodape>
    </main>
  )
}
