// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  ESPESSURA,
  decodificar,
  tracoParaSvg,
  type Ponto
} from '../../../../../web/contrato/assinatura/traco'
import { SignaturePad, type SignatureValue } from './SignaturePad'

class FakePath {
  constructor(readonly d: string) {}
}

class FakeResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    const entry = { target, contentRect: { width: 400, height: 160 } }
    this.callback([entry as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
  disconnect(): void {}
}

const context = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  stroke: vi.fn<(path: FakePath) => void>(),
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: ''
}
const themeListeners: (() => void)[] = []
const capture = vi.fn<(pointerId: number) => void>()

beforeEach(() => {
  vi.stubGlobal('Path2D', FakePath)
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('devicePixelRatio', 2)
  vi.stubGlobal('matchMedia', () => ({
    addEventListener: (_: string, listener: () => void) => themeListeners.push(listener),
    removeEventListener: () => {}
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 10, y: 20, width: 400, height: 160 })
  )
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: capture
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  context.stroke.mockClear()
  context.setTransform.mockClear()
  capture.mockClear()
  themeListeners.length = 0
})

const toScreen = ([x, y]: Ponto): { clientX: number; clientY: number } => ({
  clientX: 10 + x * 0.4,
  clientY: 20 + y * 0.4
})

function sign(points: Ponto[], init: PointerEventInit = {}): void {
  const canvas = screen.getByRole('img', { name: 'Quadro de assinatura' })
  const pointer = { pointerId: 1, pointerType: 'mouse', button: 0, ...init }
  const [first, ...rest] = points
  fireEvent.pointerDown(canvas, { ...pointer, ...toScreen(first) })
  for (const point of rest) fireEvent.pointerMove(canvas, { ...pointer, ...toScreen(point) })
  fireEvent.pointerUp(canvas, { ...pointer, ...toScreen(points.at(-1)!) })
}

function setup(): { onChange: ReturnType<typeof vi.fn<(value: SignatureValue) => void>> } {
  const onChange = vi.fn<(value: SignatureValue) => void>()
  render(<SignaturePad onChange={onChange} />)
  return { onChange }
}

const lastValue = (onChange: ReturnType<typeof vi.fn<(value: SignatureValue) => void>>) => {
  const { encoded, minimal } = onChange.mock.lastCall![0]
  return { strokes: decodificar(encoded), minimal }
}

