import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AuriSymbol,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FilePen,
  HardDrive,
  Hourglass,
  Laptop,
  PenLine,
  Plus,
  Send
} from '../components/icons'
import { Stage, Toast, Window } from './Stage'
import { useTimeline, type Beat } from './timeline'

const FIRST = 8

const vars = (values: Record<string, number | string>) => values as CSSProperties

const clock = (hours: number) =>
  `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`

type Mark = 'signed' | 'confirmed' | 'waiting'

type Session = {
  day: number
  start: number
  len?: number
  name: string
  kind?: 'Sessão' | 'Avaliação'
  mark?: Mark
  target?: string
  fresh?: boolean
}

const MARK_ICONS = { signed: PenLine, confirmed: Check, waiting: Clock }

function Ev({ start, len = 0.75, name, kind = 'Sessão', mark, target, fresh }: Session) {
  const Icon = mark && MARK_ICONS[mark]
  return (
    <span
      className={`ev ${kind === 'Avaliação' ? 'ev-avaliacao' : 'ev-sessao'}${fresh ? ' sc-new' : ''}`}
      style={vars({ '--top': start - FIRST, '--len': len })}
      data-target={target}
    >
      <span className="ev-name">
        <span className="ev-name-text">{name}</span>
        {Icon && (
          <span className={`ev-mark ev-mark-${mark}`}>
            <Icon />
          </span>
        )}
      </span>
      <span className="ev-time">{`${kind} · ${clock(start)} – ${clock(start + len)}`}</span>
    </span>
  )
}

type Day = { label: string; num: number; today?: boolean }

