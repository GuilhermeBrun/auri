import { useEffect, useId, useState } from 'react'
import { cpfValido, LinkLongo, montarVolta, nomeCompleto } from '../../contrato/assinatura/formato'
import type { Termo } from '../../contrato/assinatura/formato'
import { Aviso, Rodape } from './comum'
import { Conteudo } from './Conteudo'
import { abrir, copiar, guardarRascunho, type Aberto, type Estado } from './estado'
import { voltaCurta } from './link'
import {
  Alerta,
  Atualizar,
  Carregando,
  Conversa,
  Copiar,
  Enviar,
  LinkQuebrado,
  Relogio
} from './icones'
import { QuadroDeAssinatura } from './QuadroDeAssinatura'
import {
  dataDeNascimento,
  declaracao,
  diaEMes,
  faltas,
  linkDoWhatsApp,
  mascaraDoCpf,
  mensagemDaVolta,
  opcoesDePapel,
  preenchidoVazio,
  resposta,
  soDigitos,
  telefone,
  textoDeFaltas,
  type Preenchido
} from './textos'

function Enviado({ termo, mensagem }: { termo: Termo; mensagem: string }) {
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
          <a className="botao botao-principal" href={linkDoWhatsApp(termo.cli.whats, mensagem)}>
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
        O WhatsApp abriu na conversa com {termo.cli.nome}, com a mensagem pronta. Toque em enviar
        para concluir.
      </p>
      <p className="suave">
        Depois disso a clínica confere e guarda o termo. Você não precisa fazer mais nada.
      </p>
    </Aviso>
  )
}

type Volta = { de: Preenchido; link: string | null; erro: 'longa' | 'falhou' | null }