describe('quadro de assinatura', () => {
  it('desenha com mouse, caneta e toque e entrega o traço codificado ao levantar', () => {
    const { onChange } = setup()
    const first: Ponto[] = [
      [100, 100],
      [300, 100],
      [500, 200]
    ]
    const second: Ponto[] = [
      [600, 300],
      [700, 150]
    ]
    const third: Ponto[] = [
      [800, 50],
      [900, 350]
    ]
    sign(first, { pointerType: 'pen' })
    expect(capture).toHaveBeenCalledWith(1)
    expect(lastValue(onChange)).toEqual({ strokes: [first], minimal: false })
    sign(second, { pointerType: 'touch', pointerId: 7 })
    sign(third)
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(lastValue(onChange).strokes).toEqual([first, second, third])
    expect(context.stroke.mock.lastCall![0].d).toBe(tracoParaSvg(third))
  })

  it('usa os pontos agrupados do movimento rápido, sem repetir o mesmo ponto', () => {
    const { onChange } = setup()
    const canvas = screen.getByRole('img', { name: 'Quadro de assinatura' })
    const pointer = { pointerId: 1, button: 0 }
    fireEvent.pointerDown(canvas, { ...pointer, ...toScreen([100, 100]) })
    const move = new PointerEvent('pointermove', { ...pointer, bubbles: true })
    const points: Ponto[] = [
      [100, 100],
      [200, 300],
      [400, 100]
    ]
    const grouped = points.map(
      (point) => new PointerEvent('pointermove', { ...pointer, ...toScreen(point) })
    )
    Object.defineProperty(move, 'getCoalescedEvents', { value: () => grouped })
    fireEvent(canvas, move)
    fireEvent.pointerUp(canvas, { ...pointer, ...toScreen([400, 100]) })
    expect(lastValue(onChange).strokes).toEqual([
      [
        [100, 100],
        [200, 300],
        [400, 100]
      ]
    ])
  })

  it('assinatura mínima: um ponto ou um risco curto', () => {
    const { onChange } = setup()
    sign([[500, 200]])
    expect(lastValue(onChange)).toEqual({ strokes: [[[500, 200]]], minimal: true })
    sign([
      [100, 100],
      [110, 100]
    ])
    expect(lastValue(onChange).minimal).toBe(true)
    sign([
      [200, 100],
      [215, 100]
    ])
    expect(lastValue(onChange).minimal).toBe(false)
  })

  it('“Desfazer traço” tira o último e “Limpar” tira todos', () => {
    const { onChange } = setup()
    const undo = screen.getByRole('button', { name: 'Desfazer traço' }) as HTMLButtonElement
    const clear = screen.getByRole('button', { name: 'Limpar' }) as HTMLButtonElement
    expect(undo.disabled && clear.disabled).toBe(true)
    expect(screen.getByText('Assine aqui')).toBeTruthy()
    const first: Ponto[] = [
      [100, 100],
      [300, 300]
    ]
    sign(first)
    sign([
      [400, 100],
      [600, 300]
    ])
    expect(screen.queryByText('Assine aqui')).toBeNull()
    fireEvent.click(undo)
    expect(lastValue(onChange)).toEqual({ strokes: [first], minimal: false })
    sign([
      [700, 100],
      [900, 300]
    ])
    fireEvent.click(clear)
    expect(lastValue(onChange)).toEqual({ strokes: [], minimal: true })
    expect([...onChange.mock.lastCall![0].encoded]).toEqual([0])
    expect(undo.disabled && clear.disabled).toBe(true)
    expect(screen.getByText('Assine aqui')).toBeTruthy()
  })

  it('ignora o botão direito e um segundo dedo durante o traço', () => {
    const { onChange } = setup()
    const canvas = screen.getByRole('img', { name: 'Quadro de assinatura' })
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 2, ...toScreen([100, 100]) })
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 2, ...toScreen([100, 100]) })
    expect(onChange).not.toHaveBeenCalled()

    const finger = { pointerId: 3, pointerType: 'touch', button: 0 }
    const palm = { pointerId: 4, pointerType: 'touch', button: 0 }
    fireEvent.pointerDown(canvas, { ...finger, ...toScreen([100, 100]) })
    fireEvent.pointerDown(canvas, { ...palm, ...toScreen([800, 300]) })
    fireEvent.pointerMove(canvas, { ...palm, ...toScreen([900, 350]) })
    fireEvent.pointerMove(canvas, { ...finger, ...toScreen([300, 200]) })
    fireEvent.pointerUp(canvas, { ...palm, ...toScreen([900, 350]) })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerCancel(canvas, { ...finger, ...toScreen([300, 200]) })
    expect(lastValue(onChange).strokes).toEqual([
      [
        [100, 100],
        [300, 200]
      ]
    ])
  })

  it('escala o quadro pelo devicePixelRatio e redesenha quando o tema muda', () => {
    setup()
    const canvas = screen.getByRole('img', { name: 'Quadro de assinatura' }) as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([800, 320])
    expect(context.setTransform).toHaveBeenLastCalledWith(0.8, 0, 0, 0.8, 0, 0)
    expect(context.lineWidth).toBe(ESPESSURA)
    const stroke: Ponto[] = [
      [100, 100],
      [300, 300]
    ]
    sign(stroke)
    context.stroke.mockClear()
    act(() => themeListeners.forEach((listener) => listener()))
    expect(context.stroke.mock.calls.map(([path]) => path.d)).toEqual([
      tracoParaSvg(stroke),
      tracoParaSvg(stroke)
    ])
  })
})
