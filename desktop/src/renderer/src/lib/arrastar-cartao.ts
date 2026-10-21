import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { Funcionamento } from '@shared/agenda'
import { formatTime, parseIsoLocalDateTime } from '@shared/dates'
import {
  alvoNoPonto,
  aoSoltar,
  duracaoDe,
  horarioDe,
  passouDoLimiar,
  posicaoLivre,
  problemaNoDestino,
  rolagemNaBorda,
  topoDoMinuto,
  type Alvo,
  type Area,
  type Arrastavel,
  type Coluna,
  type Destino,
  type Grade,
  type Ponto,
  type Soltura
} from './arrastar'

export type Arraste = { chave: string; fase: 'erguido' | 'pousando' }

export type Contexto = {
  dias: readonly Date[]
  abre: number
  minutos: number
  funcionamento: Funcionamento
  item: (chave: string) => Arrastavel | null
  soltar: (item: Arrastavel, soltura: Soltura) => void
}

type Faixa = Coluna & { cartao: number; largura: number }

type Medidas = {
  vista: HTMLElement
  conteudo: HTMLElement
  base: Ponto
  interno: Ponto
  cartao: DOMRect
  rolagem: number
  topo: number
  altura: number
  abre: number
  minutos: number
  faixas: Faixa[]
  area: Area
}

type Copia = {
  fantasma: HTMLElement
  erguido: HTMLElement
  etiqueta: HTMLElement
  horarios: [HTMLElement, string][]
  atual: string
}

type Voo = Copia & {
  item: Arrastavel
  chave: string
  medidas: Medidas
  pega: Ponto
  duracao: number
  marca: HTMLElement
  alvo: Alvo | null
  desenhado: Ponto | null
  quadro: number
  largado: boolean
  feito: boolean
  animacao: Animation | null
}

type Gesto = {
  ponteiro: number
  origem: HTMLElement
  item: Arrastavel
  chave: string
  inicio: Ponto
  agora: Ponto
  voo: Voo | null
  preso: boolean
  ouvido: AbortController
}

const ERGUER_MS = 140
const POUSAR_MS = 180
const SUAVE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const ASSENTADO: Keyframe = { transform: 'none', boxShadow: 'none', opacity: 1 }

const translacao = ({ x, y }: Ponto): string => `translate3d(${x}px, ${y}px, 0)`

function semMovimento(): boolean {
  return getComputedStyle(document.documentElement).getPropertyValue('--shift').trim() === '0'
}

function grade(m: Medidas, rolagem: number): Grade {
  return {
    colunas: m.faixas,
    topo: m.topo - (rolagem - m.rolagem),
    altura: m.altura,
    abre: m.abre,
    minutos: m.minutos
  }
}

function medir(origem: HTMLElement, ctx: Contexto): Medidas | null {
  const vista = origem.closest<HTMLElement>('.rbc-time-view')
  const conteudo = origem.closest<HTMLElement>('.rbc-time-content')
  if (!vista || !conteudo) return null
  const colunas = Array.from(conteudo.children).filter((el) =>
    el.classList.contains('rbc-day-slot')
  )
  if (colunas.length !== ctx.dias.length) return null
  const faixas: Faixa[] = []
  let topo = 0
  let altura = 0
  colunas.forEach((coluna, i) => {
    const r = coluna.getBoundingClientRect()
    if (r.width === 0) return
    const eventos = coluna.querySelector('.rbc-events-container')?.getBoundingClientRect() ?? r
    faixas.push({
      dia: ctx.dias[i],
      esquerda: r.left,
      direita: r.right,
      cartao: eventos.left,
      largura: eventos.width
    })
    topo = r.top
    altura = r.height
  })
  if (faixas.length === 0 || altura <= 0) return null
  const v = vista.getBoundingClientRect()
  const c = conteudo.getBoundingClientRect()
  return {
    vista,
    conteudo,
    base: { x: v.left, y: v.top },
    interno: {
      x: c.left + conteudo.clientLeft,
      y: c.top + conteudo.clientTop - conteudo.scrollTop
    },
    cartao: origem.getBoundingClientRect(),
    rolagem: conteudo.scrollTop,
    topo,
    altura,
    abre: ctx.abre,
    minutos: ctx.minutos,
    faixas,
    area: { topo: c.top, baixo: c.bottom, esquerda: c.left, direita: c.right }
  }
}

