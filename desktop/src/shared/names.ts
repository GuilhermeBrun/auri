const PARTICLES = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])

export function shortName(fullName: string): string {
  const kept: string[] = []
  for (const part of fullName.trim().split(/\s+/)) {
    if (part === '' || (kept.length > 0 && PARTICLES.has(part.toLowerCase()))) continue
    kept.push(part)
    if (kept.length === 2) break
  }
  return kept.join(' ')
}
