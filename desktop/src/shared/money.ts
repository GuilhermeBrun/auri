export const CENTAVOS_MAX = 100_000_000_00

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatBRL(centavos: number): string {
  const abs = Math.abs(Math.trunc(centavos))
  const reais = groupThousands(String(Math.floor(abs / 100)))
  const cents = String(abs % 100).padStart(2, '0')
  return `${centavos < 0 ? '−' : ''}R$ ${reais},${cents}`
}

export function centavosToInput(centavos: number): string {
  if (centavos === 0) return ''
  return formatBRL(centavos).replace('R$ ', '')
}

export function maskBRL(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12)
  if (digits === '') return ''
  const padded = digits.padStart(3, '0')
  return `${groupThousands(padded.slice(0, -2))},${padded.slice(-2)}`
}

export function parseBRL(text: string): number | null {
  const clean = text.replace(/R\$|\s/g, '')
  if (clean === '') return null
  const m = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(clean)
  if (!m) return null
  const reais = Number(m[1].replace(/\./g, ''))
  const cents = Number((m[2] ?? '').padEnd(2, '0'))
  const total = reais * 100 + cents
  return total <= CENTAVOS_MAX ? total : null
}
