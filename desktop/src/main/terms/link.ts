import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { deBase64url, paraBase64url } from '../../../../web/contrato/assinatura/base64url'
import { TAMANHO_DA_CHAVE } from '../../../../web/contrato/assinatura/cifra'
import { MAXIMO_DESCOMPRIMIDO } from '../../../../web/contrato/assinatura/compressao'
import {
  DADO_DA_IDA,
  LIMITE_IDA,
  LinkInvalido,
  LinkLongo,
  ORIGEM,
  VERSAO,
  dadoDaVolta,
  idDaVolta,
  lerCorpoDaVolta,
  partes,
  tamanhoNoSite,
  termoValido,
  type Termo,
  type Volta
} from '../../../../web/contrato/assinatura/formato'

const IV = 12
const ETIQUETA = 16
const TAMANHO_DO_ID = 16

export function novaChave(): Buffer {
  return randomBytes(TAMANHO_DA_CHAVE)
}

export function novoEnvio(): string {
  return paraBase64url(randomBytes(TAMANHO_DO_ID))
}

export function sha256(texto: string | Uint8Array): string {
  return createHash('sha256').update(texto).digest('hex')
}

export function cifrar(chave: Uint8Array, dadoAdicional: string, dados: Uint8Array): Buffer {
  const iv = randomBytes(IV)
  const cifra = createCipheriv('aes-256-gcm', chave, iv, { authTagLength: ETIQUETA })
  cifra.setAAD(Buffer.from(dadoAdicional))
  const corpo = Buffer.concat([cifra.update(dados), cifra.final()])
  return Buffer.concat([iv, corpo, cifra.getAuthTag()])
}

export function decifrar(chave: Uint8Array, dadoAdicional: string, pacote: Uint8Array): Buffer {
  if (pacote.length < IV + ETIQUETA) throw new RangeError('Pacote curto')
  const decifra = createDecipheriv('aes-256-gcm', chave, pacote.subarray(0, IV), {
    authTagLength: ETIQUETA
  })
  decifra.setAAD(Buffer.from(dadoAdicional))
  decifra.setAuthTag(pacote.subarray(pacote.length - ETIQUETA))
  return Buffer.concat([
    decifra.update(pacote.subarray(IV, pacote.length - ETIQUETA)),
    decifra.final()
  ])
}

export function abrirPacote(chave: Uint8Array, dadoAdicional: string, dados: string): Uint8Array {
  const corpo = inflateRawSync(decifrar(chave, dadoAdicional, deBase64url(dados)), {
    maxOutputLength: MAXIMO_DESCOMPRIMIDO
  })
  return new Uint8Array(corpo)
}

export function montarIda(termo: Termo, chave: Uint8Array, limite: number = LIMITE_IDA): string {
  const json = Buffer.from(JSON.stringify(termoValido(termo)))
  const dados = cifrar(chave, DADO_DA_IDA, deflateRawSync(json))
  const fragmento = `${VERSAO}.${paraBase64url(chave)}.${paraBase64url(dados)}`
  const tamanho = tamanhoNoSite('assinar', fragmento)
  if (tamanho > limite) throw new LinkLongo(tamanho, limite)
  return `${ORIGEM}/assinar#${fragmento}`
}

export function lerVolta(fragmento: string, chave: Uint8Array): Volta {
  const id = idDaVolta(fragmento)
  const [, dados] = partes(fragmento)
  try {
    return lerCorpoDaVolta(abrirPacote(chave, dadoDaVolta(id), dados), id)
  } catch (erro) {
    throw new LinkInvalido('incompleto', { cause: erro })
  }
}
