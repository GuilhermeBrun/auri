import { isoToBrDate } from './dates'

export const CAMPOS = [
  ['paciente', 'Nome do paciente'],
  ['nascimento', 'Nascimento do paciente'],
  ['clinica', 'Nome da clínica'],
  ['profissional', 'Profissional responsável'],
  ['registro', 'Registro do profissional'],
  ['data', 'Data do envio']
] as const

export type Campo = (typeof CAMPOS)[number][0]

export type ValoresDosCampos = Record<Campo, string>

export function valoresDosCampos({
  paciente,
  nascimento,
  clinica,
  profissional,
  registro,
  data
}: {
  paciente: string
  nascimento: string
  clinica: string
  profissional: string
  registro: string
  data: string
}): ValoresDosCampos {
  return {
    paciente,
    nascimento: isoToBrDate(nascimento),
    clinica,
    profissional,
    registro,
    data: isoToBrDate(data)
  }
}

export function preencher(texto: string, valores: ValoresDosCampos): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, campo: string) =>
    Object.hasOwn(valores, campo) ? valores[campo as Campo] : inteiro
  )
}

export function numeroDoWhatsApp(celular: string): string {
  const digitos = celular.replace(/\D/g, '')
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos
}

export function mensagemDaIda({
  destino,
  titulo,
  paciente,
  clinica,
  link
}: {
  destino: string
  titulo: string
  paciente: string
  clinica: string
  link: string
}): string {
  const primeiro = destino.trim().split(/\s+/)[0]
  return `Olá, ${primeiro}! Para ler e assinar pelo celular: "${titulo}", de ${paciente} (${clinica}).\n${link}`
}
