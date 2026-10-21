import { createHash, randomBytes } from 'node:crypto'
import { paraBase64url } from '../../../web/contrato/assinatura/base64url'
import { ORIGEM } from '../../../web/contrato/assinatura/formato'
import {
  LinkSumiu,
  SemConexao,
  buscarGuardado,
  ehCodigo,
  guardadoDaIda,
  guardar,
  partesDoLink,
  type Buscar
} from '../../../web/contrato/link-curto'
import contrato from '../../../web/contrato/link-curto.json'
import type { LinkCurto } from '../shared/link-curto'

export const novoCodigo = (): string => paraBase64url(randomBytes(16))

export const chaveDoCodigo = (codigo: string): Buffer =>
  createHash('sha256')
    .update(contrato.rotuloDaChave + codigo)
    .digest()

export function linkCurto(
  longo: string,
  codigo: string,
  ate: number,
  mensagem: (link: string) => string
): LinkCurto {
  const { inicio, fragmento } = partesDoLink(longo)
  const link = `${inicio}#${codigo}`
  return {
    link,
    mensagem: mensagem(link),
    codigo,
    dados: guardadoDaIda(fragmento),
    expira: ate + contrato.folgaDaIdaS
  }
}

const ESPERA_DO_ENVIO_MS = 3000
const LIDOS_NA_MEMORIA = 50

const VOLTA_CURTA =
  /(?:\/(?:recebido|resposta)\/?|auri:(?:\/\/)?(?:receber|confirmacao)\/?)#([\w-]{22})(?![\w-])/i

export function codigoDaVolta(texto: string): string | null {
  const achado = VOLTA_CURTA.exec(texto)?.[1] ?? texto.trim()
  return ehCodigo(achado) ? achado : null
}

export type LinksCurtos = {
  encurtar<T extends { link: string; mensagem: string; curto?: LinkCurto }>(
    envio: T
  ): Promise<Omit<T, 'curto'>>
  expandir(texto: string): Promise<string>
}

export function createLinksCurtos({
  buscar,
  origem = ORIGEM
}: {
  buscar: Buscar
  origem?: string
}): LinksCurtos {
  const lidos = new Map<string, string>()
  const lembrar = (codigo: string, dados: string): string => {
    lidos.set(codigo, dados)
    const [antigo] = lidos.keys()
    if (lidos.size > LIDOS_NA_MEMORIA && antigo !== undefined) lidos.delete(antigo)
    return dados
  }
  return {
    async encurtar(envio) {
      const { curto, ...resto } = envio
      if (!curto) return resto
      try {
        await guardar(curto.codigo, curto.dados, curto.expira, {
          origem,
          buscar,
          esperaMs: ESPERA_DO_ENVIO_MS
        })
        return { ...resto, link: curto.link, mensagem: curto.mensagem }
      } catch (erro) {
        console.warn(`[links] vai o link longo: ${(erro as Error).message}`)
        return resto
      }
    },

    async expandir(texto) {
      const codigo = codigoDaVolta(texto)
      if (!codigo) return texto
      const lido = lidos.get(codigo)
      if (lido !== undefined) return lido
      try {
        return lembrar(codigo, await buscarGuardado(codigo, { origem, buscar }))
      } catch (erro) {
        if (erro instanceof LinkSumiu)
          throw new Error(
            'Esta resposta não está mais no site: passou de 30 dias. Peça para responder de novo.',
            { cause: erro }
          )
        if (erro instanceof SemConexao)
          throw new Error(
            'Sem conexão com o site do Auri para buscar a resposta. Confira a internet e tente de novo.',
            { cause: erro }
          )
        throw erro
      }
    }
  }
}
