declare module 'brittle' {
  interface Teste {
    is(atual: unknown, esperado: unknown): void
    ok(valor: unknown): void
    alike(atual: unknown, esperado: unknown): void
    pass(): void
  }

  export default function test(nome: string, corpo: (t: Teste) => Promise<void> | void): void
}