function copiar(origem: HTMLElement, m: Medidas, item: Arrastavel): Copia {
  const copia = origem.cloneNode(true) as HTMLElement
  copia.classList.remove('event-arrived')
  for (const nome of ['title', 'tabindex', 'role']) copia.removeAttribute(nome)
  Object.assign(copia.style, { top: '0', left: '0', width: '100%', height: '100%' })
  const horarios = Array.from(
    copia.querySelectorAll<HTMLElement>('[data-horario]'),
    (el): [HTMLElement, string] => [el, el.textContent ?? '']
  )
  const atual = textoDoHorario(horarioDe(item))
  const erguido = document.createElement('div')
  erguido.className = 'agenda-fantasma-erguido'
  erguido.append(copia)
  const etiqueta = document.createElement('span')
  etiqueta.className = 'agenda-fantasma-horario'
  etiqueta.hidden = true
  const fantasma = document.createElement('div')
  fantasma.className = 'rbc-day-slot agenda-fantasma'
  fantasma.setAttribute('aria-hidden', 'true')
  Object.assign(fantasma.style, {
    width: `${m.cartao.width}px`,
    height: `${m.cartao.height}px`,
    transform: translacao({ x: m.cartao.left - m.base.x, y: m.cartao.top - m.base.y })
  })
  fantasma.append(erguido, etiqueta)
  return { fantasma, erguido, etiqueta, horarios, atual }
}

function marcaDe(origem: HTMLElement, m: Medidas, duracao: number): HTMLElement {
  const marca = document.createElement('div')
  marca.className = 'agenda-destino'
  marca.setAttribute('aria-hidden', 'true')
  marca.hidden = true
  marca.style.height = `${(duracao / m.minutos) * m.altura}px`
  const cor = origem.style.getPropertyValue('--tipo-cor')
  if (cor) marca.style.setProperty('--tipo-cor', cor)
  return marca
}

function textoDoHorario({ inicio, fim }: Destino): string {
  const hora = (valor: string): string => formatTime(parseIsoLocalDateTime(valor))
  return `${hora(inicio)} – ${hora(fim)}`
}

function engolirClique(): void {
  const engolir = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
  }
  window.addEventListener('click', engolir, true)
  setTimeout(() => window.removeEventListener('click', engolir, true))
}

