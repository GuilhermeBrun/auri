export type Hsv = { h: number; s: number; v: number }

export function hexParaHsv(hex: string): Hsv {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return {
    h: Math.round((h * 60 + 360) % 360),
    s: max === 0 ? 0 : Math.round((d / max) * 100),
    v: Math.round(max * 100)
  }
}

export function hsvParaHex({ h, s, v }: Hsv): string {
  const f = (k: number): number => {
    const x = (k + h / 60) % 6
    const c = (v / 100) * (1 - (s / 100) * Math.max(0, Math.min(x, 4 - x, 1)))
    return Math.round(c * 255)
  }
  return `#${[f(5), f(3), f(1)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
