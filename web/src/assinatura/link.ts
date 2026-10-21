import {
  LinkSumiu,
  SemConexao,
  codigoDoFragmento,
  encurtarVolta,
  expandirIda,
  type Buscar
} from '../../contrato/link-curto'

export type Rede = { origem?: string; buscar?: Buscar }

const origemDaPagina = (): string => globalThis.location?.origin ?? 'https://auri.dev.br'

const ESPERA_DA_VOLTA_MS = 1500

export type Expandido = { fragmento: string } | { falha: 'sumiu' | 'sem-conexao' }

export async function expandir(fragmento: string, rede: Rede = {}): Promise<Expandido> {
  const codigo = codigoDoFragmento(fragmento)
  if (!codigo) return { fragmento }
  try {
    return {
      fragmento: await expandirIda(codigo, {
        origem: rede.origem ?? origemDaPagina(),
        buscar: rede.buscar
      })
    }
  } catch (erro) {
    if (erro instanceof SemConexao) return { falha: 'sem-conexao' }
    if (erro instanceof LinkSumiu) return { falha: 'sumiu' }
    throw erro
  }
}

export async function voltaCurta(longo: string, rede: Rede = {}): Promise<string> {
  try {
    return await encurtarVolta(longo, Date.now(), {
      origem: rede.origem ?? origemDaPagina(),
      buscar: rede.buscar,
      esperaMs: ESPERA_DA_VOLTA_MS
    })
  } catch {
    return longo
  }
}
