import { describe, expect, it } from 'vite-plus/test'
import { formatSize, storedText } from './backup-size'

describe('tamanho das cópias', () => {
  it('mostra KB, MB e GB com vírgula', () => {
    expect(formatSize(48_000)).toBe('48 KB')
    expect(formatSize(6_700_000)).toBe('6,7 MB')
    expect(formatSize(84_400_000)).toBe('84 MB')
    expect(formatSize(1_350_000_000)).toBe('1,4 GB')
  })

  it('junta quantidade e espaço numa linha só', () => {
    expect(storedText({ count: 1, bytes: 6_700_000 })).toBe('1 cópia · 6,7 MB')
    expect(storedText({ count: 24, bytes: 160_000_000 })).toBe('24 cópias · 160 MB')
  })
})
