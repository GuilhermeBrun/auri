import { describe, expect, it } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO } from '../shared/agenda'
import {
  buildSettingsFile,
  describeChanges,
  parseSettingsFile,
  type SettingsSnapshot
} from './settings-transfer'

const TIPOS_SEMENTE: SettingsSnapshot['tipos'] = [
  { nome: 'Sessão', categoria: 'sessao', cor: '#6b7280', duracao: 30 },
  { nome: 'Avaliação', categoria: 'avaliacao', cor: '#2563eb', duracao: 60 },
  { nome: 'Exame', categoria: 'exame', cor: '#7c3aed', duracao: 60 }
]

const { 6: _, ...SEM_SABADO } = FUNCIONAMENTO_PADRAO

const RECEPCAO: SettingsSnapshot = {
  appearance: {
    theme: 'dark',
    sidebarOpen: true,
    sidebarItems: { order: ['pacientes', 'agenda'], hidden: ['whatsapp'] },
    textSize: 1.2,
    colors: { accent: '#bf5530', canvas: '#fbf6f2', overrides: { light: {}, dark: {} } }
  },
  connection: {
    role: 'server',
    name: 'Recepção',
    sharing: true,
    keepRunning: true,
    openAtLogin: true,
    remoteAccess: false,
    notices: true
  },
  backup: { kind: 'google', frequency: 'daily', dailyTime: '19:00' },
  clinic: {
    nome: 'Clínica Elo',
    documento: '12.345.678/0001-90',
    endereco: 'Rua das Flores, 10',
    telefone: '',
    whatsapp: '(65) 99999-1234',
    profissional: 'Ana Souza',
    registro: 'CRFa 1234',
    logo: 'iVBORw0KGgo=',
    margem_deslocamento: 30,
    funcionamento: FUNCIONAMENTO_PADRAO
  },
  termModels: [
    { titulo: 'Contrato', texto: '# Contrato\n\nTexto.' },
    { titulo: 'Uso de imagem', texto: '# Uso de imagem\n\nTexto.' }
  ],
  tipos: [
    ...TIPOS_SEMENTE,
    { nome: 'Audiometria', categoria: 'exame', cor: '#0ea5e9', duracao: 45 }
  ]
}

const NOVO: SettingsSnapshot = {
  appearance: {
    theme: 'system',
    sidebarOpen: true,
    sidebarItems: { order: [], hidden: [] },
    textSize: 1,
    colors: { accent: null, canvas: null, overrides: { light: {}, dark: {} } }
  },
  connection: {
    role: 'server',
    name: 'DESKTOP-4F2K',
    sharing: false,
    keepRunning: true,
    openAtLogin: true,
    remoteAccess: true,
    notices: true
  },
  backup: { kind: null, frequency: 'daily', dailyTime: '19:00' },
  clinic: {
    nome: '',
    documento: '',
    endereco: '',
    telefone: '(65) 3333-4444',
    whatsapp: '',
    profissional: '',
    registro: '',
    logo: '',
    margem_deslocamento: 30,
    funcionamento: SEM_SABADO
  },
  termModels: [{ titulo: 'contrato', texto: 'Outro texto.' }],
  tipos: TIPOS_SEMENTE
}

