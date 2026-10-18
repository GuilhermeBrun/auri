import { Fragment, type CSSProperties, type MouseEvent } from 'react'
import { AgendaPreview } from './agenda/AgendaPreview'
import { DownloadButtons } from './components/DownloadButtons'
import { ArrowUp, Wordmark } from './components/icons'
import { Reveal } from './components/Reveal'
import { prefersReducedMotion } from './lib/dom'
import { PointerTrail } from './components/PointerTrail'
import { ThemeToggle } from './components/ThemeToggle'
import { longDate, type DownloadInfo } from './releases'

// Recursos: tela do app (public/telas, capturadas do app real com pacientes fictícios), com o zoom
// e a parte da tela que aparece no canto do quadro, título e texto.
const FEATURES = [
  {
    image: 'agenda',
    zoom: 150,
    focus: 0,
    title: 'Agenda da clínica',
    text: 'Dia, semana ou mês, com o horário de agora sempre à vista. Um clique num horário livre agenda a sessão, e o Auri confirma quando ela foi salva.'
  },
  {
    image: 'anamnese',
    zoom: 150,
    focus: 0.24,
    title: 'Fichas e anamnese',
    text: 'A ficha completa de cada paciente e a anamnese em roteiro, um tema por vez, com perguntas para guiar a conversa com a família.'
  },
  {
    image: 'sessoes',
    zoom: 150,
    focus: 0.24,
    title: 'Sessões e frequência',
    text: 'Presença e evolução de cada sessão, com um gráfico da frequência para acompanhar o tratamento do paciente.'
  },
  {
    image: 'copia',
    zoom: 135,
    focus: 0,
    title: 'Seus dados, no seu computador',
    text: 'Os pacientes e a agenda ficam no computador da clínica. Uma cópia cifrada vai para o Google Drive, OneDrive ou iCloud que vocês já usam.'
  },
  {
    image: 'conexao',
    zoom: 135,
    focus: 0,
    title: 'Recepção e consultório',
    text: 'Um computador guarda os dados e os outros usam pela rede da clínica ou pela internet, só com a sua permissão.'
  }
]

const HEADLINE = ['A clínica inteira,', 'sem papel.']

/** Título com cada palavra numa caixa própria, para entrarem uma depois da outra. */
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

function Feature({ image, zoom, focus, title, text }: (typeof FEATURES)[number]) {
  const crop = { '--zoom': zoom, '--focus': focus } as CSSProperties
  const alt = (theme: string) => `Tela do Auri: ${title.toLowerCase()}, no tema ${theme}`
  return (
    <article className="feature">
      <Reveal className="feature-text">
        <h3>{title}</h3>
        <p>{text}</p>
      </Reveal>
      <Reveal className="feature-media" order={1}>
        <img
          className="shot-light"
          style={crop}
          src={`telas/${image}-claro.webp`}
          alt={alt('claro')}
          width="1600"
          height="950"
          loading="lazy"
          decoding="async"
        />
        <img
          className="shot-dark"
          style={crop}
          src={`telas/${image}-escuro.webp`}
          alt={alt('escuro')}
          width="1600"
          height="950"
          loading="lazy"
          decoding="async"
        />
      </Reveal>
    </article>
  )
}

/** "Baixar o Auri" no fim da página: rola até o download do topo e põe o foco no botão. */
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
            Pacientes, sessões e anamneses no computador da clínica, mesmo sem internet.
          </p>
          <DownloadButtons options={info.options} />
          {info.missing && <p className="missing meta">{info.missing}</p>}
        </section>
        <AgendaPreview />
        <section className="section" aria-labelledby="recursos">
          <Reveal as="h2" id="recursos">
            Feito para o dia a dia da clínica
          </Reveal>
          <div className="features">
            {FEATURES.map((feature) => (
              <Feature key={feature.image} {...feature} />
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
