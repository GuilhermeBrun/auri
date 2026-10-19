import { differenceInYears } from 'date-fns'
import { isIsoDate, parseIsoDate } from './dates'
import type { ContatoPrincipal, Parentesco, PatientFields } from './schemas'

export const MAIORIDADE = 18

export type Papel = 'paciente' | 'mae' | 'pai' | 'outro'

export type Pessoa = {
  papel: Papel
  nome: string
  parentesco: string
  cpf: string
  celular: string
  email: string
}

export type Responsavel = { pessoa: Pessoa; motivo: null } | { pessoa: null; motivo: string }

export const PARENTESCO_LABEL: Record<Parentesco, string> = {
  avo_f: 'Avó',
  avo_m: 'Avô',
  tia: 'Tia',
  tio: 'Tio',
  outro: 'Outro'
}

type Ficha = Pick<
  PatientFields,
  | 'nome'
  | 'data_nascimento'
  | 'cpf'
  | 'celular'
  | 'email'
  | 'mae_nome'
  | 'mae_cpf'
  | 'mae_celular'
  | 'mae_email'
  | 'pai_nome'
  | 'pai_cpf'
  | 'pai_celular'
  | 'pai_email'
  | 'resp_tipo'
  | 'resp_nome'
  | 'resp_parentesco'
  | 'resp_parentesco_outro'
  | 'resp_cpf'
  | 'resp_celular'
  | 'resp_email'
>

type FichaComContato = Ficha & Pick<PatientFields, 'contato_principal'>

export function isAdult(nascimento: string, today: Date = new Date()): boolean {
  if (!isIsoDate(nascimento)) return false
  return differenceInYears(today, parseIsoDate(nascimento)) >= MAIORIDADE
}

function parentescoOutro(p: Ficha): string {
  if (p.resp_parentesco === 'outro') return p.resp_parentesco_outro.trim() || 'Outro'
  return p.resp_parentesco === '' ? 'Responsável' : PARENTESCO_LABEL[p.resp_parentesco]
}

export function pessoasDaFicha(p: Ficha, today: Date = new Date()): Pessoa[] {
  const pessoas: Pessoa[] = []
  if (p.mae_nome.trim())
    pessoas.push({
      papel: 'mae',
      nome: p.mae_nome.trim(),
      parentesco: 'Mãe',
      cpf: p.mae_cpf,
      celular: p.mae_celular,
      email: p.mae_email
    })
  if (p.pai_nome.trim())
    pessoas.push({
      papel: 'pai',
      nome: p.pai_nome.trim(),
      parentesco: 'Pai',
      cpf: p.pai_cpf,
      celular: p.pai_celular,
      email: p.pai_email
    })
  if (p.resp_tipo === 'outro' && p.resp_nome.trim())
    pessoas.push({
      papel: 'outro',
      nome: p.resp_nome.trim(),
      parentesco: parentescoOutro(p),
      cpf: p.resp_cpf,
      celular: p.resp_celular,
      email: p.resp_email
    })
  const paciente: Pessoa = {
    papel: 'paciente',
    nome: p.nome.trim(),
    parentesco: 'Próprio paciente',
    cpf: p.cpf,
    celular: p.celular,
    email: p.email
  }
  return isAdult(p.data_nascimento, today) ? [paciente, ...pessoas] : [...pessoas, paciente]
}

export function responsavelDe(p: Ficha, today: Date = new Date()): Responsavel {
  const pessoas = pessoasDaFicha(p, today)
  const find = (papel: Papel): Pessoa | undefined => pessoas.find((x) => x.papel === papel)
  if (isAdult(p.data_nascimento, today)) return { pessoa: find('paciente')!, motivo: null }
  const tipo = p.resp_tipo || (p.mae_nome.trim() ? 'mae' : p.pai_nome.trim() ? 'pai' : '')
  const pessoa = tipo === '' ? undefined : find(tipo)
  if (pessoa) return { pessoa, motivo: null }
  return {
    pessoa: null,
    motivo:
      tipo === ''
        ? 'Cadastre a mãe, o pai ou outro responsável na ficha.'
        : 'Preencha o nome do responsável na ficha.'
  }
}

const PAPEL_DO_CONTATO: Record<ContatoPrincipal, Papel> = {
  mae: 'mae',
  pai: 'pai',
  responsavel: 'outro',
  paciente: 'paciente'
}

export const CONTATO_DO_PAPEL: Record<Papel, ContatoPrincipal> = {
  mae: 'mae',
  pai: 'pai',
  outro: 'responsavel',
  paciente: 'paciente'
}

export function contatoPrincipal(p: FichaComContato, today: Date = new Date()): Pessoa | null {
  const pessoas = pessoasDaFicha(p, today)
  if (p.contato_principal !== '') {
    const papel = PAPEL_DO_CONTATO[p.contato_principal]
    const escolhida = pessoas.find((x) => x.papel === papel)
    if (escolhida) return escolhida
  }
  return (
    responsavelDe(p, today).pessoa ??
    pessoas.find((x) => x.papel !== 'paciente' || x.celular !== '') ??
    null
  )
}
