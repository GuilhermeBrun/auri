import { onlyDigits } from './masks'

function checkDigit(digits: string, length: number): number {
  let sum = 0
  for (let i = 0; i < length; i++) {
    sum += Number(digits[i]) * (length + 1 - i)
  }
  const rest = (sum * 10) % 11
  return rest === 10 ? 0 : rest
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11) return false
  // 000.000.000-00, 111.111.111-11... passam no cálculo mas não são CPFs válidos
  if (/^(\d)\1{10}$/.test(d)) return false
  return checkDigit(d, 9) === Number(d[9]) && checkDigit(d, 10) === Number(d[10])
}
