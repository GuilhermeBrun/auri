export function assertUnchanged(current: string, expected: string | undefined): void {
  if (expected !== undefined && current !== expected) {
    throw new Error(
      'Isto foi alterado em outro computador enquanto estava aberto. Feche e abra de novo para ver as mudanças antes de salvar.'
    )
  }
}
