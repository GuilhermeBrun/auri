export const TAMANHO_DA_CHAVE = 32
const TAMANHO_DO_IV = 12
const TAMANHO_DA_ETIQUETA = 16

export function novaChave(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(TAMANHO_DA_CHAVE))
}

function importar(chave: Uint8Array, uso: KeyUsage): Promise<CryptoKey> {
  if (chave.length !== TAMANHO_DA_CHAVE) throw new RangeError('A chave tem 32 bytes')
  return crypto.subtle.importKey('raw', new Uint8Array(chave), 'AES-GCM', false, [uso])
}

const algoritmo = (iv: Uint8Array<ArrayBuffer>, dadoAdicional: string): AesGcmParams => ({
  name: 'AES-GCM',
  iv,
  additionalData: new TextEncoder().encode(dadoAdicional),
  tagLength: TAMANHO_DA_ETIQUETA * 8
})

export async function cifrar(
  chave: Uint8Array,
  dadoAdicional: string,
  dados: Uint8Array
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(TAMANHO_DO_IV))
  const cifrado = await crypto.subtle.encrypt(
    algoritmo(iv, dadoAdicional),
    await importar(chave, 'encrypt'),
    new Uint8Array(dados)
  )
  const pacote = new Uint8Array(TAMANHO_DO_IV + cifrado.byteLength)
  pacote.set(iv)
  pacote.set(new Uint8Array(cifrado), TAMANHO_DO_IV)
  return pacote
}

export async function decifrar(
  chave: Uint8Array,
  dadoAdicional: string,
  pacote: Uint8Array
): Promise<Uint8Array<ArrayBuffer>> {
  if (pacote.length < TAMANHO_DO_IV + TAMANHO_DA_ETIQUETA) throw new RangeError('Pacote curto')
  const decifrado = await crypto.subtle.decrypt(
    algoritmo(pacote.slice(0, TAMANHO_DO_IV), dadoAdicional),
    await importar(chave, 'decrypt'),
    pacote.slice(TAMANHO_DO_IV)
  )
  return new Uint8Array(decifrado)
}

export async function sha256(dados: Uint8Array | string): Promise<string> {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados)
  const resumo = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(resumo, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
