import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  ALTURA,
  ESPESSURA,
  LARGURA,
  paraQuadro,
  tracoParaSvg,
  type Ponto
} from '../../contrato/assinatura/traco'
import { Desfazer, Limpar } from './icones'

type Ativo = { ponteiro: number; caixa: DOMRect; pontos: Ponto[] }

type Props = {
  tracos: Ponto[][]
  onChange: (tracos: Ponto[][]) => void
}

function amostras(evento: globalThis.PointerEvent): globalThis.PointerEvent[] {
  const juntas = evento.getCoalescedEvents?.() ?? []
  return juntas.length > 0 ? juntas : [evento]
}

function observarTamanho(quadro: HTMLCanvasElement, aoMudar: () => void): ResizeObserver {
  const observador = new ResizeObserver(([entrada]) => {
    const pixels = entrada.devicePixelContentBoxSize?.[0]
    quadro.width = pixels?.inlineSize ?? Math.round(entrada.contentRect.width * devicePixelRatio)
    quadro.height = pixels?.blockSize ?? Math.round(entrada.contentRect.height * devicePixelRatio)
    aoMudar()
  })
  try {
    observador.observe(quadro, { box: 'device-pixel-content-box' })
  } catch {
    observador.observe(quadro)
  }
  return observador
}

export function QuadroDeAssinatura({ tracos, onChange }: Props) {
  const quadro = useRef<HTMLCanvasElement>(null)
  const atuais = useRef(tracos)
  const ativo = useRef<Ativo | null>(null)
  const caminhos = useRef(new WeakMap<Ponto[], Path2D>())
  const [desenhando, setDesenhando] = useState(false)

  const desenhar = useCallback(() => {
    const canvas = quadro.current
    const contexto = canvas?.getContext('2d')
    if (!canvas || !contexto) return
    contexto.setTransform(1, 0, 0, 1, 0, 0)
    contexto.clearRect(0, 0, canvas.width, canvas.height)
    contexto.setTransform(canvas.width / LARGURA, 0, 0, canvas.height / ALTURA, 0, 0)
    contexto.strokeStyle = getComputedStyle(canvas).color
    contexto.lineWidth = ESPESSURA
    contexto.lineCap = 'round'
    contexto.lineJoin = 'round'
    for (const traco of atuais.current) {
      let caminho = caminhos.current.get(traco)
      if (!caminho) {
        caminho = new Path2D(tracoParaSvg(traco))
        caminhos.current.set(traco, caminho)
      }
      contexto.stroke(caminho)
    }
    if (ativo.current) contexto.stroke(new Path2D(tracoParaSvg(ativo.current.pontos)))
  }, [])

  useEffect(() => {
    atuais.current = tracos
    desenhar()
  }, [tracos, desenhar])

  useEffect(() => {
    const canvas = quadro.current
    if (!canvas) return
    const observador = observarTamanho(canvas, desenhar)
    const tema = matchMedia('(prefers-color-scheme: dark)')
    tema.addEventListener('change', desenhar)
    return () => {
      observador.disconnect()
      tema.removeEventListener('change', desenhar)
    }
  }, [desenhar])

  function estender(evento: PointerEvent<HTMLCanvasElement>) {
    const traco = ativo.current
    if (traco?.ponteiro !== evento.pointerId) return
    const { left, top, width, height } = traco.caixa
    for (const amostra of amostras(evento.nativeEvent)) {
      traco.pontos.push(paraQuadro(amostra.clientX - left, amostra.clientY - top, width, height))
    }
    desenhar()
  }

  function comecar(evento: PointerEvent<HTMLCanvasElement>) {
    if (evento.button !== 0 || ativo.current) return
    evento.preventDefault()
    const canvas = evento.currentTarget
    canvas.setPointerCapture(evento.pointerId)
    ativo.current = {
      ponteiro: evento.pointerId,
      caixa: canvas.getBoundingClientRect(),
      pontos: []
    }
    setDesenhando(true)
    estender(evento)
  }

  function terminar(evento: PointerEvent<HTMLCanvasElement>) {
    const traco = ativo.current
    if (traco?.ponteiro !== evento.pointerId) return
    ativo.current = null
    setDesenhando(false)
    onChange([...atuais.current, traco.pontos])
  }

  const vazio = tracos.length === 0

  return (
    <div className="assinatura">
      <div className="quadro">
        <canvas
          ref={quadro}
          role="img"
          aria-label={vazio ? 'Quadro de assinatura, vazio' : 'Quadro de assinatura, assinado'}
          onPointerDown={comecar}
          onPointerMove={estender}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          onLostPointerCapture={terminar}
        />
        {vazio && !desenhando && (
          <span className="quadro-dica" aria-hidden="true">
            Assine aqui
          </span>
        )}
      </div>
      <div className="quadro-acoes">
        <button
          type="button"
          className="botao botao-leve"
          disabled={vazio}
          onClick={() => onChange(tracos.slice(0, -1))}
        >
          <Desfazer />
          Desfazer
        </button>
        <button
          type="button"
          className="botao botao-leve"
          disabled={vazio}
          onClick={() => onChange([])}
        >
          <Limpar />
          Limpar
        </button>
      </div>
    </div>
  )
}
