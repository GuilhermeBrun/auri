export function logoDataUrl(base64: string): string {
  const type = base64.startsWith('/9j/') ? 'jpeg' : 'png'
  return `data:image/${type};base64,${base64}`
}
