import { Eraser, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import {
  ALTURA,
  ESPESSURA,
  LARGURA,
  assinaturaMinima,
  codificar,
  paraQuadro,
  simplificar,
  tracoParaSvg,
  type Ponto
} from '../../../../../web/contrato/assinatura/traco'

export type SignatureValue = { encoded: Uint8Array; minimal: boolean }

type SignaturePadProps = {
  onChange: (value: SignatureValue) => void
  className?: string
}

type ActiveStroke = { pointerId: number; box: DOMRect; points: Ponto[] }

const themeQueries = ['(prefers-color-scheme: dark)', '(prefers-contrast: more)']

function samples(event: globalThis.PointerEvent): globalThis.PointerEvent[] {
  const coalesced = event.getCoalescedEvents?.() ?? []
  return coalesced.length > 0 ? coalesced : [event]
}

export function SignaturePad({ onChange, className }: SignaturePadProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Ponto[][]>([])
  const active = useRef<ActiveStroke | null>(null)
  const paths = useRef(new WeakMap<Ponto[], Path2D>())
  const [count, setCount] = useState(0)
  const [drawing, setDrawing] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.setTransform(canvas.width / LARGURA, 0, 0, canvas.height / ALTURA, 0, 0)
    context.strokeStyle = getComputedStyle(canvas).color
    context.lineWidth = ESPESSURA
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const stroke of strokes.current) {
      let path = paths.current.get(stroke)
      if (!path) {
        path = new Path2D(tracoParaSvg(stroke))
        paths.current.set(stroke, path)
      }
      context.stroke(path)
    }
    if (active.current) context.stroke(new Path2D(tracoParaSvg(active.current.points)))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => {
      const device = entry.devicePixelContentBoxSize?.[0]
      canvas.width = device?.inlineSize ?? Math.round(entry.contentRect.width * devicePixelRatio)
      canvas.height = device?.blockSize ?? Math.round(entry.contentRect.height * devicePixelRatio)
      draw()
    })
    observer.observe(canvas, { box: 'device-pixel-content-box' })
    const themes = themeQueries.map((query) => matchMedia(query))
    for (const theme of themes) theme.addEventListener('change', draw)
    return () => {
      observer.disconnect()
      for (const theme of themes) theme.removeEventListener('change', draw)
    }
  }, [draw])

  function commit(next: Ponto[][]): void {
    strokes.current = next
    setCount(next.length)
    const simplified = next.map((stroke) => simplificar(stroke))
    onChange({ encoded: codificar(simplified), minimal: assinaturaMinima(simplified) })
    draw()
  }

  function extend(event: PointerEvent<HTMLCanvasElement>): void {
    const stroke = active.current
    if (stroke?.pointerId !== event.pointerId) return
    const { left, top, width, height } = stroke.box
    for (const sample of samples(event.nativeEvent)) {
      stroke.points.push(paraQuadro(sample.clientX - left, sample.clientY - top, width, height))
    }
    draw()
  }

  function start(event: PointerEvent<HTMLCanvasElement>): void {
    if (event.button !== 0 || active.current) return
    event.preventDefault()
    const canvas = event.currentTarget
    canvas.setPointerCapture(event.pointerId)
    active.current = { pointerId: event.pointerId, box: canvas.getBoundingClientRect(), points: [] }
    setDrawing(true)
    extend(event)
  }

  function finish(event: PointerEvent<HTMLCanvasElement>): void {
    const stroke = active.current
    if (stroke?.pointerId !== event.pointerId) return
    active.current = null
    setDrawing(false)
    commit([...strokes.current, stroke.points])
  }

  const empty = count === 0

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative select-none">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Quadro de assinatura"
          className="block aspect-[5/2] w-full cursor-crosshair touch-none rounded-card bg-fill text-ink"
          onPointerDown={start}
          onPointerMove={extend}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
        />
        {empty && !drawing && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-ink-faint"
          >
            Assine aqui
          </span>
        )}
      </div>
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={empty}
          onClick={() => commit(strokes.current.slice(0, -1))}
        >
          <Undo2 />
          Desfazer traço
        </Button>
        <Button variant="ghost" size="sm" disabled={empty} onClick={() => commit([])}>
          <Eraser />
          Limpar
        </Button>
      </div>
    </div>
  )
}
