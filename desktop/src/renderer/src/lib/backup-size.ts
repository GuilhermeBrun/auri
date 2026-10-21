export const SPACE_WARNING_BYTES = 2_000_000_000

export function formatSize(bytes: number): string {
  const [value, unit] =
    bytes >= 1e9 ? [bytes / 1e9, 'GB'] : bytes >= 1e6 ? [bytes / 1e6, 'MB'] : [bytes / 1e3, 'KB']
  const digits = value < 10 && unit !== 'KB' ? 1 : 0
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits })} ${unit}`
}

export function storedText(stored: { count: number; bytes: number }): string {
  const copies = stored.count === 1 ? '1 cópia' : `${stored.count} cópias`
  return `${copies} · ${formatSize(stored.bytes)}`
}
