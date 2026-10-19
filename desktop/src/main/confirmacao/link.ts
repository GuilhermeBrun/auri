import { deflateRawSync } from 'node:zlib'
import { paraBase64url } from '../../../../web/contrato/assinatura/base64url'
import { LinkInvalido, ORIGEM } from '../../../../web/contrato/assinatura/formato'
import {
  DADO_DA_IDA,
  LIMITE_IDA,
  VERSAO,
  confirmacaoValida,
  dadoDaVolta,
  idDaVolta,
  lerJson,
  linkDaIda,
  partes,
  respostaDoEnvio,
  type Confirmacao,
  type Resposta
} from '../../../../web/contrato/confirmacao/formato'
import { abrirPacote, cifrar } from '../terms/link'

export function montarIda(
  confirmacao: Confirmacao,
  chave: Uint8Array,
  limite: number = LIMITE_IDA
): string {
  const json = Buffer.from(JSON.stringify(confirmacaoValida(confirmacao)))
  const dados = cifrar(chave, DADO_DA_IDA, deflateRawSync(json))
  return linkDaIda(`${VERSAO}.${paraBase64url(chave)}.${paraBase64url(dados)}`, ORIGEM, limite)
}

export function lerVolta(fragmento: string, chave: Uint8Array): Resposta {
  const id = idDaVolta(fragmento)
  const [, dados] = partes(fragmento)
  try {
    return respostaDoEnvio(lerJson(abrirPacote(chave, dadoDaVolta(id), dados)), id)
  } catch (erro) {
    throw new LinkInvalido('incompleto', { cause: erro })
  }
}
