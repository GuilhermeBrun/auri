import { DIAS_DA_SEMANA_NOMES, type DiaSemana } from '../shared/agenda'
import { isoToBrDate } from '../shared/dates'
import { formatCpf, formatPhone } from '../shared/masks'
import { contatoPrincipal, responsavelDe } from '../shared/responsavel'
import type { Patient, PatientDocument, PatientField } from '../shared/schemas'
import { formatSerie } from '../shared/serie'
import {
  birthLabel,
  documentHeader,
  documentHtml,
  documentStyle,
  esc,
  fileName,
  generatedAt
} from './document'

type Campo = { rotulo: string; valor: (p: Patient, now: Date) => string; largo?: boolean }

type Secao = { titulo: string; campos: Campo[] }

const campo = (
  rotulo: string,
  field: PatientField,
  formato: (value: string) => string = (value) => value,
  largo?: boolean
): Campo => ({ rotulo, valor: (p) => (p[field] ? formato(p[field]) : ''), largo })

const pessoa = (prefixo: 'mae' | 'pai', nome: string): Campo[] => [
  campo(nome, `${prefixo}_nome`, undefined, true),
  campo('Celular', `${prefixo}_celular`, formatPhone),
  campo('E-mail', `${prefixo}_email`),
  campo('CPF', `${prefixo}_cpf`, formatCpf),
  campo('RG', `${prefixo}_rg`),
  campo('Profissão', `${prefixo}_profissao`)
]

const outro = (rotulo: string, field: PatientField, formato?: (value: string) => string): Campo => {
  const base = campo(rotulo, field, formato)
  return { rotulo, valor: (p, now) => (p.resp_tipo === 'outro' ? base.valor(p, now) : '') }
}

export const FICHA: Secao[] = [
  {
    titulo: 'Paciente',
    campos: [
      campo('Nome', 'nome', undefined, true),
      {
        rotulo: 'Data de nascimento',
        valor: (p, now) => (p.data_nascimento ? birthLabel(p.data_nascimento, now) : '')
      },
      campo('CPF', 'cpf', formatCpf),
      campo('RG', 'rg'),
      campo('Celular', 'celular', formatPhone),
      campo('E-mail', 'email')
    ]
  },
  {
    titulo: 'Escola',
    campos: [
      campo('Escola', 'escola'),
      { rotulo: 'Série', valor: (p) => formatSerie(p) },
      campo('Professora', 'professora')
    ]
  },
  { titulo: 'Mãe', campos: pessoa('mae', 'Nome da mãe') },
  { titulo: 'Pai', campos: pessoa('pai', 'Nome do pai') },
  {
    titulo: 'Responsável',
    campos: [
      { rotulo: 'Nome', valor: (p, now) => responsavelDe(p, now).pessoa?.nome ?? '' },
      { rotulo: 'Parentesco', valor: (p, now) => responsavelDe(p, now).pessoa?.parentesco ?? '' },
      outro('CPF', 'resp_cpf', formatCpf),
      outro('RG', 'resp_rg'),
      outro('Celular', 'resp_celular', formatPhone),
      outro('E-mail', 'resp_email'),
      {
        rotulo: 'Contato principal',
        valor: (p, now) => {
          const contato = contatoPrincipal(p, now)
          if (!contato) return ''
          const celular = contato.celular ? ` · ${formatPhone(contato.celular)}` : ''
          return `${contato.nome} (${contato.parentesco})${celular}`
        },
        largo: true
      }
    ]
  },
  {
    titulo: 'Endereço',
    campos: [
      campo('Rua e número', 'endereco', undefined, true),
      campo('Bairro', 'bairro'),
      campo('Cidade', 'cidade'),
      campo('UF', 'uf')
    ]
  },
  {
    titulo: 'Atividades',
    campos: [
      {
        rotulo: 'Atividades extracurriculares',
        valor: (p) =>
          p.atividades
            .map(
              (a) =>
                `${a.atividade}, ${DIAS_DA_SEMANA_NOMES[a.dia_semana as DiaSemana].toLowerCase()} ${a.inicio}–${a.fim}`
            )
            .join('; '),
        largo: true
      }
    ]
  },
  {
    titulo: 'Outros',
    campos: [
      campo('Indicação', 'indicacao'),
      campo('Pediatra', 'pediatra'),
      campo('Data de entrada', 'data_entrada', isoToBrDate),
      campo('Observações', 'observacoes', undefined, true)
    ]
  }
]

export function patientName({ patient }: PatientDocument): string {
  return fileName('Ficha', patient.nome)
}

function secao(s: Secao, p: Patient, now: Date): string {
  const campos = s.campos
    .map((c) => ({ ...c, texto: c.valor(p, now).trim() }))
    .filter((c) => c.texto)
  if (campos.length === 0) return ''
  return `<section><h2>${esc(s.titulo)}</h2><dl>${campos
    .map(
      (c) =>
        `<div${c.largo ? ' class="wide"' : ''}><dt>${esc(c.rotulo)}</dt><dd>${esc(c.texto)}</dd></div>`
    )
    .join('')}</dl></section>`
}

const STYLE = (font: string): string => `${documentStyle(font, {
  margin: '16mm 18mm 18mm',
  fontSize: '10pt',
  lineHeight: 1.45
})}
header{margin-bottom:6px}
section{display:grid;grid-template-columns:34mm 1fr;gap:16px;margin-top:22px;break-inside:avoid}
h2{font-size:10.5pt;font-weight:600;margin:0}
dl{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 16px;margin:0}
dl .wide{grid-column:1/-1}
dt{font-size:7.5pt;color:#77777f}
dd{margin:1px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
`

export function patientHtml(doc: PatientDocument, options: { font: string; now?: Date }): string {
  const { clinic, patient } = doc
  const now = options.now ?? new Date()
  const entrada = isoToBrDate(patient.data_entrada)

  return documentHtml(
    `Ficha · ${patient.nome}`,
    STYLE(options.font),
    `${documentHeader(clinic, {
      titulo: 'Ficha do paciente',
      subtitulo: entrada ? `Entrada em ${entrada}` : ''
    })}
<main>${FICHA.map((s) => secao(s, patient, now)).join('\n')}</main>
<p class="note">${generatedAt(now)}</p>`
  )
}
