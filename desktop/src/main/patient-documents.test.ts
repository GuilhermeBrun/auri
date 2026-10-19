import { describe, expect, it } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO } from '../shared/agenda'
import {
  emptyAnamneseInput,
  emptyPatientInput,
  type Appointment,
  type Clinic,
  type Patient
} from '../shared/schemas'
import { anamneseHtml, anamneseName } from './anamnese-report'
import { evolutionReportHtml, evolutionReportName } from './evolution-report'
import { FICHA, patientHtml, patientName } from './patient-report'

const NOW = new Date(2026, 9, 31, 18, 0)

const clinic: Clinic = {
  nome: 'Clínica <b>Fictícia</b>',
  documento: '',
  endereco: 'Rua Inventada, 10',
  telefone: '',
  whatsapp: '',
  profissional: 'Lara Fictícia',
  registro: 'CRFa 0-0000',
  logo: '',
  margem_deslocamento: 30,
  funcionamento: FUNCIONAMENTO_PADRAO,
  updated_at: ''
}

const patient: Patient = {
  ...emptyPatientInput(),
  atividades: [],
  id: 7,
  nome: 'Helena <Fictícia>',
  data_nascimento: '2019-03-12',
  ativo: true,
  created_at: '',
  updated_at: ''
}

function sessao(inicio: string, extra: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    patient_id: 7,
    patient_nome: patient.nome,
    inicio,
    fim: inicio.replace(':00', ':45'),
    observacao: '',
    tipo_id: 1,
    tipo_nome: 'Sessão',
    tipo_cor: 'grafite',
    categoria: 'sessao',
    etiquetas: [],
    presenca: '',
    evolucao: 'Treino de /r/.',
    assinatura: null,
    confirmado_em: null,
    created_at: '',
    updated_at: '',
    ...extra
  }
}

const report = {
  clinic,
  patient: { id: 7, nome: patient.nome, data_nascimento: patient.data_nascimento },
  de: '2026-10-01',
  ate: '2026-10-31'
}

describe('relatório de evolução', () => {
  const html = evolutionReportHtml(
    {
      ...report,
      sessions: [
        sessao('2026-10-05T14:00', {
          presenca: 'falta',
          tipo_id: 2,
          tipo_nome: 'Avaliação',
          categoria: 'avaliacao',
          evolucao: 'Mãe disse: <script>alert(1)</script>\nSegunda linha'
        }),
        sessao('2026-10-19T14:00')
      ]
    },
    { font: '', now: NOW }
  )

  it('escapa o texto e mantém as quebras de linha', () => {
    expect(html).toContain('Clínica &lt;b&gt;Fictícia&lt;/b&gt;')
    expect(html).toContain('Helena &lt;Fictícia&gt;')
    expect(html).toContain('Mãe disse: &lt;script&gt;alert(1)&lt;/script&gt;\nSegunda linha')
    expect(html).not.toContain('<script>')
    expect(html).toContain("default-src 'none'")
  })

  it('período, data, horário, tipo e presença de cada sessão', () => {
    expect(html).toContain('<h1>Relatório de evolução</h1><p>Outubro de 2026</p>')
    expect(html).toContain('<p class="summary">2 evoluções</p>')
    expect(html).toContain('05/10/2026')
    expect(html).toContain('Segunda · 14:00–14:45')
    expect(html).toContain('<span class="soft">Avaliação · Faltou</span>')
    expect(html).toContain('<span class="soft">Sessão</span>')
    expect(html.indexOf('05/10/2026')).toBeLessThan(html.indexOf('19/10/2026'))
    expect(html).toContain('Gerado pelo Auri em 31/10/2026 às 18:00')
  })

  it('período sem evoluções', () => {
    const empty = evolutionReportHtml({ ...report, sessions: [] }, { font: '', now: NOW })
    expect(empty).toContain('Nenhuma evolução registrada neste período.')
    expect(empty).not.toContain('<article>')
  })

  it('nome do arquivo com o período', () => {
    expect(evolutionReportName({ ...report, sessions: [] })).toBe(
      'Evolução - Helena Fictícia - outubro de 2026.pdf'
    )
    expect(
      evolutionReportName({ ...report, de: '2026-03-02', ate: '2026-10-20', sessions: [] })
    ).toBe('Evolução - Helena Fictícia - 02-03-2026 a 20-10-2026.pdf')
  })
})

describe('anamnese impressa', () => {
  const anamnese = {
    ...emptyAnamneseInput(),
    patient_id: 7,
    updated_at: '',
    data: '2026-03-12',
    queixa: 'Troca o <r> pelo l',
    sono: 'Dorme às 21h\nAcorda uma vez',
    observacoes: '   '
  }
  const html = anamneseHtml({ clinic, patient, anamnese }, { font: '', now: NOW })

  it('só os temas preenchidos, na ordem da anamnese, com a data', () => {
    expect(html).toContain('<h1>Anamnese</h1><p>12/03/2026</p>')
    expect(html).toContain('<h2>Queixa</h2><p class="text">Troca o &lt;r&gt; pelo l</p>')
    expect(html).toContain('Dorme às 21h\nAcorda uma vez')
    expect(html.indexOf('Queixa')).toBeLessThan(html.indexOf('Sono'))
    expect(html).not.toContain('Gestação')
    expect(html).not.toContain('<h2>Observações</h2>')
    expect(html).toContain('12/03/2019 (7 anos)')
  })

  it('anamnese vazia e sem data', () => {
    const empty = anamneseHtml(
      { clinic, patient, anamnese: { ...anamnese, data: '', queixa: '', sono: '' } },
      { font: '', now: NOW }
    )
    expect(empty).toContain('Nenhum tema da anamnese foi preenchido.')
    expect(empty).toContain('<h1>Anamnese</h1></div>')
    expect(anamneseName({ clinic, patient, anamnese })).toBe('Anamnese - Helena Fictícia.pdf')
  })
})

