import { describe, expect, it } from 'vitest'
import {
  buildSettingsFile,
  describeChanges,
  parseSettingsFile,
  type SettingsSnapshot
} from './settings-transfer'

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
  backup: { kind: 'google', frequency: 'daily', dailyTime: '19:00' }
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
  backup: { kind: null, frequency: 'daily', dailyTime: '19:00' }
}

describe('arquivo de configurações', () => {
  it('ida e volta, sem nenhum segredo no arquivo', () => {
    const text = buildSettingsFile(RECEPCAO, new Date('2026-10-13T22:00:00Z'))
    expect(text).not.toMatch(/key|senha|password|devices|recovery/i)
    const file = parseSettingsFile(text)
    expect(file.connection).toEqual(RECEPCAO.connection)
    expect(file.backup).toEqual({ kind: 'google', frequency: 'daily', dailyTime: '19:00' })
  })

  it('diz o que muda num computador novo, só o que é diferente', () => {
    const file = parseSettingsFile(buildSettingsFile(RECEPCAO))
    expect(describeChanges(NOVO, file)).toEqual([
      { label: 'Tema', from: 'Sistema', to: 'Escuro' },
      { label: 'Nome deste computador', from: 'DESKTOP-4F2K', to: 'Recepção' },
      { label: 'Compartilhar com outros computadores', from: 'Desligado', to: 'Ligado' },
      { label: 'Acesso de fora da clínica', from: 'Ligado', to: 'Desligado' },
      { label: 'Nuvem da cópia de segurança', from: 'Nenhuma', to: 'Google Drive' }
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
