import { describe, expect, it } from 'vite-plus/test'
import {
  ATALHOS,
  escreverTecla,
  lerTecla,
  paraAcelerador,
  problemaDoAtalho,
  teclasDosAtalhos
} from './atalhos'

describe('atalhos de teclado', () => {
  it('lê e escreve a combinação sem perder nada', () => {
    const tecla = lerTecla('Ctrl+Shift+Meta+KeyK')!
    expect(tecla).toEqual({ ctrl: true, alt: false, shift: true, meta: true, code: 'KeyK' })
    expect(escreverTecla(tecla)).toBe('Ctrl+Shift+Meta+KeyK')
    expect(lerTecla('Hyper+KeyK')).toBeNull()
    expect(lerTecla('')).toBeNull()
  })

  it('usa o padrão de cada sistema e respeita a troca e o "sem atalho"', () => {
    const mac = teclasDosAtalhos('mac', { salvar: null, 'agenda-hoje': 'KeyH', voltar: 'lixo+X' })
    expect(escreverTecla(mac['barra-lateral']!)).toBe('Ctrl+Meta+KeyS')
    expect(mac.salvar).toBeNull()
    expect(escreverTecla(mac['agenda-hoje']!)).toBe('KeyH')
    expect(escreverTecla(mac.voltar!)).toBe('Meta+BracketLeft')
    expect(escreverTecla(teclasDosAtalhos('pc', {})['barra-lateral']!)).toBe('Ctrl+KeyB')
  })

  it('os padrões não brigam entre si em nenhum sistema', () => {
    for (const plataforma of ['mac', 'pc'] as const) {
      const teclas = teclasDosAtalhos(plataforma, {})
      for (const a of ATALHOS) {
        expect(problemaDoAtalho(a.id, teclas[a.id]!, plataforma, teclas)).toBeNull()
      }
    }
  })

  it('recusa atalho do sistema, tecla sozinha que já tem uso e combinação repetida', () => {
    const teclas = teclasDosAtalhos('mac', {})
    expect(problemaDoAtalho('salvar', lerTecla('Meta+KeyC')!, 'mac', teclas)).toEqual({
      tipo: 'reservada'
    })
    expect(problemaDoAtalho('agenda-hoje', lerTecla('Escape')!, 'mac', teclas)).toEqual({
      tipo: 'sozinha'
    })
    expect(problemaDoAtalho('ir-agenda', lerTecla('Meta+KeyK')!, 'mac', teclas)).toEqual({
      tipo: 'em-uso',
      nome: 'Buscar paciente'
    })
  })

  it('a mesma tecla pode valer em telas diferentes, mas não junto de um atalho geral', () => {
    const teclas = teclasDosAtalhos('mac', {})
    expect(problemaDoAtalho('paciente-novo', lerTecla('KeyT')!, 'mac', teclas)).toBeNull()
    expect(problemaDoAtalho('agenda-dia', lerTecla('KeyM')!, 'mac', teclas)).toEqual({
      tipo: 'em-uso',
      nome: 'Ver o mês'
    })
    expect(problemaDoAtalho('buscar-paciente', lerTecla('KeyN')!, 'mac', teclas)).toEqual({
      tipo: 'em-uso',
      nome: 'Novo agendamento'
    })
  })

  it('vira atalho do menu do Mac', () => {
    expect(paraAcelerador(lerTecla('Meta+Comma'))).toBe('Command+,')
    expect(paraAcelerador(lerTecla('Ctrl+Alt+Shift+Meta+ArrowLeft'))).toBe(
      'Control+Alt+Shift+Command+Left'
    )
    expect(paraAcelerador(lerTecla('Meta+IntlRo'))).toBeUndefined()
    expect(paraAcelerador(null)).toBeUndefined()
  })
})
