export function paraBase64url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function deBase64url(texto: string): Uint8Array {
  const invalido = new SyntaxError('base64url inválido')
  if (!/^[\w-]*$/.test(texto) || texto.length % 4 === 1) throw invalido
  const binario = atob(texto.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0))
  if (paraBase64url(bytes) !== texto) throw invalido
  return bytes
}