function arrastarCartoes(
  raiz: HTMLElement,
  contexto: () => Contexto,
  mostrar: (arraste: Arraste | null) => void
): () => void {
  let gesto: Gesto | null = null
  let emVoo: Voo | null = null

  function ouvir(): AbortController {
    const ouvido = new AbortController()
    const { signal } = ouvido
    window.addEventListener('pointermove', mover, { signal })
    window.addEventListener('pointerup', soltar, { signal })
    window.addEventListener('pointercancel', desistir, { signal })
    window.addEventListener('blur', desistir, { signal })
    window.addEventListener('keydown', tecla, { signal, capture: true })
    return ouvido
  }

  function encerrarGesto(): void {
    gesto?.ouvido.abort()
    gesto = null
  }

  function abandonar(): void {
    const voo = gesto?.voo
    encerrarGesto()
    if (voo && !voo.largado) voltar(voo)
  }

  function pressionar(e: PointerEvent): void {
    if (e.button !== 0 || !e.isPrimary || e.pointerType === 'touch') return
    const alvo = e.target
    if (!(alvo instanceof Element) || alvo.closest('.rbc-addons-dnd-resize-ns-anchor')) return
    const origem = alvo.closest<HTMLElement>('.rbc-time-content .rbc-event')
    const chave = origem?.querySelector<HTMLElement>('[data-chave]')?.dataset.chave
    const item = chave ? contexto().item(chave) : null
    if (!origem || !chave || !item) return
    e.preventDefault()
    abandonar()
    if (emVoo) aterrissar(emVoo)
    const ponto = { x: e.clientX, y: e.clientY }
    gesto = {
      ponteiro: e.pointerId,
      origem,
      item,
      chave,
      inicio: ponto,
      agora: ponto,
      voo: null,
      preso: false,
      ouvido: ouvir()
    }
  }

  function mover(e: PointerEvent): void {
    const g = gesto
    if (!g || e.pointerId !== g.ponteiro) return
    g.agora = { x: e.clientX, y: e.clientY }
    if (g.voo || g.preso || !passouDoLimiar(g.inicio, g.agora)) return
    g.voo = desgrudar(g)
    g.preso = !g.voo
  }

  function desgrudar(g: Gesto): Voo | null {
    const medidas = medir(g.origem, contexto())
    if (!medidas) return null
    const duracao = duracaoDe(g.item)
    const copia = copiar(g.origem, medidas, g.item)
    const marca = marcaDe(g.origem, medidas, duracao)
    medidas.conteudo.append(marca)
    medidas.vista.append(copia.fantasma)
    if (!semMovimento()) {
      copia.erguido.animate([{ ...ASSENTADO, offset: 0 }], {
        duration: ERGUER_MS,
        easing: SUAVE
      })
    }
    document.documentElement.dataset.arrastando = ''
    const voo: Voo = {
      ...copia,
      item: g.item,
      chave: g.chave,
      medidas,
      pega: { x: g.inicio.x - medidas.cartao.left, y: g.inicio.y - medidas.cartao.top },
      duracao,
      marca,
      alvo: null,
      desenhado: null,
      quadro: 0,
      largado: false,
      feito: false,
      animacao: null
    }
    emVoo = voo
    mostrar({ chave: g.chave, fase: 'erguido' })
    voo.quadro = requestAnimationFrame(() => quadro(g, voo))
    return voo
  }

  function quadro(g: Gesto, v: Voo): void {
    if (v.largado) return
    const { conteudo, area } = v.medidas
    const rolagem = conteudo.scrollTop
    acompanhar(v, g.agora, rolagem)
    const passo = rolagemNaBorda(g.agora, area)
    if (passo) conteudo.scrollTop = rolagem + passo
    v.quadro = requestAnimationFrame(() => quadro(g, v))
  }

  function acompanhar(v: Voo, ponteiro: Ponto, rolagem: number): void {
    const m = v.medidas
    const livre = posicaoLivre(ponteiro, v.pega)
    if (v.desenhado !== ponteiro) {
      v.fantasma.style.transform = translacao({ x: livre.x - m.base.x, y: livre.y - m.base.y })
      v.desenhado = ponteiro
    }
    const alvo = alvoNoPonto(grade(m, rolagem), ponteiro.x, livre.y, v.duracao)
    if (alvo?.coluna === v.alvo?.coluna && alvo?.minuto === v.alvo?.minuto) return
    v.alvo = alvo
    marcar(v)
  }

  function marcar(v: Voo): void {
    const { marca, etiqueta, alvo, medidas: m } = v
    marca.hidden = !alvo
    etiqueta.hidden = !alvo
    const texto = alvo ? textoDoHorario(alvo.destino) : null
    for (const [el, original] of v.horarios) {
      el.textContent = texto ? original.replace(v.atual, texto) : original
    }
    if (!alvo || !texto) return
    const faixa = m.faixas[alvo.coluna]
    const y = topoDoMinuto(grade(m, m.rolagem), alvo.minuto)
    marca.style.transform = translacao({ x: faixa.cartao - m.interno.x, y: y - m.interno.y })
    marca.style.width = `${faixa.largura}px`
    etiqueta.textContent = texto
    const { funcionamento } = contexto()
    const recusado = problemaNoDestino(v.item, alvo.destino, funcionamento, new Date()) !== null
    marca.classList.toggle('recusado', recusado)
    etiqueta.classList.toggle('recusado', recusado)
  }

  function soltar(e: PointerEvent): void {
    const g = gesto
    if (!g || e.pointerId !== g.ponteiro) return
    encerrarGesto()
    const v = g.voo
    if (!v) return
    engolirClique()
    if (v.largado) return
    const m = v.medidas
    if (!m.conteudo.isConnected) {
      voltar(v)
      return
    }
    acompanhar(v, { x: e.clientX, y: e.clientY }, m.conteudo.scrollTop)
    const ctx = contexto()
    const soltura = aoSoltar(v.item, v.alvo?.destino ?? null, ctx.funcionamento, new Date())
    ctx.soltar(v.item, soltura)
    if (soltura.tipo === 'move' && v.alvo) pousar(v, v.alvo)
    else voltar(v)
  }

  function desistir(e: Event): void {
    if (e instanceof PointerEvent && e.pointerId !== gesto?.ponteiro) return
    abandonar()
  }

  function tecla(e: KeyboardEvent): void {
    const v = gesto?.voo
    if (e.key !== 'Escape' || !v || v.largado) return
    e.preventDefault()
    e.stopPropagation()
    voltar(v)
  }

  function pousar(v: Voo, alvo: Alvo): void {
    const m = v.medidas
    const topo = topoDoMinuto(grade(m, m.conteudo.scrollTop), alvo.minuto)
    mostrar({ chave: v.chave, fase: 'pousando' })
    voar(v, { x: m.faixas[alvo.coluna].cartao - m.base.x, y: topo - m.base.y })
  }

  function voltar(v: Voo): void {
    const m = v.medidas
    v.marca.hidden = true
    for (const [el, original] of v.horarios) el.textContent = original
    const desvio = m.conteudo.scrollTop - m.rolagem
    voar(v, { x: m.cartao.left - m.base.x, y: m.cartao.top - desvio - m.base.y })
  }

  function voar(v: Voo, para: Ponto): void {
    v.largado = true
    v.etiqueta.hidden = true
    cancelAnimationFrame(v.quadro)
    delete document.documentElement.dataset.arrastando
    if (semMovimento()) {
      aterrissar(v)
      return
    }
    const de = v.fantasma.style.transform
    const ate = translacao(para)
    v.fantasma.style.transform = ate
    const tempo = { duration: POUSAR_MS, easing: SUAVE }
    v.erguido.animate([{ ...ASSENTADO, offset: 1 }], { ...tempo, fill: 'forwards' })
    v.animacao = v.fantasma.animate([{ transform: de }, { transform: ate }], tempo)
    v.animacao.finished.then(
      () => aterrissar(v),
      () => aterrissar(v)
    )
  }

  function aterrissar(v: Voo): void {
    if (v.feito) return
    v.feito = true
    v.largado = true
    cancelAnimationFrame(v.quadro)
    v.animacao?.cancel()
    if (emVoo === v) {
      emVoo = null
      delete document.documentElement.dataset.arrastando
      flushSync(() => mostrar(null))
    }
    v.fantasma.remove()
    v.marca.remove()
  }

  raiz.addEventListener('pointerdown', pressionar, true)
  return () => {
    raiz.removeEventListener('pointerdown', pressionar, true)
    encerrarGesto()
    const v = emVoo
    emVoo = null
    delete document.documentElement.dataset.arrastando
    if (v) aterrissar(v)
  }
}

export function useArrastarCartao(
  raiz: RefObject<HTMLElement | null>,
  contexto: Contexto
): Arraste | null {
  const [arraste, setArraste] = useState<Arraste | null>(null)
  const atual = useRef(contexto)
  useLayoutEffect(() => {
    atual.current = contexto
  })
  useEffect(() => {
    const el = raiz.current
    if (!el) return
    return arrastarCartoes(el, () => atual.current, setArraste)
  }, [raiz])
  return arraste
}
