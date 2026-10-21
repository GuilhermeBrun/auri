import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AuriSymbol,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Clock,
  Copy,
  Eraser,
  FilePen,
  FileText,
  FolderOpen,
  HardDrive,
  Hourglass,
  Laptop,
  PenLine,
  Pencil,
  Plus,
  Printer,
  Send,
  Undo,
  X
} from '../components/icons'
import { Stage, Toast, Window } from './Stage'
import { useTimeline, type Beat } from './timeline'

const FIRST = 8

const vars = (values: Record<string, number | string>) => values as CSSProperties

const clock = (hours: number) =>
  `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`

type Mark = 'signed' | 'confirmed' | 'waiting'

type Kind = 'Sessão' | 'Avaliação' | 'Exame' | 'Reunião'

type Session = {
  day: number
  start: number
  len?: number
  name: string
  kind?: Kind
  mark?: Mark
  target?: string
  fresh?: boolean
  origin?: boolean
}

const MARK_ICONS = { signed: PenLine, confirmed: Check, waiting: Clock }

const KIND_CLASS: Record<Kind, string> = {
  Sessão: 'ev-sessao',
  Avaliação: 'ev-avaliacao',
  Exame: 'ev-exame',
  Reunião: 'ev-reuniao ev-block'
}

function Ev({ start, len = 0.75, name, kind = 'Sessão', mark, target, fresh, origin }: Session) {
  const Icon = mark && MARK_ICONS[mark]
  const block = kind === 'Reunião'
  const range = `${clock(start)} – ${clock(start + len)}`
  return (
    <span
      className={`ev ${KIND_CLASS[kind]}${fresh ? ' sc-new' : ''}${origin ? ' origin' : ''}`}
      style={vars({ '--top': start - FIRST, '--len': len })}
      data-target={target}
    >
      <span className="ev-name">
        <span className="ev-name-text">
          {block ? kind : name}
          {block && <span className="ev-kind">{` · ${name}`}</span>}
        </span>
        {Icon && (
          <span className={`ev-mark ev-mark-${mark}`}>
            <Icon />
          </span>
        )}
      </span>
      <span className="ev-time">{block ? range : `${kind} · ${range}`}</span>
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
  { day: 4, start: 8, len: 1, name: 'Manuela Cruz', kind: 'Exame' },
  { day: 3, start: 13, len: 1, name: 'Equipe', kind: 'Reunião' }
]

const AGENDA_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'slot' },
  { ms: 700 },
  { ms: 1800, click: true },
  { ms: 950, to: 'grab' },
  { ms: 450 },
  { ms: 1100, to: 'drop' },
  { ms: 2600, hide: true },
  { ms: 500, hide: true }
]

