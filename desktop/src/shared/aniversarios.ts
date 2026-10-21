import { isIsoDate } from './dates'

export type Aniversariante = { id: number; nome: string; idade: number }

type ComNascimento = { id: number; nome: string; data_nascimento: string }

const bissexto = (ano: number): boolean => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0

export function idadeQueCompleta(nascimento: string, dia: Date): number | null {
  if (!isIsoDate(nascimento)) return null
  const [ano, mes, data] = nascimento.split('-').map(Number)
  const alvo = dia.getFullYear()
  const festa = mes === 2 && data === 29 && !bissexto(alvo) ? 28 : data
  if (dia.getMonth() + 1 !== mes || dia.getDate() !== festa) return null
  const idade = alvo - ano
  return idade >= 1 ? idade : null
}

export function aniversariantes(pacientes: ComNascimento[], dia: Date): Aniversariante[] {
  return pacientes
    .flatMap((p) => {
      const idade = idadeQueCompleta(p.data_nascimento, dia)
      return idade === null ? [] : [{ id: p.id, nome: p.nome, idade }]
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