function Week({
  days,
  sessions,
  now,
  extra,
  width
}: {
  days: Day[]
  sessions: Session[]
  now?: { day: number; at: number }
  extra?: (day: number) => ReactNode
  width: number
}) {
  return (
    <div className="cal-week sc-week" style={vars({ '--cols': days.length, width: `${width}px` })}>
      <div className="cal-head">
        <span className="gutter" />
        {days.map((day) => (
          <span key={day.num} className={`dh${day.today ? ' today' : ''}`}>
            <span className="dh-wd">{day.label}</span>
            <span className="dh-num">{day.num}</span>
          </span>
        ))}
      </div>
      <div className="cal-body">
        <div className="cal-hours">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="hour">
              <span>{clock(FIRST + i)}</span>
              <span className="half">{clock(FIRST + i + 0.5)}</span>
            </div>
          ))}
        </div>
        <div className="cal-cols">
          {days.map((_, day) => (
            <div key={day} className="col">
              {sessions
                .filter((session) => session.day === day)
                .map((session) => (
                  <Ev key={`${session.name}${session.start}`} {...session} />
                ))}
              {now?.day === day && (
                <div className="now" style={vars({ '--top': now.at - FIRST })} />
              )}
              {extra?.(day)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Slot({ start, len = 0.75, target }: { start: number; len?: number; target: string }) {
  return (
    <span
      className="sc-slot"
      style={vars({ '--top': start - FIRST, '--len': len })}
      data-target={target}
    />
  )
}

function AgendaTools() {
  return (
    <>
      <span className="track">
        <span className="sc-track-icon">
          <ChevronLeft />
        </span>
        <span className="sc-today">Hoje</span>
        <span className="sc-track-icon">
          <ChevronRight />
        </span>
      </span>
      <span className="track sc-seg">
        <span>Dia</span>
        <span data-active="">Semana</span>
        <span>Mês</span>
      </span>
      <span className="ghost-icon">
        <CalendarCheck />
      </span>
      <span className="ghost-icon">
        <Hourglass />
      </span>
      <span className="ghost-icon">
        <Plus />
      </span>
    </>
  )
}

const WEEK: Day[] = [
  { label: 'Seg', num: 19 },
  { label: 'Ter', num: 20, today: true },
  { label: 'Qua', num: 21 },
  { label: 'Qui', num: 22 },
  { label: 'Sex', num: 23 }
]

const BASE: Session[] = [
  { day: 0, start: 8, name: 'Ana Beatriz', mark: 'signed' },
  { day: 0, start: 9, name: 'Pedro Souza', mark: 'signed' },
  { day: 0, start: 11, len: 1, name: 'Helena Prado', kind: 'Avaliação', mark: 'signed' },
  { day: 1, start: 8.5, name: 'Miguel Rocha', mark: 'signed' },
  { day: 1, start: 11.5, name: 'Davi Lima' },
  { day: 2, start: 9, name: 'Theo Martins', mark: 'confirmed' },
  { day: 2, start: 11.5, name: 'Lucas Nunes', mark: 'waiting' },
  { day: 3, start: 9.5, name: 'Beatriz Melo' },
  { day: 4, start: 8, len: 1, name: 'Manuela Cruz', kind: 'Avaliação' }
]

const AGENDA_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'slot' },
  { ms: 700 },
  { ms: 2000, click: true },
  { ms: 2400, hide: true },
  { ms: 500, hide: true }
]

export function AgendaScene() {
  const timeline = useTimeline(AGENDA_BEATS, 3)
  const { beat } = timeline
  const added = beat >= 3
  const sessions: Session[] = [
    ...BASE,
    { day: 1, start: 10, name: 'Laura Dias', mark: 'signed' },
    ...(added ? [{ day: 2, start: 10.5, name: 'Maria Eduarda', fresh: true }] : [])
  ]
  return (
    <Stage
      timeline={timeline}
      beats={AGENDA_BEATS}
      label="Animação: um clique num horário livre agenda a sessão"
    >
      <Window active="Agenda" trail={['Agenda', '19 a 23 de outubro 2026']} tools={<AgendaTools />}>
        <Week
          days={WEEK}
          sessions={sessions}
          now={{ day: 1, at: 9.75 }}
          width={592}
          extra={(day) =>
            day === 2 && (
              <>
                {beat === 2 && (
                  <div className="ghost" style={vars({ '--top': 10.5 - FIRST })}>
                    10:30 – 11:15
                  </div>
                )}
                <Slot start={10.5} target="slot" />
              </>
            )
          }
        />
        <Toast
          show={beat === 3 || beat === 4}
          title="Sessão agendada"
          text="Maria Eduarda · qua, 21 de out às 10:30"
        />
      </Window>
    </Stage>
  )
}

type Status = 'pending' | 'waiting' | 'confirmed'

const CONFIRM_ROWS = [
  { time: '08:00', name: 'Manuela Cruz', who: 'Débora (Mãe) · (65) 99020-1147' },
  { time: '09:00', name: 'Theo Martins', who: 'Juliana (Mãe) · (65) 99014-1105' },
  { time: '10:30', name: 'Alice Costa', who: 'Fernanda (Mãe) · (65) 99010-1077' },
  { time: '11:30', name: 'Lucas Nunes', who: 'Adriana (Mãe) · (65) 99017-1126' }
]

const CONFIRM_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'send' },
  { ms: 800, click: true },
  { ms: 800, click: true },
  { ms: 1000, click: true },
  { ms: 1200, hide: true },
  { ms: 1600, hide: true },
  { ms: 2400, hide: true },
  { ms: 500, hide: true }
]

function StatusCell({ status }: { status: Status }) {
  if (status === 'confirmed') {
    return (
      <span className="sc-status sc-in" key="confirmed">
        <Check />
        Confirmada
      </span>
    )
  }
  if (status === 'waiting') {
    return (
      <span className="sc-status sc-in" key="waiting">
        <Clock />
        até 12:24
      </span>
    )
  }
  return (
    <span className="sc-status sc-faint" key="pending">
      Não enviada
    </span>
  )
}