export function AgendaScene() {
  const timeline = useTimeline(AGENDA_BEATS, 7)
  const { beat } = timeline
  const added = beat >= 3
  const lifted = beat === 5 || beat === 6
  const beatriz: Session =
    beat >= 7
      ? { day: 4, start: 10.5, name: 'Beatriz Melo' }
      : {
          day: 3,
          start: 9.5,
          name: 'Beatriz Melo',
          mark: 'waiting',
          target: 'grab',
          origin: lifted
        }
  const sessions: Session[] = [
    ...BASE,
    beatriz,
    { day: 1, start: 10, name: 'Laura Dias', mark: 'signed' },
    ...(added ? [{ day: 2, start: 10.5, name: 'Maria Eduarda', fresh: beat === 3 }] : [])
  ]
  return (
    <Stage
      timeline={timeline}
      beats={AGENDA_BEATS}
      label="Animação: um clique num horário livre agenda a sessão, e arrastar a sessão remarca"
    >
      <Window active="Agenda" trail={['Agenda', '19 a 23 de outubro 2026']} tools={<AgendaTools />}>
        <Week
          days={WEEK}
          sessions={sessions}
          now={{ day: 1, at: 9.75 }}
          width={592}
          extra={(day) => (
            <>
              {day === 2 && (
                <>
                  {beat === 2 && (
                    <div className="ghost" style={vars({ '--top': 10.5 - FIRST })}>
                      10:30 – 11:15
                    </div>
                  )}
                  <Slot start={10.5} target="slot" />
                </>
              )}
              {day === 3 && lifted && (
                <div
                  className="sc-lift"
                  data-moving={beat === 6 ? '' : undefined}
                  style={vars({
                    '--top': 9.5 - FIRST,
                    '--len': 0.75,
                    '--dy': 1
                  })}
                >
                  <span className="sc-lift-card">
                    <Ev day={3} start={9.5} name="Beatriz Melo" mark="waiting" />
                  </span>
                  <span className="lift-time">
                    {beat === 6 ? '10:30 – 11:15' : '09:30 – 10:15'}
                  </span>
                </div>
              )}
              {day === 4 && (
                <>
                  {beat === 6 && (
                    <div
                      className="drop ev-sessao sc-fade"
                      style={vars({ '--top': 10.5 - FIRST, '--len': 0.75 })}
                    />
                  )}
                  <Slot start={10.5} target="drop" />
                </>
              )}
            </>
          )}
        />
        <Toast
          show={beat === 3 || beat === 4}
          title="Sessão agendada"
          text="Maria Eduarda · qua, 21 de out às 10:30"
        />
        <Toast
          show={beat === 7}
          title="Sessão remarcada"
          text="Beatriz Melo · sex, 23 de out · 10:30–11:15"
          action="Desfazer"
        />
      </Window>
    </Stage>
  )
}

type Status = 'pending' | 'waiting' | 'confirmed'

const CONFIRM_GROUPS = [
  {
    day: 'Hoje',
    rows: [
      {
        time: '11:30',
        name: 'Davi Lima',
        who: 'Patrícia (Mãe) · (65) 99031-1188',
        until: '11:15'
      }
    ]
  },
  {
    day: 'Quarta-feira, 21/10',
    rows: [
      {
        time: '08:00',
        name: 'Manuela Cruz',
        who: 'Débora (Mãe) · (65) 99020-1147',
        until: '12:24'
      },
      {
        time: '09:00',
        name: 'Theo Martins',
        who: 'Juliana (Mãe) · (65) 99014-1105',
        until: '12:24'
      },
      { time: '10:30', name: 'Alice Costa', who: 'Fernanda (Mãe) · (65) 99010-1077' }
    ]
  }
]

const CONFIRM_TOTAL = CONFIRM_GROUPS.reduce((total, group) => total + group.rows.length, 0)

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

function SendIcons() {
  return (
    <>
      <span className="sc-icon-sm">
        <Copy />
      </span>
      <span className="sc-icon-sm">
        <Send />
      </span>
    </>
  )
}

function StatusCell({ status, until }: { status: Status; until?: string }) {
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
        <span className="sc-until">
          <Clock />
          até {until}
        </span>
        <SendIcons />
      </span>
    )
  }
  return (
    <span className="sc-status" key="pending">
      <SendIcons />
    </span>
  )
}