describe('arquivo de configurações', () => {
  it('ida e volta, sem nenhum segredo no arquivo', () => {
    const text = buildSettingsFile(RECEPCAO, new Date('2026-10-13T22:00:00Z'))
    expect(text).not.toMatch(/key|senha|password|devices|recovery/i)
    const file = parseSettingsFile(text)
    expect(file.connection).toEqual(RECEPCAO.connection)
    expect(file.backup).toEqual({ kind: 'google', frequency: 'daily', dailyTime: '19:00' })
    expect(file.clinic).toEqual({ ...RECEPCAO.clinic, telefone: undefined })
    expect(file.clinic).not.toHaveProperty('telefone')
    expect(file.termModels).toEqual(RECEPCAO.termModels)
    expect(file.clinic.funcionamento).toEqual(FUNCIONAMENTO_PADRAO)
  })

  it('leva a clínica fechada em todos os dias e recusa horário que fecha antes de abrir', () => {
    const fechada = { ...RECEPCAO, clinic: { ...RECEPCAO.clinic, funcionamento: {} } }
    const file = parseSettingsFile(buildSettingsFile(fechada))
    expect(file.clinic.funcionamento).toEqual({})
    expect(describeChanges(RECEPCAO, file)).toEqual([
      {
        label: 'Horário de funcionamento',
        from: 'seg a sex 07:00–20:00, sáb 07:00–12:00',
        to: 'Fechada todos os dias'
      }
    ])
    const invertido = JSON.parse(buildSettingsFile(RECEPCAO))
    invertido.clinic.funcionamento = { 1: { abre: '20:00', fecha: '07:00' } }
    expect(() => parseSettingsFile(JSON.stringify(invertido))).toThrow('não é de configurações')
  })

  it('diz o que muda num computador novo, só o que é diferente', () => {
    const file = parseSettingsFile(buildSettingsFile(RECEPCAO))
    expect(describeChanges(NOVO, file)).toEqual([
      { label: 'Tema', from: 'Sistema', to: 'Escuro' },
      {
        label: 'Itens da barra lateral',
        from: 'Agenda, Pacientes, Financeiro, Clínica, WhatsApp',
        to: 'Pacientes, Agenda, Financeiro, Clínica'
      },
      { label: 'Tamanho do texto', from: 'Padrão', to: 'Grande' },
      { label: 'Cores', from: 'Grafite', to: 'Terracota' },
      { label: 'Nome deste computador', from: 'DESKTOP-4F2K', to: 'Recepção' },
      { label: 'Compartilhar com outros computadores', from: 'Desligado', to: 'Ligado' },
      { label: 'Acesso de fora da clínica', from: 'Ligado', to: 'Desligado' },
      { label: 'Nuvem da cópia de segurança', from: 'Nenhuma', to: 'Google Drive' },
      { label: 'Nome da clínica', from: 'Vazio', to: 'Clínica Elo' },
      { label: 'CNPJ ou CPF da clínica', from: 'Vazio', to: '12.345.678/0001-90' },
      { label: 'Endereço da clínica', from: 'Vazio', to: 'Rua das Flores, 10' },
      { label: 'WhatsApp da clínica', from: 'Vazio', to: '(65) 99999-1234' },
      { label: 'Profissional responsável', from: 'Vazio', to: 'Ana Souza' },
      { label: 'Registro do profissional', from: 'Vazio', to: 'CRFa 1234' },
      {
        label: 'Horário de funcionamento',
        from: 'seg a sex 07:00–20:00',
        to: 'seg a sex 07:00–20:00, sáb 07:00–12:00'
      },
      { label: 'Logo da clínica', from: 'Sem logo', to: 'O do arquivo' },
      { label: 'Modelo de termo “Uso de imagem”', from: 'Não tem', to: 'Novo' },
      { label: 'Etiqueta “Audiometria”', from: 'Não tem', to: 'Nova (Exame, 45 min)' }
    ])
    expect(describeChanges(RECEPCAO, file)).toEqual([])
  })

  it('aceita arquivo com partes faltando (usa só o que veio)', () => {
    const file = parseSettingsFile(
      JSON.stringify({
        app: 'auri',
        kind: 'configuracoes',
        format: 1,
        exportedAt: '2026-10-13T22:00:00Z',
        appearance: { theme: 'light' }
      })
    )
    expect(describeChanges(NOVO, file)).toEqual([{ label: 'Tema', from: 'Sistema', to: 'Claro' }])
  })

  it('recusa outro arquivo e avisa quando é de versão mais nova', () => {
    expect(() => parseSettingsFile('isto não é json')).toThrow('não é de configurações do Auri')
    expect(() => parseSettingsFile(JSON.stringify({ app: 'outro' }))).toThrow(
      'não é de configurações do Auri'
    )
    expect(() =>
      parseSettingsFile(JSON.stringify({ app: 'auri', kind: 'configuracoes', format: 3 }))
    ).toThrow('versão mais nova')
  })

  it('lê o formato antigo, com cores por nome, e deixa as marcas de fora', () => {
    const file = parseSettingsFile(
      JSON.stringify({
        app: 'auri',
        kind: 'configuracoes',
        format: 1,
        exportedAt: '2026-10-13T22:00:00Z',
        tipos: [
          { nome: 'Sessão', categoria: 'sessao', cor: 'grafite', duracao: 30 },
          { nome: 'Audiometria', categoria: 'exame', cor: 'ardosia', duracao: 45 }
        ],
        etiquetas: [{ nome: 'Convênio', cor: 'azul' }]
      })
    )
    expect(file.tipos).toEqual([
      { nome: 'Sessão', categoria: 'sessao', cor: '#6b7280', duracao: 30 },
      { nome: 'Audiometria', categoria: 'exame', cor: '#0ea5e9', duracao: 45 }
    ])
    expect(describeChanges(NOVO, file).map((c) => c.label)).toEqual(['Etiqueta “Audiometria”'])
  })

  it('ignora as marcas de um arquivo da versão com a categoria Marca', () => {
    const antigo = JSON.parse(buildSettingsFile(RECEPCAO))
    antigo.tipos.push({ nome: 'Convênio', categoria: 'marca', cor: '#2563eb', duracao: null })
    const file = parseSettingsFile(JSON.stringify(antigo))
    expect(file.tipos).toEqual(RECEPCAO.tipos)
    expect(describeChanges(RECEPCAO, file)).toEqual([])
  })

  it('ignora as cores de Sessões e Gráficos de um arquivo de versão anterior', () => {
    const antigo = JSON.parse(buildSettingsFile(RECEPCAO))
    antigo.appearance.colors.overrides = {
      light: { session: '#dbeafe', ink: '#1a1a1a' },
      dark: { 'chart-strong': '#ffffff' }
    }
    const file = parseSettingsFile(JSON.stringify(antigo))
    expect(file.appearance.colors?.overrides).toEqual({ light: { ink: '#1a1a1a' }, dark: {} })
  })
})