export function ConfirmationScene() {
  const timeline = useTimeline(CONFIRM_BEATS, 7)
  const { beat } = timeline
  const status = (row: number): Status => {
    if ((row === 0 && beat >= 6) || (row === 2 && beat >= 7)) return 'confirmed'
    return row < 3 && beat >= 2 + row ? 'waiting' : 'pending'
  }
  return (
    <Stage
      timeline={timeline}
      beats={CONFIRM_BEATS}
      label="Animação: o Auri pede a confirmação pelo WhatsApp e mostra quem confirmou"
    >
      <Window active="Agenda" trail={['Agenda', '19 a 23 de outubro 2026']} tools={<AgendaTools />}>
        <Week days={WEEK} sessions={BASE} now={{ day: 1, at: 9.75 }} width={592} />
        <div className="sc-dim" />
        <div className="sc-dialog sc-confirm">
          <b className="sc-dialog-title">Confirmações de quarta-feira, 21/10</b>
          <p className="sc-dialog-text">
            Cada família tem 2 horas para responder a partir do envio. Sem resposta, o horário fica
            livre.
          </p>
          <div className="sc-rows">
            {CONFIRM_ROWS.map((row, i) => (
              <div key={row.name} className="sc-row">
                <b className="sc-row-time">{row.time}</b>
                <span className="sc-two">
                  <b>{row.name}</b>
                  <span>{row.who}</span>
                </span>
                <StatusCell status={status(i)} />
              </div>
            ))}
          </div>
          <div className="sc-dialog-foot">
            <span className="sc-btn">Fechar</span>
            <span className="sc-btn sc-btn-solid" data-target="send">
              <Send />
              Enviar a próxima
            </span>
          </div>
        </div>
        <Toast show={beat === 6} title="Manuela confirmou" text="qua, 21 de out às 08:00" />
      </Window>
    </Stage>
  )
}

const WAIT_DAYS: Day[] = [
  { label: 'Qua', num: 21 },
  { label: 'Qui', num: 22 },
  { label: 'Sex', num: 23 }
]

const WAITING = [
  {
    name: 'Bento Carvalho',
    initials: 'BC',
    high: true,
    text: 'Sessão · 45 min · seg, qua · manhã',
    fits: 'qui, 22 de out · 08:00–08:45'
  },
  {
    name: 'Lívia Ramos',
    initials: 'LR',
    text: 'Avaliação · 60 min · qualquer dia · tarde'
  },
  {
    name: 'Nicolas Araújo',
    initials: 'NA',
    text: 'Sessão · 45 min · ter, qui · qualquer horário',
    fits: 'qui, 22 de out · 08:00–08:45'
  }
]

const WAIT_BEATS: Beat[] = [
  { ms: 800 },
  { ms: 1000, to: 'slot' },
  { ms: 1500, click: true },
  { ms: 1000, to: 'add' },
  { ms: 2200, click: true },
  { ms: 1800, hide: true },
  { ms: 500, hide: true }
]

export function WaitlistScene() {
  const timeline = useTimeline(WAIT_BEATS, 4)
  const { beat } = timeline
  const vaga = beat === 2 || beat === 3
  const booked = beat >= 4
  const shown = vaga ? WAITING.filter((item) => item.fits) : WAITING.slice(booked ? 1 : 0)
  const sessions: Session[] = [
    { day: 0, start: 9, name: 'Theo Martins', mark: 'confirmed' },
    { day: 0, start: 11.5, name: 'Lucas Nunes' },
    { day: 1, start: 9.5, name: 'Beatriz Melo' },
    { day: 1, start: 11, name: 'Gabriel Reis' },
    { day: 2, start: 8, len: 1, name: 'Manuela Cruz', kind: 'Avaliação' },
    { day: 2, start: 10, name: 'Rafael Pires' },
    ...(booked ? [{ day: 1, start: 8, name: 'Bento Carvalho', fresh: true }] : [])
  ]
  return (
    <Stage
      timeline={timeline}
      beats={WAIT_BEATS}
      label="Animação: num horário vago, o Auri mostra quem da lista de espera cabe nele"
    >
      <Window active="Agenda" trail={['Agenda', '19 a 23 de outubro 2026']} tools={<AgendaTools />}>
        <Week
          days={WAIT_DAYS}
          sessions={sessions}
          width={352}
          extra={(day) =>
            day === 1 && (
              <>
                {vaga && (
                  <div className="sc-vaga sc-in" style={vars({ '--top': 0, '--len': 1.5 })}>
                    <span>Vaga</span>
                    <span>08:00 – 09:30</span>
                  </div>
                )}
                <Slot start={8} len={1.5} target="slot" />
              </>
            )
          }
        />
        <aside className="sc-panel">
          <div className="sc-panel-head" key={vaga ? 'vaga' : 'lista'}>
            <b>{vaga ? 'Cabem neste horário' : 'Lista de espera'}</b>
            <span>
              {vaga
                ? 'qui, 22 de out · 08:00–09:30'
                : `${shown.length} pacientes esperando horário`}
            </span>
          </div>
          {shown.map((item, i) => (
            <div key={`${vaga}${item.name}`} className="sc-wait sc-in" style={vars({ '--d': i })}>
              <span className="avatar">{item.initials}</span>
              <span className="sc-two">
                <b>
                  {item.name}
                  {item.high && <i className="sc-tag">Prioridade</i>}
                </b>
                <span>{item.text}</span>
                {vaga && <span className="sc-fits">{item.fits}</span>}
              </span>
              {vaga && i === 0 && (
                <span className="sc-icon-btn" data-target="add">
                  <Plus />
                </span>
              )}
            </div>
          ))}
        </aside>
        <Toast
          show={beat >= 4 && beat <= 5}
          title="Sessão agendada"
          text="Bento Carvalho · qui, 22 de out às 08:00"
        />
      </Window>
    </Stage>
  )
}