export function ConfirmationScene() {
  const timeline = useTimeline(CONFIRM_BEATS, 7)
  const { beat } = timeline
  const status = (row: number): Status => {
    if ((row === 1 && beat >= 6) || (row === 0 && beat >= 7)) return 'confirmed'
    return row < 3 && beat >= 2 + row ? 'waiting' : 'pending'
  }
  const left = CONFIRM_TOTAL - Math.min(Math.max(beat - 1, 0), 3)
  let index = 0
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
          <b className="sc-dialog-title">Confirmações</b>
          <p className="sc-dialog-text">
            Prazo de 2 horas, ou até 15 min antes da sessão. Sem resposta, a falta é cobrada.
          </p>
          {CONFIRM_GROUPS.map((group) => (
            <div key={group.day} className="sc-rows">
              <span className="sc-rows-day">{group.day}</span>
              {group.rows.map((row) => {
                const i = index++
                return (
                  <div key={row.name} className="sc-row">
                    <b className="sc-row-time">{row.time}</b>
                    <span className="sc-two">
                      <b>{row.name}</b>
                      <span>{row.who}</span>
                    </span>
                    <StatusCell status={status(i)} until={row.until} />
                  </div>
                )
              })}
            </div>
          ))}
          <div className="sc-dialog-foot sc-foot-split">
            <span className="sc-btn sc-btn-ghost">
              <ClipboardPaste />
              Colar resposta
            </span>
            <span className="sc-btn sc-btn-solid" data-target="send">
              <Send />
              {left > 1 ? `Enviar a próxima (${left})` : 'Enviar a próxima'}
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
    since: 'Esperando há 6 dias',
    fits: 'qui, 22 de out · 08:00–08:45'
  },
  {
    name: 'Lívia Ramos',
    initials: 'LR',
    text: 'Avaliação · 60 min · qualquer dia · tarde',
    since: 'Esperando há 2 dias'
  },
  {
    name: 'Nicolas Araújo',
    initials: 'NA',
    text: 'Sessão · 45 min · ter, qui · qualquer horário',
    since: 'Entrou hoje',
    fits: 'qui, 22 de out · 08:00–08:45'
  }
]

const WAIT_BEATS: Beat[] = [
  { ms: 800 },
  { ms: 1000, to: 'slot' },
  { ms: 1500, click: true },
  { ms: 1000, to: 'pick' },
  { ms: 1300, click: true },
  { ms: 900, to: 'book' },
  { ms: 2200, click: true },
  { ms: 1800, hide: true },
  { ms: 500, hide: true }
]

export function WaitlistScene() {
  const timeline = useTimeline(WAIT_BEATS, 6)
  const { beat } = timeline
  const vaga = beat >= 2 && beat <= 5
  const dialog = beat === 4 || beat === 5
  const booked = beat >= 6
  const shown = vaga ? WAITING.filter((item) => item.fits) : WAITING.slice(booked ? 1 : 0)
  const sessions: Session[] = [
    { day: 0, start: 9, name: 'Theo Martins', mark: 'confirmed' },
    { day: 0, start: 11.5, name: 'Lucas Nunes' },
    { day: 1, start: 9.5, name: 'Beatriz Melo' },
    { day: 1, start: 11, name: 'Gabriel Reis' },
    { day: 2, start: 8, len: 1, name: 'Manuela Cruz', kind: 'Exame' },
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
          width={336}
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
            <span className="sc-panel-title">
              <b>{vaga ? 'Cabem neste horário' : 'Lista de espera'}</b>
              {vaga && (
                <span className="sc-panel-icons">
                  <Plus />
                  <X />
                </span>
              )}
            </span>
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
                  <span className="sc-trunc">{item.name}</span>
                  {item.high && <i className="sc-tag">Prioridade</i>}
                </b>
                <span>{item.text}</span>
                <span className="sc-faint">{item.since}</span>
                {vaga ? (
                  <span className="sc-fits" data-target={i === 0 ? 'pick' : undefined}>
                    {item.fits}
                  </span>
                ) : (
                  <span className="sc-more">
                    Horários livres
                    <ChevronDown />
                  </span>
                )}
              </span>
              <span className="sc-edit">
                <Pencil />
              </span>
            </div>
          ))}
        </aside>
        {dialog && (
          <>
            <div className="sc-dim sc-fade" />
            <div className="sc-dialog sc-new-appointment sc-in">
              <span className="sc-dialog-head">
                <b className="sc-dialog-title">Novo agendamento</b>
                <X />
              </span>
              <span className="sc-label">Paciente</span>
              <span className="sc-input sc-patient-pick">
                <span className="sc-mini-avatar">BC</span>
                <b>Bento Carvalho</b>
                <span className="sc-faint">Trocar</span>
              </span>
              <span className="sc-fields">
                <span>
                  <span className="sc-label">Data</span>
                  <span className="sc-input">22/10/2026</span>
                </span>
                <span>
                  <span className="sc-label">Hora</span>
                  <span className="sc-input">08:00</span>
                </span>
                <span>
                  <span className="sc-label">Duração</span>
                  <span className="sc-input">45 min</span>
                </span>
              </span>
              <span className="sc-label">Etiqueta</span>
              <span className="sc-input sc-select">
                <i className="sc-swatch ev-sessao" />
                Sessão
              </span>
              <span className="sc-summary">
                <CalendarDays />
                Sessão de 45 min com Bento Carvalho na quinta-feira, 22 de outubro, das 08:00 às
                08:45.
              </span>
              <div className="sc-dialog-foot">
                <span className="sc-btn sc-btn-solid" data-target="book">
                  Agendar
                </span>
              </div>
            </div>
          </>
        )}
        <Toast
          show={beat >= 6 && beat <= 7}
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

