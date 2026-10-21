import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { hexParaHsv, hsvParaHex, type Hsv } from '@renderer/lib/cor'
import { cn } from '@renderer/lib/utils'

const limitar = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

const PASSO = (e: KeyboardEvent): number => (e.shiftKey ? 10 : 1)

const RODA = 152
const ANEL = 14
const LADO = Math.floor((RODA / 2 - ANEL - 6) * Math.SQRT2)

export function RodaDeCor({
  value,
  onChange
}: {
  value: string
  onChange: (cor: string) => void
}): React.JSX.Element {
  const [hsv, setHsv] = useState(() => hexParaHsv(value))
  const [origem, setOrigem] = useState(value)
  if (value !== origem) {
    setOrigem(value)
    if (hsvParaHex(hsv) !== value) setHsv(hexParaHsv(value))
  }

  const mudar = (next: Hsv): void => {
    setHsv(next)
    const hex = hsvParaHex(next)
    setOrigem(hex)
    onChange(hex)
  }

  const pelaRoda = (e: PointerEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    mudar({ ...hsv, h: Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360) })
  }

  const peloQuadro = (e: PointerEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    mudar({
      ...hsv,
      s: Math.round(limitar((e.clientX - r.left) / r.width, 0, 1) * 100),
      v: Math.round((1 - limitar((e.clientY - r.top) / r.height, 0, 1)) * 100)
    })
  }

  const arrastar = (mover: (e: PointerEvent<HTMLDivElement>) => void) => ({
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus()
      mover(e)
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) mover(e)
    }
  })

  const teclaDaRoda = (e: KeyboardEvent): void => {
    const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (delta !== undefined) mudar({ ...hsv, h: (hsv.h + delta * PASSO(e) + 360) % 360 })
    else if (e.key === 'Home') mudar({ ...hsv, h: 0 })
    else if (e.key === 'End') mudar({ ...hsv, h: 359 })
    else return
    e.preventDefault()
  }

  const teclaDoQuadro = (e: KeyboardEvent): void => {
    const p = PASSO(e)
    if (e.key === 'ArrowRight') mudar({ ...hsv, s: limitar(hsv.s + p, 0, 100) })
    else if (e.key === 'ArrowLeft') mudar({ ...hsv, s: limitar(hsv.s - p, 0, 100) })
    else if (e.key === 'ArrowUp') mudar({ ...hsv, v: limitar(hsv.v + p, 0, 100) })
    else if (e.key === 'ArrowDown') mudar({ ...hsv, v: limitar(hsv.v - p, 0, 100) })
    else return
    e.preventDefault()
  }

  const angulo = (hsv.h * Math.PI) / 180
  const raio = RODA / 2 - ANEL / 2
  const foco =
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
  const polegar =
    'pointer-events-none absolute size-3.5 -translate-1/2 rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_rgb(0_0_0/0.35)]'

  return (
    <div className="relative shrink-0" style={{ width: RODA, height: RODA }}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Matiz"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={hsv.h}
        aria-valuetext={`${hsv.h} graus`}
        onKeyDown={teclaDaRoda}
        {...arrastar(pelaRoda)}
        className={cn('absolute inset-0 touch-none rounded-full', foco)}
        style={{
          background: 'conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          mask: `radial-gradient(circle, transparent ${RODA / 2 - ANEL - 0.5}px, #000 ${RODA / 2 - ANEL}px)`
        }}
      />
      <span
        aria-hidden="true"
        className={polegar}
        style={{
          left: RODA / 2 + Math.sin(angulo) * raio,
          top: RODA / 2 - Math.cos(angulo) * raio,
          backgroundColor: `hsl(${hsv.h} 100% 50%)`
        }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Saturação e brilho"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hsv.s}
        aria-valuetext={`Saturação ${hsv.s}%, brilho ${hsv.v}%`}
        onKeyDown={teclaDoQuadro}
        {...arrastar(peloQuadro)}
        className={cn('absolute touch-none rounded-[4px]', foco)}
        style={{
          width: LADO,
          height: LADO,
          left: (RODA - LADO) / 2,
          top: (RODA - LADO) / 2,
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`
        }}
      >
        <span
          aria-hidden="true"
          className={polegar}
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: hsvParaHex(hsv)
          }}
        />
      </div>
    </div>
  )
}
