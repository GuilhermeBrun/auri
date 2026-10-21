import type postgres from 'postgres'
import { z } from 'zod'
import contrato from '../contrato/link-curto.json' with { type: 'json' }
import { connect, Rejected, type Env } from './erros.ts'

const ID_NO_SERVIDOR = new RegExp(`^[\\w-]{${contrato.tamanhoDoId}}$`)
const DADOS_GUARDADOS = new RegExp(`^[\\w.-]{1,${contrato.maximoGuardado}}$`)
const MAXIMO_DO_CORPO = contrato.maximoGuardado + 200

export type Guardar = (id: string, dados: string, expira: Date) => Promise<void>
export type Buscar = (id: string, agora: Date) => Promise<string | null>
export type Links = { guardar: Guardar; buscar: Buscar }

const corpoSchema = z.object({
  dados: z.string().regex(DADOS_GUARDADOS),
  expira: z.int().min(0)
})

const SEM_CACHE = { 'cache-control': 'no-store' }

const status = (code: number, headers: Record<string, string> = {}): Response =>
  new Response(null, { status: code, headers: { ...SEM_CACHE, ...headers } })

function setting(name: string, env?: Env): string | undefined {
  const node = (globalThis as { process?: { env: Env } }).process?.env
  const value = env?.[name] ?? node?.[name]
  return typeof value === 'string' && value ? value : undefined
}

async function lerCorpo(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > MAXIMO_DO_CORPO) return null
  const texto = await request.text()
  return texto.length > MAXIMO_DO_CORPO ? null : texto
}

export async function atender(
  request: Request,
  links: Links,
  agora = new Date()
): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!ID_NO_SERVIDOR.test(id)) return status(400)

  if (request.method === 'GET') {
    try {
      const dados = await links.buscar(id, agora)
      if (dados === null) return status(404)
      return new Response(dados, {
        status: 200,
        headers: { ...SEM_CACHE, 'content-type': 'text/plain; charset=utf-8' }
      })
    } catch (error) {
      console.error(`[links] não leu: ${(error as Error).message}`)
      return status(503)
    }
  }

  if (request.method !== 'PUT') return status(405, { allow: 'GET, PUT' })
  const bruto = await lerCorpo(request)
  if (bruto === null) return status(413)
  let json: unknown
  try {
    json = JSON.parse(bruto)
  } catch {
    return status(400)
  }
  const corpo = corpoSchema.safeParse(json)
  if (!corpo.success) return status(400)
  const agoraS = Math.floor(agora.getTime() / 1000)
  if (corpo.data.expira <= agoraS || corpo.data.expira > agoraS + contrato.vidaMaximaS)
    return status(400)
  try {
    await links.guardar(id, corpo.data.dados, new Date(corpo.data.expira * 1000))
  } catch (error) {
    console.error(`[links] não gravou: ${(error as Error).message}`)
    return status(error instanceof Rejected ? 400 : 503)
  }
  return status(204)
}

export function linksEm(sql: postgres.Sql): Links {
  return {
    async guardar(id, dados, expira) {
      try {
        await sql`
          INSERT INTO links (id, dados, expira_em) VALUES (${id}, ${dados}, ${expira})
          ON CONFLICT DO NOTHING
        `
      } catch (error) {
        const { code } = error as { code?: unknown }
        if (typeof code === 'string' && /^2[23]/.test(code))
          throw new Rejected((error as Error).message, { cause: error })
        throw error
      }
    },
    async buscar(id, agora) {
      const [linha] = await sql<{ dados: string }[]>`
        SELECT dados FROM links WHERE id = ${id} AND expira_em > ${agora}
      `
      return linha?.dados ?? null
    }
  }
}

let links: Links | null = null

export default {
  async fetch(request: Request, env?: Env): Promise<Response> {
    const url = setting('DATABASE_URL', env)
    if (!url) return status(503)
    try {
      links ??= linksEm(
        connect(
          url,
          { max: Number(setting('DATABASE_POOL', env) ?? 1), idle_timeout: 20, prepare: false },
          env
        )
      )
    } catch (error) {
      console.error(`[links] não conectou: ${(error as Error).message}`)
      return status(503)
    }
    return atender(request, links)
  }
}