describe('ficha impressa', () => {
  const full: Patient = {
    ...patient,
    cpf: '12345678909',
    celular: '65999991234',
    escola: 'Escola Inventada',
    mae_nome: 'Marina Fictícia',
    mae_cpf: '98765432100',
    mae_rg: '1234567 SSP/MT',
    resp_tipo: 'outro',
    resp_nome: 'Rosa Fictícia',
    resp_parentesco: 'avo_f',
    resp_celular: '6533334444',
    cidade: 'Sinop-MT',
    data_entrada: '2026-02-03',
    observacoes: 'Usa óculos\n<i>alergia</i>'
  }
  const html = patientHtml({ clinic, patient: full }, { font: '', now: NOW })

  it('dados completos, com CPF e RG por inteiro e texto escapado', () => {
    expect(html).toContain('<h1>Ficha do paciente</h1><p>Entrada em 03/02/2026</p>')
    expect(html).toContain('<dt>CPF</dt><dd>123.456.789-09</dd>')
    expect(html).toContain('<dt>Celular</dt><dd>(65) 99999-1234</dd>')
    expect(html).toContain('<dt>RG</dt><dd>1234567 SSP/MT</dd>')
    expect(html).toContain('<dt>Data de nascimento</dt><dd>12/03/2019 (7 anos e 7 meses)</dd>')
    expect(html).toContain('<dd>Usa óculos\n&lt;i&gt;alergia&lt;/i&gt;</dd>')
    expect(html).toContain('Helena &lt;Fictícia&gt;')
  })

  it('responsável escolhido na ficha', () => {
    expect(html).toMatch(/<h2>Responsável<\/h2><dl><div><dt>Nome<\/dt><dd>Rosa Fictícia<\/dd>/)
    expect(html).toContain('<dt>Parentesco</dt><dd>Avó</dd>')
    expect(html).toContain('<dt>Celular</dt><dd>(65) 3333-4444</dd>')
  })

  it('campos e seções vazios ficam de fora', () => {
    expect(html).not.toContain('<h2>Pai</h2>')
    expect(html).not.toContain('<dt>E-mail</dt>')
    expect(html).not.toContain('<dt>Professora</dt>')
    const minimal = patientHtml(
      { clinic, patient: { ...patient, data_nascimento: '' } },
      { font: '', now: NOW }
    )
    expect(minimal.match(/<section>/g)).toHaveLength(1)
    expect(minimal).toContain('<h1>Ficha do paciente</h1></div>')
    expect(minimal).not.toContain('Responsável')
  })

  it('mãe responsável aparece só com nome e parentesco', () => {
    const mae = patientHtml(
      { clinic, patient: { ...full, resp_tipo: 'mae' } },
      { font: '', now: NOW }
    )
    expect(mae).toContain('<h2>Responsável</h2><dl><div><dt>Nome</dt><dd>Marina Fictícia</dd>')
    expect(mae).not.toContain('(65) 3333-4444')
  })

  it('campos novos da ficha: RG, série, UF, contato principal e atividades', () => {
    const html = patientHtml(
      {
        clinic,
        patient: {
          ...patient,
          rg: '12.345.678-9',
          serie_numero: '3',
          serie_tipo: 'ano',
          serie_etapa: 'fundamental',
          cidade: 'Cuiabá',
          uf: 'MT',
          mae_nome: 'Marina Fictícia',
          mae_celular: '(65) 99999-0000',
          contato_principal: 'mae',
          atividades: [
            {
              id: 1,
              patient_id: 7,
              atividade: 'Natação',
              dia_semana: 2,
              inicio: '14:00',
              fim: '15:00'
            }
          ]
        }
      },
      { font: '', now: NOW }
    )
    expect(html).toContain('<dt>RG</dt><dd>12.345.678-9</dd>')
    expect(html).toContain('<dt>Série</dt><dd>3º ano do Fundamental</dd>')
    expect(html).toContain('<dt>UF</dt><dd>MT</dd>')
    expect(html).toContain('<dd>Marina Fictícia (Mãe) · (65) 99999-0000</dd>')
    expect(html).toContain('<dd>Natação, terça 14:00–15:00</dd>')
  })

  it('lista de campos e nome do arquivo', () => {
    expect(FICHA.map((s) => s.titulo)).toEqual([
      'Paciente',
      'Escola',
      'Mãe',
      'Pai',
      'Responsável',
      'Endereço',
      'Atividades',
      'Outros'
    ])
    expect(patientName({ clinic, patient })).toBe('Ficha - Helena Fictícia.pdf')
  })
})
