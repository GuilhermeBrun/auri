import { describe, expect, it } from 'vite-plus/test'
import { arrangeSidebar, canHide, describeSidebar, isDefaultSidebar, visibleItems } from './sidebar'

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

  it('só deixa ocultar se sobrar um item que não some com a recepção ou o WhatsApp', () => {
    const itens = arrangeSidebar({ order: [], hidden: ['agenda', 'pacientes'] })
    const item = (id: string) => itens.find((i) => i.id === id)!
    expect(canHide(itens, item('clinica'))).toBe(true)
    expect(canHide(itens, item('financeiro'))).toBe(false)
    const soClinica = arrangeSidebar({ order: [], hidden: ['agenda', 'pacientes', 'financeiro'] })
    expect(
      canHide(
        soClinica,
        soClinica.find((i) => i.id === 'clinica')!
      )
    ).toBe(false)
  })

  it('sem nenhum item visível, mostra o primeiro que nunca some', () => {
    const disponiveis = arrangeSidebar({
      order: ['whatsapp', 'financeiro'],
      hidden: ['whatsapp', 'agenda', 'pacientes', 'financeiro']
    }).filter((item) => item.id !== 'clinica')
    expect(visibleItems(disponiveis).map((item) => item.id)).toEqual(['financeiro'])
    const comClinica = arrangeSidebar({ order: [], hidden: ['agenda'] })
    expect(visibleItems(comClinica).map((item) => item.id)).toEqual([
      'pacientes',
      'financeiro',
      'clinica',
      'whatsapp'
    ])
  })

  it('reconhece o padrão mesmo com a ordem escrita por extenso', () => {
    expect(isDefaultSidebar({ order: [], hidden: [] })).toBe(true)
    expect(isDefaultSidebar({ order: ['agenda', 'pacientes'], hidden: ['velho'] })).toBe(true)
    expect(isDefaultSidebar({ order: ['pacientes'], hidden: [] })).toBe(false)
    expect(isDefaultSidebar({ order: [], hidden: ['agenda'] })).toBe(false)
  })
})