const TOPICS = [
  'Queixa',
  'Gestação e nascimento',
  'Alimentação',
  'Sono',
  'Desenvolvimento e fala',
  'Saúde',
  'Escola e rotina',
  'Terapias',
  'Observações'
]

const ANAMNESE_BEATS: Beat[] = [
  { ms: 800 },
  { ms: 1000, to: 'sono' },
  { ms: 700, click: true },
  { ms: 900, to: 'text' },
  { ms: 3200, click: true },
  { ms: 900, to: 'save' },
  { ms: 1800, click: true },
  { ms: 500, hide: true }
]

const SONO =
  'Dorme por volta das 21h e acorda às 7h. Às vezes acorda de madrugada e vai para a cama dos pais.'

function AnamneseTools({ dirty }: { dirty: boolean }) {
  return (
    <>
      <span className="ghost-icon sc-faint">
        <Printer />
      </span>
      <span className={`sc-btn sc-btn-solid${dirty ? '' : ' sc-btn-off'}`} data-target="save">
        Salvar anamnese
      </span>
    </>
  )
}

export function AnamneseScene() {
  const timeline = useTimeline(ANAMNESE_BEATS, 5)
  const { beat } = timeline
  const sono = beat >= 2
  const written = beat >= 4
  const saved = beat >= 6
  const count = written ? 4 : 3
  return (
    <Stage
      timeline={timeline}
      beats={ANAMNESE_BEATS}
      label="Animação: a anamnese em roteiro, um tema por vez"
    >
      <Window
        active="Pacientes"
        trail={['Pacientes', 'Alice Costa Martins', 'Anamnese']}
        tools={<AnamneseTools dirty={written && !saved} />}
      >
        <div className="sc-page">
          <PatientHead
            tab="Anamnese"
            saved={saved ? 'Salva em 21 de out às 10:14' : 'Salva em 14 de out às 16:40'}
          />
          <div className="sc-anamnese">
            <div className="sc-topics">
              <span className="sc-label">Data da anamnese</span>
              <span className="sc-input sc-date">
                14/10/2026
                <CalendarDays />
              </span>
              <nav>
                {TOPICS.map((topic, i) => {
                  const active = topic === (sono ? 'Sono' : 'Queixa')
                  const done = i < 3 || (topic === 'Sono' && written)
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
              </nav>
              <span className="sc-small sc-count">{count} de 9 temas escritos</span>
            </div>
            <div className="sc-topic" key={sono ? 'sono' : 'queixa'}>
              <span className="sc-small">{sono ? 'Tema 4 de 9' : 'Tema 1 de 9'}</span>
              <b className="sc-topic-title">{sono ? 'Sono' : 'Queixa'}</b>
              <span className="sc-small">
                {sono
                  ? 'Como é o sono e a rotina da noite.'
                  : 'Por que a família procurou a clínica, nas palavras dela.'}
              </span>
              <span className="sc-small sc-prompts">Perguntas para guiar a conversa</span>
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
                data-focus={sono && beat >= 4 && !saved ? '' : undefined}
              >
                {sono
                  ? written && <Typing text={SONO} play={beat === 4 && timeline.moving} />
                  : 'A mãe conta que a Alice troca o "r" pelo "l" ("balata" em vez de "barata") e que os colegas começaram a comentar.'}
              </div>
              <div className="sc-topic-nav">
                <span>
                  {sono && (
                    <>
                      <ChevronLeft />
                      Alimentação
                    </>
                  )}
                </span>
                <span>
                  {sono ? 'Desenvolvimento e fala' : 'Gestação e nascimento'}
                  <ChevronRight />
                </span>
              </div>
            </div>
          </div>
        </div>
        <Toast show={beat === 6} title="Anamnese salva" text="Alice Costa Martins" />
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
  { ms: 900, to: 'assinar' },
  { ms: 700, click: true },
  { ms: 2600, hide: true },
  { ms: 1000, to: 'confirm' },
  { ms: 2000, click: true },
  { ms: 1600, hide: true },
  { ms: 500, hide: true }
]

export function ArrivalScene() {
  const timeline = useTimeline(ARRIVAL_BEATS, 7)
  const { beat } = timeline
  const dialog = beat === 2 || beat === 3
  const signing = beat >= 4 && beat <= 6
  const signed = beat >= 7
  const sessions: Session[] = [
    ...BASE,
    { day: 3, start: 9.5, name: 'Beatriz Melo' },
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
      <Window
        active="Agenda"
        trail={['Agenda', '19 a 23 de outubro 2026']}
        tools={<AgendaTools />}
        overlay={
          signing && (
            <div className="sc-sign sc-fade">
              <div className="sc-sign-head">
                <span>
                  <span className="sc-small">Assinatura de chegada</span>
                  <b className="sc-arrival-name">Alice Costa Martins</b>
                  <span className="sc-sign-when">Hoje, 10:00–10:45 · Sessão</span>
                </span>
                <X />
              </div>
              <div className="sc-sign-body">
                <b className="sc-sign-label">Quem está assinando</b>
                <div className="sc-choices">
                  <span data-active="">
                    <b>Fernanda Costa</b>
                    Mãe
                  </span>
                  <span>
                    <b>Ricardo Martins</b>
                    Pai
                  </span>
                  <span className="sc-choice-other">Outra pessoa</span>
                </div>
                <b className="sc-sign-label">Assinatura</b>
                <div className="sc-pad">
                  {beat >= 5 && (
                    <svg
                      viewBox="0 0 260 90"
                      className={beat === 5 && timeline.moving ? 'sc-draw' : undefined}
                    >
                      {SIGNATURE.map((d, i) => (
                        <path key={d} d={d} pathLength={1} style={vars({ '--i': i })} />
                      ))}
                    </svg>
                  )}
                </div>
                <div className="sc-pad-foot">
                  <span>
                    Ao assinar, Fernanda Costa confirma que Alice Costa chegou para a sessão de
                    hoje.
                  </span>
                  <span className="sc-pad-tools">
                    <span>
                      <Undo />
                      Desfazer traço
                    </span>
                    <span>
                      <Eraser />
                      Limpar
                    </span>
                  </span>
                </div>
              </div>
              <span
                className={`sc-btn sc-btn-solid sc-sign-confirm${beat >= 5 ? '' : ' sc-btn-off'}`}
                data-target="confirm"
              >
                <PenLine />
                Confirmar chegada
              </span>
            </div>
          )
        }
      >
        <Week days={WEEK} sessions={sessions} now={{ day: 1, at: 9.9 }} width={592} />
        {dialog && (
          <>
            <div className="sc-dim sc-fade" />
            <div className="sc-dialog sc-session sc-in">
              <span className="sc-dialog-head">
                <b className="sc-dialog-title">Registro da sessão</b>
                <X />
              </span>
              <span className="sc-label">Paciente</span>
              <span className="sc-input sc-patient-pick">
                <span className="sc-mini-avatar">AM</span>
                <b>Alice Costa Martins</b>
                <span className="sc-faint">Trocar</span>
              </span>
              <span className="sc-fields">
                <span>
                  <span className="sc-label">Data</span>
                  <span className="sc-input">20/10/2026</span>
                </span>
                <span>
                  <span className="sc-label">Hora</span>
                  <span className="sc-input">10:00</span>
                </span>
                <span>
                  <span className="sc-label">Duração</span>
                  <span className="sc-input">45 min</span>
                </span>
              </span>
              <span className="sc-arrival-box">
                <span className="sc-two">
                  <b>Chegada</b>
                  <span>Marca a presença e trava a sessão.</span>
                </span>
                <span className="sc-btn" data-target="assinar">
                  <PenLine />
                  Assinar chegada
                </span>
              </span>
            </div>
          </>
        )}
        <Toast
          show={signed && beat <= 8}
          title="Chegada assinada"
          text="Alice Costa · Fernanda Costa (mãe)"
        />
      </Window>
    </Stage>
  )
}

const TERM_BEATS: Beat[] = [
  { ms: 700 },
  { ms: 1000, to: 'send' },
  { ms: 1000, click: true },
  { ms: 1700, hide: true },
  { ms: 900, to: 'keep' },
  { ms: 2400, click: true },
  { ms: 500, hide: true }
]

export function TermsScene() {
  const timeline = useTimeline(TERM_BEATS, 5)
  const { beat } = timeline
  const sent = beat >= 2
  const receiving = beat === 3 || beat === 4
  const signed = beat >= 5
  const status = signed
    ? 'Assinado por Fernanda Costa (mãe) em 20/10/2026'
    : sent
      ? 'Enviado para Fernanda (mãe) em 20/10 · vence em 27/10'
      : 'Ainda não enviado'
  return (
    <Stage
      timeline={timeline}
      beats={TERM_BEATS}
      label="Animação: o termo vai pelo WhatsApp e volta assinado"
    >
      <Window
        active="Pacientes"
        trail={['Pacientes', 'Alice Costa Martins', 'Termos']}
        tools={
          <span className="ghost-icon">
            <ClipboardPaste />
          </span>
        }
      >
        <div className="sc-page">
          <PatientHead tab="Termos" />
          <div className="sc-terms">
            <div className="sc-term">
              <span className="sc-term-icon">
                <FilePen />
              </span>
              <span className="sc-two" key={status}>
                <b>Autorização de uso de imagem</b>
                <span
                  className={`${sent ? 'sc-in' : ''}${signed ? ' sc-ink' : sent ? '' : ' sc-faint'}`}
                >
                  {status}
                </span>
              </span>
              {signed ? (
                <span className="sc-actions sc-in">
                  <span className="sc-link">Enviar de novo</span>
                  <span className="sc-btn">
                    <FileText />
                    Abrir PDF
                  </span>
                </span>
              ) : sent ? (
                <span className="sc-actions sc-in">
                  <span className="sc-link">
                    <Copy />
                  </span>
                  <span className="sc-link">Cancelar</span>
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
                <span className="sc-ink">Assinado por Fernanda Costa (mãe) em 15/10/2026</span>
              </span>
              <span className="sc-actions">
                <span className="sc-link">Enviar de novo</span>
                <span className="sc-btn">
                  <FileText />
                  Abrir PDF
                </span>
              </span>
            </div>
          </div>
        </div>
        {receiving && (
          <>
            <div className="sc-dim sc-fade" />
            <div className="sc-dialog sc-receive sc-in">
              <span className="sc-dialog-head">
                <b className="sc-dialog-title">Termo assinado</b>
                <X />
              </span>
              <b className="sc-receive-title">Autorização de uso de imagem</b>
              <span className="sc-small">Alice Costa · versão 1</span>
              <div className="sc-receive-box">
                <span className="sc-receive-sign">
                  <svg viewBox="0 0 260 90">
                    {SIGNATURE.map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </svg>
                </span>
                <span className="sc-receive-data">
                  <span>Nome</span>
                  <b>Fernanda Costa</b>
                  <span>CPF</span>
                  <b className="sc-sensitive">123.456.789-00</b>
                  <span>Parentesco</span>
                  <b>Mãe</b>
                  <span>Assinou</span>
                  <b>20/10/2026 às 10:38</b>
                </span>
              </div>
              <div className="sc-dialog-foot">
                <span className="sc-btn">Recusar</span>
                <span className="sc-btn sc-btn-solid" data-target="keep">
                  Guardar termo assinado
                </span>
              </div>
            </div>
          </>
        )}
        <Toast
          show={beat === 5}
          title="Termo guardado"
          text="Autorização de uso de imagem · Fernanda Costa"
        />
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
      ? [{ date: '20/10', title: 'Pagamento · Pix', status: '', value: '-R$ 360,00', fresh: true }]
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
    { date: '05/10', title: 'Pagamento · Cartão', status: '', value: '-R$ 540,00' },
    { date: '30/09', title: 'Sessão de 30/09 · Fonoaudiologia', status: 'Pago', value: 'R$ 180,00' }
  ]
  return (
    <Stage
      timeline={timeline}
      beats={FINANCE_BEATS}
      label="Animação: o pagamento entra na conta do paciente"
    >
      <Window active="Pacientes" trail={['Pacientes', 'Alice Costa Martins', 'Financeiro']}>
        <div className="sc-page">
          <PatientHead tab="Financeiro" />
          <div className="sc-balance">
            <span className="sc-two">
              <span key={`label-${paid}`} className="sc-in">
                {paid ? 'Em dia' : 'Em aberto'}
              </span>
              <b key={String(paid)} className="sc-money sc-in">
                {paid ? 'R$ 0,00' : 'R$ 360,00'}
              </b>
            </span>
            <span className="sc-actions">
              <span className="sc-btn">Cobrar</span>
              <span className="sc-btn sc-btn-solid" data-target="pay">
                Registrar pagamento
              </span>
            </span>
          </div>
          <span className="sc-section-row">
            <b className="sc-section">Forma de cobrança</b>
            <span className="sc-link">Alterar</span>
          </span>
          <span className="sc-two sc-billing">
            <b>Particular por sessão</b>
            <span>Fonoaudiologia R$ 180,00</span>
          </span>
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
              <span className="sc-dialog-head">
                <b className="sc-dialog-title">Registrar pagamento</b>
                <X />
              </span>
              <span className="sc-small">Alice Costa Martins</span>
              <span className="sc-fields sc-fields-two">
                <span>
                  <span className="sc-label sc-label-split">
                    Valor
                    <span className="sc-faint">Em aberto R$ 360,00</span>
                  </span>
                  <span className="sc-input">
                    <span className="sc-faint">R$</span>
                    360,00
                  </span>
                </span>
                <span>
                  <span className="sc-label">Data</span>
                  <span className="sc-input">20/10/2026</span>
                </span>
              </span>
              <span className="sc-label">Forma</span>
              <span className="track sc-seg sc-seg-wide">
                <span data-active="">Pix</span>
                <span>Dinheiro</span>
                <span>Cartão</span>
                <span>Transferência</span>
              </span>
              <span className="sc-label">Observação</span>
              <span className="sc-input" />
              <div className="sc-dialog-foot">
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
          text="Alice Costa · R$ 360,00 · Pix"
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
      <Window
        active="Armazenamento"
        settings
        trail={['Configurações', 'Armazenamento', 'Cópia de segurança']}
      >
        <div className="sc-page sc-settings">
          <b className="sc-section-title">Cópia de segurança</b>
          <div className="sc-groups">
            <div className="sc-group sc-backup">
              <i className="sc-dot" />
              <span className="sc-two" key={String(done)}>
                <b className={done ? 'sc-in' : undefined}>
                  {done ? 'Última cópia hoje às 10:12' : 'Última cópia ontem às 19:00'}
                </b>
                <span>
                  {done ? 'iCloud Drive · 13 cópias · 49 MB' : 'iCloud Drive · 12 cópias · 45 MB'}
                </span>
              </span>
              <span className="sc-actions sc-actions-tight">
                <span className="sc-btn">
                  <FolderOpen />
                  Abrir pasta
                </span>
                <span
                  className="sc-btn sc-loading-btn"
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
              </span>
            </div>
            <div className="sc-group sc-row-between">
              <span className="sc-two">
                <b>iCloud Drive</b>
                <span className="sc-sensitive">iCloud Drive/Auri/Cópias</span>
              </span>
              <span className="sc-btn">Trocar</span>
            </div>
            <div className="sc-group sc-row-between">
              <span className="sc-two">
                <b>Senha</b>
                <span>Também desliga o computador da recepção.</span>
              </span>
              <span className="sc-actions sc-actions-tight">
                <span className="sc-btn">Alterar</span>
                <span className="sc-btn">Esqueci</span>
                <span className="sc-btn">Novo código</span>
              </span>
            </div>
            <div className="sc-group sc-row-between">
              <span className="sc-two">
                <b>Restaurar dados</b>
                <span>Troca os pacientes e a agenda pelos da cópia.</span>
              </span>
              <span className="sc-btn">Restaurar…</span>
            </div>
          </div>
        </div>
        <Toast show={done && beat <= 3} title="Cópia feita" />
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
      <Window active="Armazenamento" settings trail={['Configurações', 'Armazenamento', 'Conexão']}>
        <div className="sc-page sc-settings">
          <b className="sc-section-title">Conexão</b>
          <div className="sc-groups">
            <div className="sc-group">
              <span className="sc-group-label">Onde ficam os dados</span>
              <div className="sc-cards">
                <span className="sc-card" data-active="">
                  <span className="sc-card-top">
                    <HardDrive />
                    <Check />
                  </span>
                  <b>Este computador guarda os dados</b>
                  <span>Os pacientes e a agenda ficam aqui.</span>
                </span>
                <span className="sc-card">
                  <span className="sc-card-top">
                    <Laptop />
                  </span>
                  <b>Usar os dados de outro computador</b>
                  <span>Como o consultório, com os dados da recepção.</span>
                </span>
              </div>
            </div>
            <div className="sc-group">
              <span className="sc-group-label">Rede</span>
              <div className="sc-row-between">
                <span className="sc-two" key={String(on)}>
                  <b>Compartilhar com outros computadores da rede</b>
                  {on && <span className="sc-in">Só com código, e tudo viaja cifrado.</span>}
                </span>
                <span className="sc-switch" data-on={on ? '' : undefined} data-target="switch">
                  <i />
                </span>
              </div>
              {on && (
                <span className="sc-btn sc-pair sc-in">
                  <Plus />
                  Conectar computador
                </span>
              )}
            </div>
            {devices.length > 0 && (
              <div className="sc-group sc-in">
                <span className="sc-group-label">Computadores conectados</span>
                <div className="sc-devices">
                  {devices.map((device) => (
                    <span key={device} className="sc-device sc-in">
                      <i className="sc-dot" />
                      <span className="sc-two">
                        <b>{device}</b>
                        <span>Conectado agora</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Window>
    </Stage>
  )
}