function Formulario({
  aberto,
  inicial,
  onEnviado
}: {
  aberto: Aberto
  inicial: Preenchido | null
  onEnviado: (mensagem: string) => void
}) {
  const { termo, chave, h } = aberto
  const id = useId()
  const [preenchido, setPreenchido] = useState(() => inicial ?? preenchidoVazio(termo))
  const [tocado, setTocado] = useState({ nome: false, cpf: false })
  const [volta, setVolta] = useState<Volta | null>(null)
  const [enviando, setEnviando] = useState(false)
  const lista = faltas(preenchido)
  const completo = lista.length === 0

  useEffect(() => {
    guardarRascunho(termo.id, { preenchido })
  }, [termo.id, preenchido])

  useEffect(() => {
    if (!completo) return
    let ativo = true
    const dados = resposta(termo, h, preenchido, new Date())
    montarVolta(chave, dados, preenchido.tracos, { origem: location.origin }).then(
      (link) => ativo && setVolta({ de: preenchido, link, erro: null }),
      (falha: unknown) =>
        ativo &&
        setVolta({
          de: preenchido,
          link: null,
          erro: falha instanceof LinkLongo ? 'longa' : 'falhou'
        })
    )
    return () => {
      ativo = false
    }
  }, [chave, h, termo, preenchido, completo])

  const atualizar = (mudancas: Partial<Preenchido>) =>
    setPreenchido((anterior) => ({ ...anterior, ...mudancas }))

  const atual = completo && volta?.de === preenchido ? volta : null
  const link = atual?.link ?? null
  const erro = atual?.erro ?? null
  const mensagem = link ? mensagemDaVolta(termo, link) : null
  const erroNome = tocado.nome && !nomeCompleto(preenchido.nome)
  const erroCpf = (tocado.cpf || preenchido.cpf.length === 11) && !cpfValido(preenchido.cpf)
  const registro = [termo.prof.nome, termo.prof.reg].filter(Boolean).join(' · ')

  async function enviar() {
    if (!link || enviando) return
    setEnviando(true)
    const texto = mensagemDaVolta(termo, await voltaCurta(link))
    guardarRascunho(termo.id, { enviado: texto })
    location.href = linkDoWhatsApp(termo.cli.whats, texto)
    setTimeout(() => onEnviado(texto))
  }

  return (
    <>
      <header className="cabeca">
        <p className="clinica">{termo.cli.nome}</p>
        <h1>{termo.mod.titulo}</h1>
        <p className="suave numeros">
          Paciente: {termo.pac.nome}, nascimento {dataDeNascimento(termo.pac.nasc)}
          <br />
          Versão {termo.mod.versao} · vale até {diaEMes(termo.ate)}
        </p>
      </header>

      <article className="texto" aria-label="Texto do termo">
        <Conteudo texto={termo.txt} />
        <p className="profissional">{registro}</p>
      </article>

      <section className="secao" aria-labelledby={`${id}-dados`}>
        <h2 id={`${id}-dados`}>Seus dados</h2>
        <div className="campo">
          <label htmlFor={`${id}-nome`}>Nome completo</label>
          <input
            id={`${id}-nome`}
            className="entrada"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={120}
            value={preenchido.nome}
            aria-invalid={erroNome}
            aria-describedby={erroNome ? `${id}-nome-erro` : undefined}
            onChange={(evento) => atualizar({ nome: evento.target.value })}
            onBlur={() => setTocado((anterior) => ({ ...anterior, nome: true }))}
          />
          {erroNome && (
            <p id={`${id}-nome-erro`} className="erro">
              <Alerta />
              Escreva o nome e o sobrenome.
            </p>
          )}
        </div>
        <div className="campo">
          <label htmlFor={`${id}-cpf`}>CPF</label>
          <input
            id={`${id}-cpf`}
            className="entrada numeros"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="000.000.000-00"
            value={mascaraDoCpf(preenchido.cpf)}
            aria-invalid={erroCpf}
            aria-describedby={erroCpf ? `${id}-cpf-erro` : undefined}
            onChange={(evento) => atualizar({ cpf: soDigitos(evento.target.value).slice(0, 11) })}
            onBlur={() => setTocado((anterior) => ({ ...anterior, cpf: true }))}
          />
          {erroCpf && (
            <p id={`${id}-cpf-erro`} className="erro">
              <Alerta />
              CPF inválido. Confira os números.
            </p>
          )}
        </div>
        <fieldset className="campo">
          <legend>Quem assina</legend>
          <div className="opcoes">
            {opcoesDePapel(termo).map(({ papel, rotulo }) => (
              <label key={papel} className="opcao">
                <input
                  type="radio"
                  name={`${id}-rel`}
                  value={papel}
                  checked={preenchido.rel === papel}
                  onChange={() => atualizar({ rel: papel })}
                />
                <span>{rotulo}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="aceite">
          <input
            type="checkbox"
            checked={preenchido.aceite}
            onChange={(evento) => atualizar({ aceite: evento.target.checked })}
          />
          <span>{declaracao(termo, preenchido.rel)}</span>
        </label>
      </section>

      <section className="secao" aria-labelledby={`${id}-assinatura`}>
        <h2 id={`${id}-assinatura`}>Assinatura</h2>
        <p className="suave">Assine com o dedo no quadro.</p>
        <QuadroDeAssinatura
          tracos={preenchido.tracos}
          onChange={(tracos) => atualizar({ tracos })}
        />
      </section>

      <section className="envio" aria-label="Envio">
        <p className="destino">
          <Conversa />
          <span>
            Enviar para <strong>{termo.cli.nome}</strong> ·{' '}
            <span className="numeros">{telefone(termo.cli.whats)}</span>
          </span>
        </p>
        {erro === 'longa' && (
          <p className="erro" role="alert">
            <Alerta />
            Assinatura muito longa. Limpe e assine de novo.
          </p>
        )}
        {erro === 'falhou' && (
          <p className="erro" role="alert">
            <Alerta />
            Não deu para preparar a resposta. Recarregue a página e tente de novo.
          </p>
        )}
        {link && mensagem ? (
          <a
            className="botao botao-principal"
            href={linkDoWhatsApp(termo.cli.whats, mensagem)}
            aria-busy={enviando}
            onClick={(evento) => {
              evento.preventDefault()
              void enviar()
            }}
          >
            {enviando ? <Carregando /> : <Enviar />}
            Enviar pelo WhatsApp
          </a>
        ) : (
          <button type="button" className="botao botao-principal" disabled>
            <Enviar />
            Enviar pelo WhatsApp
          </button>
        )}
        <p className="falta" aria-live="polite">
          {textoDeFaltas(lista) || 'Abre o WhatsApp com a mensagem pronta.'}
        </p>
      </section>
    </>
  )
}

function Tela({
  estado,
  onEnviado
}: {
  estado: Estado
  onEnviado: (termo: Termo, mensagem: string) => void
}) {
  switch (estado.tela) {
    case 'abrindo':
      return (
        <p className="abrindo" role="status">
          <Carregando />
          Abrindo o termo…
        </p>
      )
    case 'sem-suporte':
      return (
        <Aviso icone={<Alerta />} titulo="Este navegador não abre o termo">
          <p>Abra o link em outro navegador ou aparelho.</p>
          <p className="suave">No iPhone, o termo precisa do iOS 16.4 ou mais novo.</p>
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
          <p>Ele venceu ou foi trocado por um novo. Peça um link novo para a clínica.</p>
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
          <p>O termo precisa de internet para abrir. Confira a conexão e tente de novo.</p>
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
    case 'vencido':
      return (
        <Aviso
          icone={<Relogio />}
          titulo="Este link venceu"
          acao={
            <a className="botao botao-secundario" href={linkDoWhatsApp(estado.termo.cli.whats)}>
              <Conversa />
              Falar com a clínica
            </a>
          }
        >
          <p className="numeros">
            O prazo para assinar era {diaEMes(estado.termo.ate)}. Peça um link novo para a clínica.
          </p>
        </Aviso>
      )
    case 'termo':
      return (
        <Formulario
          aberto={estado.aberto}
          inicial={estado.rascunho}
          onEnviado={(mensagem) => onEnviado(estado.aberto.termo, mensagem)}
        />
      )
    case 'enviado':
      return <Enviado termo={estado.termo} mensagem={estado.mensagem} />
  }
}

export function PaginaAssinar({ inicial }: { inicial?: Estado }) {
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

  return (
    <main className="folha">
      <Tela
        estado={estado}
        onEnviado={(termo, mensagem) => setEstado({ tela: 'enviado', termo, mensagem })}
      />
      <Rodape>
        O termo e a resposta vão cifrados: só a clínica consegue ler, nem o site do Auri.
      </Rodape>
    </main>
  )
}
