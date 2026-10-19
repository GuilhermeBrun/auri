import { describe, expect, it } from 'vite-plus/test'
import { FUNCIONAMENTO_PADRAO } from '../shared/agenda'
import {
  buildSettingsFile,
  describeChanges,
  parseSettingsFile,
  type SettingsSnapshot
} from './settings-transfer'

const { 6: _, ...SEM_SABADO } = FUNCIONAMENTO_PADRAO

const RECEPCAO: SettingsSnapshot = {
  appearance: { theme: 'dark', sidebarOpen: true },
  connection: {
    role: 'server',
    name: 'Recepção',
    sharing: true,
    keepRunning: true,
    openAtLogin: true,
    remoteAccess: false
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
    funcionamento: FUNCIONAMENTO_PADRAO
  },
  termModels: [
    { titulo: 'Contrato', texto: '# Contrato\n\nTexto.' },
    { titulo: 'Uso de imagem', texto: '# Uso de imagem\n\nTexto.' }
  ]
}

const NOVO: SettingsSnapshot = {
  appearance: { theme: 'system', sidebarOpen: true },
  connection: {
    role: 'server',
    name: 'DESKTOP-4F2K',
    sharing: false,
    keepRunning: true,
    openAtLogin: true,
    remoteAccess: true
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
    funcionamento: SEM_SABADO
  },
  termModels: [{ titulo: 'contrato', texto: 'Outro texto.' }]
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
      { label: 'Modelo de termo “Uso de imagem”', from: 'Não tem', to: 'Novo' }
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
      parseSettingsFile(JSON.stringify({ app: 'auri', kind: 'configuracoes', format: 2 }))
    ).toThrow('versão mais nova')
  })
})