function PatientHead({ tab, saved }: { tab: string; saved?: string }) {
  return (
    <>
      <div className="sc-patient">
        <span className="sc-avatar">AM</span>
        <span>
          <b className="sc-name">Alice Costa Martins</b>
          <span className="sc-chips">
            <span className="sc-chip">7 anos e 7 meses</span>
            {saved && <span className="sc-saved">{saved}</span>}
          </span>
        </span>
      </div>
      <div className="sc-tabs">
        {['Ficha', 'Anamnese', 'Sessões', 'Evoluções', 'Termos', 'Financeiro'].map((name) => (
          <span key={name} data-active={name === tab ? '' : undefined}>
            {name}
          </span>
        ))}
      </div>
    </>
  )
}

function Typing({ text, play }: { text: string; play: boolean }) {
  const [count, setCount] = useState(play ? 0 : text.length)
  useEffect(() => {
    if (!play) return
    let current = 0
    const timer = window.setInterval(() => {
      current += 1
      setCount(current)
      if (current >= text.length) clearInterval(timer)
    }, 34)
    return () => clearInterval(timer)
  }, [play, text])
  return (
    <>
      {text.slice(0, count)}
      {play && count < text.length && <i className="sc-caret" />}
    </>
  )
}

const TOPICS = ['Queixa', 'Gestação e nascimento', 'Alimentação', 'Sono', 'Desenvolvimento e fala']

const ANAMNESE_BEATS: Beat[] = [
  { ms: 800 },
  { ms: 1000, to: 'sono' },
  { ms: 700, click: true },
  { ms: 900, to: 'text' },
  { ms: 3200, click: true },
  { ms: 1600, hide: true },
  { ms: 500, hide: true }
]

const SONO =
  'Dorme por volta das 21h e acorda às 7h. Às vezes acorda de madrugada e vai para a cama dos pais.'

