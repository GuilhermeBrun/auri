import { deBase64url } from '../../../web/contrato/assinatura/base64url'
import { ALTURA, LARGURA, decodificar, tracoParaSvg } from '../../../web/contrato/assinatura/traco'

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c])
}

const pad = (n: number): string => String(n).padStart(2, '0')

export function signedAt(instante: string | number, fuso: number): { data: string; hora: string } {
  const ms = typeof instante === 'number' ? instante * 1000 : Date.parse(instante)
  const d = new Date(ms + fuso * 60_000)
  return {
    data: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    hora: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
}

export function utcLabel(fuso: number): string {
  const sinal = fuso < 0 ? '−' : '+'
  const total = Math.abs(fuso)
  const minutos = total % 60
  return `UTC${sinal}${Math.floor(total / 60)}${minutos ? `:${pad(minutos)}` : ''}`
}

export function signatureSvg(traco: string, className: string): string {
  let paths: string[]
  try {
    paths = decodificar(deBase64url(traco)).map(tracoParaSvg)
  } catch {
    paths = []
  }
  return `<svg class="${className}" viewBox="0 0 ${LARGURA} ${ALTURA}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${paths
    .map((d) => `<path d="${esc(d)}"/>`)
    .join('')}</svg>`
}

export function fontFace(font: string): string {
  return `@font-face{font-family:'Bricolage';src:url(data:font/woff2;base64,${font}) format('woff2-variations');font-weight:200 800}`
}

export const DOCUMENT_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">`
