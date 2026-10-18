const PARTICLES = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])

/**
 * Nome curto para espaços apertados (sessões da agenda): os dois primeiros nomes, sem as partículas
 * "de", "da", "do"… ("Maria Eduarda Vasconcelos de Albuquerque" → "Maria Eduarda"). No Brasil os
 * primeiros nomes costumam ser compostos ("Pedro Henrique", "Davi Lucas") e é assim que a equipe
 * fala dos pacientes. O nome completo continua no balão e na ficha.
 */
export function shortName(fullName: string): string {
  const kept: string[] = []
  for (const part of fullName.trim().split(/\s+/)) {
    if (part === '' || (kept.length > 0 && PARTICLES.has(part.toLowerCase()))) continue
    kept.push(part)
    if (kept.length === 2) break
  }
  return kept.join(' ')
}