export function AnamneseScene() {
  const timeline = useTimeline(ANAMNESE_BEATS, 5)
  const { beat } = timeline
  const sono = beat >= 2
  const written = beat >= 4
  return (
    <Stage
      timeline={timeline}
      beats={ANAMNESE_BEATS}
      label="Animação: a anamnese em roteiro, um tema por vez"
    >
      <Window active="Pacientes" trail={['Pacientes', 'Alice Costa Martins']}>
        <div className="sc-page">
          <PatientHead tab="Anamnese" saved="Salva hoje às 10:12" />
          <div className="sc-anamnese">
            <div className="sc-topics">
              {TOPICS.map((topic) => {
                const active = topic === (sono ? 'Sono' : 'Queixa')
                const done = topic !== 'Sono' || written
                return (
                  <span
                    key={topic}
                    data-active={active ? '' : undefined}
                    data-target={topic === 'Sono' ? 'sono' : undefined}
                  >
                    <i className={done ? 'sc-dot' : 'sc-dot sc-dot-empty'} />
                    {topic}
                  </span>
                )
              })}
            </div>
            <div className="sc-topic" key={sono ? 'sono' : 'queixa'}>
              <span className="sc-small">{sono ? 'Tema 4 de 9' : 'Tema 1 de 9'}</span>
              <b className="sc-topic-title">{sono ? 'Sono' : 'Queixa'}</b>
              <span className="sc-small">
                {sono
                  ? 'Como é o sono e a rotina da noite.'
                  : 'Por que a família procurou a clínica, nas palavras dela.'}
              </span>
              <div className="sc-questions">
                {(sono
                  ? ['Que horas dorme?', 'Acorda à noite?', 'Dorme sozinha?']
                  : ['Quem percebeu?', 'Desde quando?', 'O que mais preocupa?']
                ).map((question) => (
                  <span key={question}>{question}</span>
                ))}
              </div>
              <div
                className="sc-textarea"
                data-target="text"
                data-focus={sono && beat >= 4 ? '' : undefined}
              >
                {sono
                  ? written && <Typing text={SONO} play={beat === 4 && timeline.moving} />
                  : 'A mãe conta que a Alice troca o "r" pelo "l" ("balata" em vez de "barata") e que os colegas começaram a comentar.'}
              </div>
            </div>
          </div>
        </div>
      </Window>
    </Stage>
  )
}

const SIGNATURE = [
  'M50 55Q49 44 48 39Q46 33 44 28Q41 23 38 20Q35 17 31 15Q28 14 25 15Q23 16 21 20Q20 23 19 28Q19 33 20 38Q22 44 24 49Q26 54 29 58Q33 62 36 64Q39 66 42 65Q45 65 47 62Q49 59 49 55Q50 50 49 45L48 39',
  'M58 62Q64 59 66 56Q67 53 67 50Q66 47 65 45Q64 44 64 45Q64 47 65 50Q66 53 70 56Q73 59 77 61Q81 62 84 60Q87 59 88 55Q89 51 89 47Q88 43 87 42Q86 40 86 42Q85 43 87 47Q89 51 92 55Q95 59 99 60Q103 62 106 59Q109 56 109 48Q109 40 107 32Q105 24 104 21Q102 18 102 21Q103 24 105 32Q108 40 113 48Q117 56 121 59Q126 62 129 61Q132 60 134 57Q135 54 135 51Q135 48 134 47Q133 46 132 47Q132 48 133 51Q135 54 138 57Q141 60 145 61Q148 62 152 61Q155 59 156 56Q157 52 157 48Q156 45 155 43Q154 42 154 43Q154 45 155 48Q157 52 160 56Q163 59 167 61Q171 62 174 59Q177 56 177 49Q177 42 176 35Q174 28 173 25Q171 22 171 25Q171 28 174 35Q176 42 181 49Q185 56 189 59Q194 62 197 61Q200 59 201 56Q203 53 202 50Q202 47 201 45Q200 44 200 45Q199 47 201 50Q202 53 205 56Q209 59 212 61L216 62',
  'M30 76Q84 71 111 70Q138 70 165 71Q192 73 219 76L246 79'
]

const ARRIVAL_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'alice' },
  { ms: 900, click: true },
  { ms: 2600, hide: true },
  { ms: 1000, to: 'confirm' },
  { ms: 2000, click: true },
  { ms: 1600, hide: true },
  { ms: 500, hide: true }
]

