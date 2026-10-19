import {
  cpfValido,
  nomeCompleto,
  type Papel,
  type Resposta,
  type Termo
} from '../../contrato/assinatura/formato'
import { assinaturaMinima, type Ponto } from '../../contrato/assinatura/traco'

export type Preenchido = {
  nome: string
  cpf: string
  rel: Papel
  aceite: boolean
  tracos: Ponto[][]
}

export const preenchidoVazio = (termo: Termo): Preenchido => ({
  nome: '',
  cpf: '',
  rel: termo.resp.papel,
  aceite: false,
  tracos: []
})

export const soDigitos = (texto: string): string => texto.replace(/\D/g, '')

export function mascaraDoCpf(digitos: string): string {
  const d = soDigitos(digitos).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function telefone(whats: string): string {
  const brasil = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(whats)
  return brasil ? `(${brasil[1]}) ${brasil[2]}-${brasil[3]}` : `+${whats}`
}

const dois = (numero: number): string => String(numero).padStart(2, '0')

export function diaEMes(segundos: number): string {
  const data = new Date(segundos * 1000)
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}`
}

export function dataDeNascimento(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const RESPONSAVEL_LEGAL = 'Responsável legal'

export function parentesco(termo: Termo, rel: Papel): string | undefined {
  if (rel !== 'outro') return undefined
  return termo.resp.papel === 'outro' && termo.resp.par ? termo.resp.par : RESPONSAVEL_LEGAL
}

export function opcoesDePapel(termo: Termo): { papel: Papel; rotulo: string }[] {
  const outro =
    termo.resp.papel === 'outro' && termo.resp.par
      ? `${termo.resp.par}, responsável legal`
      : termo.resp.papel === 'paciente'
        ? 'Responsável legal (curador)'
        : 'Responsável legal (tutor ou guardião)'
  return [
    ...(termo.resp.papel === 'paciente'
      ? [{ papel: 'paciente' as const, rotulo: 'Você, paciente' }]
      : []),
    { papel: 'mae', rotulo: 'Mãe' },
    { papel: 'pai', rotulo: 'Pai' },
    { papel: 'outro', rotulo: outro }
  ]
}

const QUEM: Record<Exclude<Papel, 'paciente'>, string> = {
  mae: 'a mãe',
  pai: 'o pai',
  outro: 'responsável legal'
}

export function declaracao(termo: Termo, rel: Papel): string {
  const aceite =
    'aceito esta assinatura eletrônica, feita com meu nome, CPF e assinatura desenhada.'
  if (rel === 'paciente') return `Li o termo e concordo. Sou ${termo.pac.nome} e ${aceite}`
  return `Li o termo e concordo. Declaro ser ${QUEM[rel]} de ${termo.pac.nome} e ${aceite}`
}

export const nomeLimpo = (nome: string): string => nome.trim().replace(/\s+/g, ' ')

export function faltas(preenchido: Preenchido): string[] {
  const lista: string[] = []
  if (!nomeCompleto(preenchido.nome)) lista.push('nome completo')
  if (!cpfValido(preenchido.cpf)) lista.push('CPF')
  if (!preenchido.aceite) lista.push('marcar o aceite')
  if (assinaturaMinima(preenchido.tracos)) lista.push('assinar')
  return lista
}

export function textoDeFaltas(lista: string[]): string {
  if (lista.length === 0) return ''
  const ultima = lista.at(-1)
  const juntas = lista.length === 1 ? ultima : `${lista.slice(0, -1).join(', ')} e ${ultima}`
  return `Falta ${juntas}.`
}

export function resposta(termo: Termo, h: string, preenchido: Preenchido, agora: Date): Resposta {
  const par = parentesco(termo, preenchido.rel)
  return {
    id: termo.id,
    h,
    nome: nomeLimpo(preenchido.nome),
    cpf: preenchido.cpf,
    rel: preenchido.rel,
    ...(par ? { par } : {}),
    ok: true,
    em: Math.floor(agora.getTime() / 1000),
    tz: -agora.getTimezoneOffset()
  }
}

export const mensagemDaVolta = (termo: Termo, link: string): string =>
  `Termo assinado: ${termo.mod.titulo} · ${termo.pac.nome}\n${link}`

export const linkDoWhatsApp = (whats: string, texto?: string): string =>
  `https://wa.me/${whats}${texto === undefined ? '' : `?text=${encodeURIComponent(texto)}`}`
