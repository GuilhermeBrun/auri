import { describe, expect, it } from 'vite-plus/test'
import { tamanhoDaJanela } from './window-size'

describe('tamanho da janela', () => {
  it('usa o tamanho padrão quando a tela comporta', () => {
    expect(tamanhoDaJanela({ width: 1920, height: 1040 })).toEqual({
      width: 1280,
      height: 820,
      minWidth: 1000,
      minHeight: 640
    })
  })

  it('cabe na área útil de um notebook com escala de 125%', () => {
    expect(tamanhoDaJanela({ width: 1092.8, height: 582.4 })).toEqual({
      width: 1092,
      height: 582,
      minWidth: 1000,
      minHeight: 582
    })
  })
})