export function ArrivalScene() {
  const timeline = useTimeline(ARRIVAL_BEATS, 4)
  const { beat } = timeline
  const open = beat >= 2 && beat <= 4
  const signed = beat >= 5
  const sessions: Session[] = [
    ...BASE,
    {
      day: 1,
      start: 10,
      name: 'Alice Costa',
      mark: signed ? 'signed' : 'confirmed',
      target: 'alice'
    }
  ]
  return (
    <Stage
      timeline={timeline}
      beats={ARRIVAL_BEATS}
      label="Animação: a família assina a chegada na tela do computador"
    >
      <Window active="Agenda" trail={['Agenda', '19 a 23 de outubro 2026']} tools={<AgendaTools />}>
        <Week days={WEEK} sessions={sessions} now={{ day: 1, at: 9.9 }} width={592} />
        {open && (
          <>
            <div className="sc-dim sc-fade" />
            <div className="sc-dialog sc-arrival sc-in">
              <span className="sc-small">Assinatura de chegada</span>
              <b className="sc-arrival-name">Alice Costa Martins</b>
              <span className="sc-small">Hoje, 10:00–10:45 · Sessão</span>
              <b className="sc-label">Quem está assinando</b>
              <div className="sc-choices">
                <span data-active="">
                  <b>Fernanda Costa</b> Mãe
                </span>
                <span>
                  <b>Ricardo Martins</b> Pai
                </span>
                <span>
                  <b>Outra pessoa</b>
                </span>
              </div>
              <b className="sc-label">Assinatura</b>
              <div className="sc-pad">
                {beat >= 3 && (
                  <svg
                    viewBox="0 0 260 90"
                    className={beat === 3 && timeline.moving ? 'sc-draw' : undefined}
                  >
                    {SIGNATURE.map((d, i) => (
                      <path key={d} d={d} pathLength={1} style={vars({ '--i': i })} />
                    ))}
                  </svg>
                )}
              </div>
              <span className="sc-small">
                Ao assinar, Fernanda Costa confirma que Alice Costa chegou para a sessão de hoje.
              </span>
              <div className="sc-dialog-foot">
                <span className="sc-btn">Cancelar</span>
                <span className="sc-btn sc-btn-solid" data-target="confirm">
                  <PenLine />
                  Confirmar chegada
                </span>
              </div>
            </div>
          </>
        )}
        <Toast
          show={signed && beat <= 6}
          title="Chegada assinada"
          text="Alice Costa · hoje às 09:54, por Fernanda Costa"
        />
      </Window>
    </Stage>
  )
}

const TERM_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'send' },
  { ms: 1000, click: true },
  { ms: 2200, hide: true },
  { ms: 2600, hide: true },
  { ms: 500, hide: true }
]

export function TermsScene() {
  const timeline = useTimeline(TERM_BEATS, 4)
  const { beat } = timeline
  const sent = beat >= 2
  const signed = beat >= 4
  const status = signed
    ? 'Assinado por Fernanda Costa (mãe) hoje às 10:41'
    : sent
      ? 'Enviado para Fernanda (mãe) hoje · vence em 27/10'
      : 'Ainda não enviado'
  return (
    <Stage
      timeline={timeline}
      beats={TERM_BEATS}
      label="Animação: o termo vai pelo WhatsApp e volta assinado"
    >
      <Window active="Pacientes" trail={['Pacientes', 'Alice Costa Martins']}>
        <div className="sc-page">
          <PatientHead tab="Termos" />
          <div className="sc-terms">
            <div className="sc-term">
              <span className="sc-term-icon">
                <FilePen />
              </span>
              <span className="sc-two" key={status}>
                <b>Autorização de uso de imagem</b>
                <span className={sent ? 'sc-in' : undefined}>
                  {signed && <Check />}
                  {status}
                </span>
              </span>
              {signed ? (
                <span className="sc-btn sc-in">Ver PDF</span>
              ) : sent ? (
                <span className="sc-actions sc-in">
                  <span className="sc-link">Colar resposta</span>
                  <span className="sc-btn">
                    <Send />
                    Reenviar
                  </span>
                </span>
              ) : (
                <span className="sc-btn" data-target="send">
                  <Send />
                  Enviar termo
                </span>
              )}
            </div>
            <div className="sc-term">
              <span className="sc-term-icon">
                <FilePen />
              </span>
              <span className="sc-two">
                <b>Contrato de prestação de serviços</b>
                <span>
                  <Check />
                  Assinado por Fernanda Costa (mãe) em 15/10
                </span>
              </span>
              <span className="sc-btn">Ver PDF</span>
            </div>
          </div>
        </div>
        <Toast show={signed} title="Termo assinado" text="Fernanda Costa assinou pelo celular" />
      </Window>
    </Stage>
  )
}

