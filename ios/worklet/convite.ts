import { z } from 'zod'

export const VERSAO_DO_CONVITE = 1

const convite = z.object({
  v: z.literal(VERSAO_DO_CONVITE),
  k: z.string().regex(/^[0-9a-f]{64}$/),
  c: z.string().min(12).max(20),
  a: z
    .array(z.tuple([z.string().min(1).max(255), z.number().int().min(1).max(65535)]))
    .min(1)
    .max(8)
})

export type Convite = { chave: string; codigo: string; enderecos: { host: string; port: number }[] }

export function lerConvite(texto: string): Convite | null {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    return null
  }
  const lido = convite.safeParse(json)
  if (!lido.success) return null
  return {
    chave: lido.data.k,
    codigo: lido.data.c,
    enderecos: lido.data.a.map(([host, port]) => ({ host, port }))
  }
}

export function escreverConvite(dados: Convite): string {
  return JSON.stringify({
    v: VERSAO_DO_CONVITE,
    k: dados.chave,
    c: dados.codigo,
    a: dados.enderecos.map(({ host, port }) => [host, port])
  })
}
