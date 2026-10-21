import { describe, expect, it } from 'vite-plus/test'
import { arrangeSidebar, describeSidebar, isDefaultSidebar } from './sidebar'

const ids = (order: string[], hidden: string[] = []): string[] =>
  arrangeSidebar({ order, hidden }).map((item) => item.id)

describe('itens da barra lateral', () => {
  it('segue a ordem guardada e põe no fim, na ordem padrão, o que não estava nela', () => {
    expect(ids([])).toEqual(['agenda', 'pacientes', 'financeiro', 'clinica', 'whatsapp'])
    expect(ids(['financeiro', 'agenda'])).toEqual([
      'financeiro',
      'agenda',
      'pacientes',
      'clinica',
      'whatsapp'
    ])
  })

  it('ignora item que não existe mais e item repetido', () => {
    expect(ids(['relatorios', 'clinica', 'clinica', 'agenda'])).toEqual([
      'clinica',
      'agenda',
      'pacientes',
      'financeiro',
      'whatsapp'
    ])
  })

  it('marca os ocultos e descreve só os que aparecem', () => {
    const prefs = { order: ['pacientes'], hidden: ['whatsapp', 'clinica'] }
    expect(
      arrangeSidebar(prefs)
        .filter((item) => item.hidden)
        .map((item) => item.id)
    ).toEqual(['clinica', 'whatsapp'])
    expect(describeSidebar(prefs)).toBe('Pacientes, Agenda, Financeiro')
  })

  it('reconhece o padrão mesmo com a ordem escrita por extenso', () => {
    expect(isDefaultSidebar({ order: [], hidden: [] })).toBe(true)
    expect(isDefaultSidebar({ order: ['agenda', 'pacientes'], hidden: ['velho'] })).toBe(true)
    expect(isDefaultSidebar({ order: ['pacientes'], hidden: [] })).toBe(false)
    expect(isDefaultSidebar({ order: [], hidden: ['agenda'] })).toBe(false)
  })
})
