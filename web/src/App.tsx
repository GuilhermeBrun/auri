import { Fragment, type CSSProperties, type MouseEvent } from 'react'
import { AgendaPreview } from './agenda/AgendaPreview'
import { DownloadButtons } from './components/DownloadButtons'
import { ArrowUp, Wordmark } from './components/icons'
import { Reveal } from './components/Reveal'
import { SCENES } from './scenes'
import { prefersReducedMotion } from './lib/dom'
import { PointerTrail } from './components/PointerTrail'
import { ThemeToggle } from './components/ThemeToggle'
import { longDate, type DownloadInfo } from './releases'

const FEATURES: { scene: keyof typeof SCENES; title: string; text: string }[] = [
  {
    scene: 'agenda',
    title: 'Agenda da clínica',
    text: 'Dia, semana ou mês, só nos dias e horários em que a clínica atende. Cada etiqueta tem a sua cor, e um clique num horário livre agenda a sessão.'
  },
  {
    scene: 'confirmacao',
    title: 'Confirmação pelo WhatsApp',
    text: 'Na véspera, o Auri prepara a mensagem de cada família. A resposta volta para a agenda, que mostra quem confirmou e quem ainda não respondeu.'
  },
  {
    scene: 'encaixe',
    title: 'Lista de espera e encaixe',
    text: 'Quem espera um horário fica na lista, com prioridade e os dias e períodos que prefere. Clique num horário vago e o Auri mostra quem cabe nele.'
  },
  {
    scene: 'anamnese',
    title: 'Fichas e anamnese',
    text: 'A ficha completa de cada paciente e a anamnese em roteiro, um tema por vez, com perguntas para guiar a conversa com a família.'
  },
  {
    scene: 'sessoes',
    title: 'Presença assinada',
    text: 'A família assina na tela do computador quando chega, e a sessão fica como presente. Frequência, evoluções e relatório em PDF ficam na ficha do paciente.'
  },
  {
    scene: 'termos',
    title: 'Termos da clínica',
    text: 'A clínica escreve os próprios termos, com o nome e o logo dela. O Auri manda o link pelo WhatsApp, a família assina no celular e o termo volta assinado.'
  },
  {
    scene: 'financeiro',
    title: 'Financeiro',
    text: 'Particular, pacote ou convênio: cada sessão assinada já entra na conta do paciente. O que está em aberto e o que entrou no mês ficam numa tela só.'
  },
  {
    scene: 'copia',
    title: 'Seus dados, no seu computador',
    text: 'Os pacientes e a agenda ficam no computador da clínica. Uma cópia cifrada vai para o Google Drive, OneDrive ou iCloud que vocês já usam.'
  },
  {
    scene: 'conexao',
    title: 'Recepção e consultório',
    text: 'Um computador guarda os dados e os outros usam pela rede da clínica ou pela internet, só com a sua permissão.'
  }
]

const HEADLINE = ['A clínica inteira,', 'sem papel.']

function Words({ lines }: { lines: string[] }) {
  let index = 0
  return lines.map((line, row) => (
    <Fragment key={line}>
      {row > 0 && ' '}
      <span className={row > 0 ? 'line line-soft' : 'line'}>
        {line.split(' ').map((word, position) => (
          <Fragment key={position}>
            {position > 0 && ' '}
            <span className="word" style={{ '--i': index++ } as CSSProperties}>
              {word}
            </span>
          </Fragment>
        ))}
      </span>
    </Fragment>
  ))
}

function Feature({ scene, title, text }: (typeof FEATURES)[number]) {
  const Scene = SCENES[scene]
  return (
    <article className="feature">
      <Reveal className="feature-text">
        <h3>{title}</h3>
        <p>{text}</p>
      </Reveal>
      <Reveal className="feature-media" order={1}>
        <Scene />
      </Reveal>
    </article>
  )
}

function toDownload(event: MouseEvent) {
  event.preventDefault()
  document
    .getElementById('baixar')
    ?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  document
    .querySelector<HTMLElement>('#baixar .choice:not([hidden]) .btn')
    ?.focus({ preventScroll: true })
}

export function App({ info }: { info: DownloadInfo }) {
  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <PointerTrail />
      <header className="top">
        <a className="top-brand" href="./">
          <Wordmark />
        </a>
        <ThemeToggle />
      </header>
      <main>
        <section className="hero" id="baixar" aria-labelledby="titulo">
          <div className="mark" aria-hidden="true">
            <img className="mark-light" src="auri-claro.svg" alt="" width="96" height="96" />
            <img className="mark-dark" src="auri.svg" alt="" width="96" height="96" />
          </div>
          <h1 id="titulo">
            <Words lines={HEADLINE} />
          </h1>
          <p className="lead">
            Agenda, pacientes e financeiro no computador da clínica, mesmo sem internet.
          </p>
          <DownloadButtons info={info} />
          {info.missing && <p className="missing meta">{info.missing}</p>}
        </section>
        <AgendaPreview />
        <section className="section" aria-labelledby="recursos">
          <Reveal as="h2" id="recursos">
            Feito para o dia a dia da clínica
          </Reveal>
          <div className="features">
            {FEATURES.map((feature) => (
              <Feature key={feature.scene} {...feature} />
            ))}
          </div>
        </section>
        <section className="section closing" aria-labelledby="fim">
          <Reveal as="h2" id="fim">
            Comece hoje
          </Reveal>
          <Reveal order={1}>
            <a className="btn btn-primary" href="#baixar" data-to-download="" onClick={toDownload}>
              <ArrowUp />
              <span>Baixar o Auri</span>
            </a>
          </Reveal>
        </section>
      </main>
      <footer className="foot">
        <span>
          <Wordmark />
        </span>
        <span className="meta">
          {info.isAlpha && <span className="chip">Alpha</span>}
          <span>{`Versão ${info.version} · ${longDate(info.publishedAt)}`}</span>
        </span>
      </footer>
    </>
  )
}