const FINANCE_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'pay' },
  { ms: 800, click: true },
  { ms: 1000, to: 'ok' },
  { ms: 2400, click: true },
  { ms: 1600, hide: true },
  { ms: 500, hide: true }
]

export function FinanceScene() {
  const timeline = useTimeline(FINANCE_BEATS, 4)
  const { beat } = timeline
  const dialog = beat === 2 || beat === 3
  const paid = beat >= 4
  const rows = [
    ...(paid
      ? [{ date: '20/10', title: 'Pagamento · Pix', status: '', value: '−R$ 360,00', fresh: true }]
      : []),
    {
      date: '14/10',
      title: 'Sessão de 14/10 · Fonoaudiologia',
      status: paid ? 'Pago' : 'Em aberto',
      value: 'R$ 180,00'
    },
    {
      date: '07/10',
      title: 'Sessão de 07/10 · Fonoaudiologia',
      status: paid ? 'Pago' : 'Em aberto',
      value: 'R$ 180,00'
    },
    { date: '05/10', title: 'Pagamento · Cartão', status: '', value: '−R$ 540,00' },
    { date: '30/09', title: 'Sessão de 30/09 · Fonoaudiologia', status: 'Pago', value: 'R$ 180,00' }
  ]
  return (
    <Stage
      timeline={timeline}
      beats={FINANCE_BEATS}
      label="Animação: o pagamento entra na conta do paciente"
    >
      <Window active="Pacientes" trail={['Pacientes', 'Alice Costa Martins']}>
        <div className="sc-page">
          <PatientHead tab="Financeiro" />
          <div className="sc-balance">
            <span className="sc-two">
              <span>Em aberto</span>
              <b key={String(paid)} className="sc-money sc-in">
                {paid ? 'R$ 0,00' : 'R$ 360,00'}
              </b>
            </span>
            <span className="sc-actions">
              <span className="sc-btn">Cobrar</span>
              <span className="sc-btn sc-btn-strong" data-target="pay">
                Registrar pagamento
              </span>
            </span>
          </div>
          <b className="sc-section">Extrato</b>
          <div className="sc-ledger">
            {rows.map((row) => (
              <div
                key={row.date + row.title}
                className={`sc-ledger-row${row.fresh ? ' sc-in' : ''}`}
              >
                <span className="sc-faint">{row.date}</span>
                <span className="sc-two">
                  <b>{row.title}</b>
                  {row.status && <span>{row.status}</span>}
                </span>
                <b>{row.value}</b>
              </div>
            ))}
          </div>
        </div>
        {dialog && (
          <>
            <div className="sc-dim sc-fade" />
            <div className="sc-dialog sc-pay sc-in">
              <b className="sc-dialog-title">Registrar pagamento</b>
              <span className="sc-label">Valor</span>
              <span className="sc-input">R$ 360,00</span>
              <span className="sc-label">Forma</span>
              <span className="track sc-seg sc-seg-wide">
                <span data-active="">Pix</span>
                <span>Dinheiro</span>
                <span>Cartão</span>
                <span>Transferência</span>
              </span>
              <div className="sc-dialog-foot">
                <span className="sc-btn">Cancelar</span>
                <span className="sc-btn sc-btn-solid" data-target="ok">
                  Registrar
                </span>
              </div>
            </div>
          </>
        )}
        <Toast
          show={beat === 5}
          title="Pagamento registrado"
          text="Alice Costa Martins · R$ 360,00 por Pix"
        />
      </Window>
    </Stage>
  )
}

const BACKUP_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'copy' },
  { ms: 1700, click: true },
  { ms: 2200, hide: true },
  { ms: 500, hide: true }
]

