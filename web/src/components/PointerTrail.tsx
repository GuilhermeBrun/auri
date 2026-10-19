import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/dom'

const GRID = 22
const RADIUS = 110

export function PointerTrail() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || prefersReducedMotion()) return
    const glow = new Map<number, number>()
    let frame = 0
    let color = ''

    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.round(canvas.clientWidth * ratio)
      canvas.height = Math.round(canvas.clientHeight * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    function draw() {
      if (!canvas || !context) return
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      context.fillStyle = color
      for (const [key, value] of glow) {
        const next = value * 0.955
        if (next < 0.02) {
          glow.delete(key)
          continue
        }
        glow.set(key, next)
        const column = key & 0xffff
        const row = key >>> 16
        context.globalAlpha = Math.min(next, 1)
        context.beginPath()
        context.arc(column * GRID + GRID / 2, row * GRID + GRID / 2, 1 + next * 0.9, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
      frame = glow.size > 0 ? requestAnimationFrame(draw) : 0
    }

    function move(event: PointerEvent) {
      if (!canvas || event.pointerType !== 'mouse') return
      const box = canvas.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = event.clientY - box.top
      if (y < -RADIUS || y > box.height + RADIUS) return
      if (!frame)
        color = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()
      const reach = Math.ceil(RADIUS / GRID)
      const centerColumn = Math.floor(x / GRID)
      const centerRow = Math.floor(y / GRID)
      for (let row = centerRow - reach; row <= centerRow + reach; row++) {
        for (let column = centerColumn - reach; column <= centerColumn + reach; column++) {
          if (row < 0 || column < 0) continue
          const distance = Math.hypot(column * GRID + GRID / 2 - x, row * GRID + GRID / 2 - y)
          if (distance > RADIUS) continue
          const key = (row << 16) | column
          const value = (1 - distance / RADIUS) ** 1.2
          if (value > (glow.get(key) ?? 0)) glow.set(key, value)
        }
      }
      if (!frame) frame = requestAnimationFrame(draw)
    }

    resize()
    addEventListener('resize', resize)
    addEventListener('pointermove', move)
    return () => {
      removeEventListener('resize', resize)
      removeEventListener('pointermove', move)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={ref} className="pointer-trail" aria-hidden="true" data-pointer-trail="" />
}
