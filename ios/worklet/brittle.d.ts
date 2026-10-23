declare module 'brittle' {
  interface Teste {
    is(atual: unknown, esperado: unknown, mensagem?: string): void
    ok(valor: unknown, mensagem?: string): void
    alike(atual: unknown, esperado: unknown, mensagem?: string): void
    pass(): void
  }

  export default function test(nome: string, corpo: (t: Teste) => Promise<void> | void): void
}