export function BackupScene() {
  const timeline = useTimeline(BACKUP_BEATS, 3)
  const { beat } = timeline
  const loading = beat === 2
  const done = beat >= 3
  return (
    <Stage
      timeline={timeline}
      beats={BACKUP_BEATS}
      label="Animação: uma cópia cifrada vai para a pasta da nuvem"
    >
      <Window active="Armazenamento" settings trail={['Configurações', 'Armazenamento']}>
        <div className="sc-page sc-settings">
          <b className="sc-section-title">Cópia de segurança</b>
          <span className="sc-small">
            Uma cópia cifrada dos pacientes e da agenda, numa pasta da nuvem, para não perder nada
            se este computador quebrar.
          </span>
          <span className="sc-group-label">Cópia</span>
          <div className="sc-block sc-backup">
            <i className={done ? 'sc-dot' : 'sc-dot sc-dot-empty'} />
            <span className="sc-two" key={String(done)}>
              <b className={done ? 'sc-in' : undefined}>
                {done ? 'Última cópia agora' : 'Última cópia ontem às 19:00'}
              </b>
              <span>iCloud Drive · todo dia às 19:00</span>
            </span>
            <span
              className="sc-btn sc-btn-surface sc-loading-btn"
              data-target="copy"
              data-loading={loading ? '' : undefined}
            >
              <span className="sc-loading-label">Fazer cópia agora</span>
              {loading && (
                <span className="sc-symbol">
                  <AuriSymbol />
                  <span className="sc-symbol-fill">
                    <AuriSymbol />
                  </span>
                </span>
              )}
            </span>
          </div>
          <span className="sc-group-label">Frequência</span>
          <div className="sc-block sc-row-between">
            <span className="sc-two">
              <b>Todo dia às 19:00</b>
              <span>Mesmo com o Auri fechado, a cópia sai na próxima vez que ele abrir.</span>
            </span>
          </div>
        </div>
        <Toast show={done && beat <= 3} title="Cópia feita" text="no iCloud Drive, cifrada" />
      </Window>
    </Stage>
  )
}

const CONNECTION_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'switch' },
  { ms: 1300, click: true },
  { ms: 1300, hide: true },
  { ms: 2200, hide: true },
  { ms: 500, hide: true }
]

export function ConnectionScene() {
  const timeline = useTimeline(CONNECTION_BEATS, 4)
  const { beat } = timeline
  const on = beat >= 2
  const devices = [...(beat >= 3 ? ['Consultório 1'] : []), ...(beat >= 4 ? ['Consultório 2'] : [])]
  return (
    <Stage
      timeline={timeline}
      beats={CONNECTION_BEATS}
      label="Animação: outros computadores da clínica usam os dados da recepção"
    >
      <Window active="Armazenamento" settings trail={['Configurações', 'Armazenamento']}>
        <div className="sc-page sc-settings">
          <b className="sc-section-title">Conexão</b>
          <span className="sc-small">
            Qual computador guarda os pacientes e a agenda, e quais outros podem usá-los.
          </span>
          <span className="sc-group-label">Onde ficam os dados</span>
          <div className="sc-block sc-cards">
            <span className="sc-card" data-active="">
              <HardDrive />
              <b>Este computador guarda os dados</b>
              <Check />
            </span>
            <span className="sc-card">
              <Laptop />
              <b>Usar os dados de outro computador</b>
            </span>
          </div>
          <span className="sc-group-label">Rede</span>
          <div className="sc-block sc-row-between">
            <span className="sc-two" key={String(on)}>
              <b>Compartilhar com outros computadores da rede</b>
              <span>
                {on
                  ? 'Ligado: os computadores da clínica podem pedir para entrar.'
                  : 'Desligado: nenhum outro computador consegue acessar os dados deste.'}
              </span>
            </span>
            <span className="sc-switch" data-on={on ? '' : undefined} data-target="switch">
              <i />
            </span>
          </div>
          {devices.length > 0 && (
            <>
              <span className="sc-group-label sc-in">Computadores conectados</span>
              <div className="sc-block sc-devices sc-in">
                {devices.map((device) => (
                  <span key={device} className="sc-device sc-in">
                    <Laptop />
                    <b>{device}</b>
                    <span>conectado agora</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </Window>
    </Stage>
  )
}
