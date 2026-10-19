import { describe, expect, it, vi } from 'vite-plus/test'
import { criarCaixa, enderecoNosArgumentos, lerEndereco } from './protocol'

const respostaDoEndereco = (endereco: string): string | null => {
  const recebido = lerEndereco(endereco)
  return recebido?.tipo === 'termo' ? recebido.fragmento : null
}

const F = '1.AAECAwQFBgcICQoLDA0ODw.abc-_123'

describe('endereço auri://', () => {
  it('aceita o dado depois de #, ?r= ou /', () => {
    expect(respostaDoEndereco(`auri://receber#${F}`)).toBe(F)
    expect(respostaDoEndereco(`auri://receber?r=${F}`)).toBe(F)
    expect(respostaDoEndereco(`auri://receber/${F}`)).toBe(F)
    expect(respostaDoEndereco(`auri://receber/#${F}`)).toBe(F)
    expect(respostaDoEndereco(`AURI://receber/${F}/`)).toBe(F)
  })

  it('recusa outro caminho, dado estranho e endereço longo demais', () => {
    expect(respostaDoEndereco(`auri://abrir#${F}`)).toBeNull()
    expect(respostaDoEndereco('auri://receber#<script>')).toBeNull()
    expect(respostaDoEndereco(`auri://receber#${F}&x=1`)).toBeNull()
    expect(respostaDoEndereco(`auri://receber#1.a.${'b'.repeat(9000)}`)).toBeNull()
    expect(respostaDoEndereco(`https://auri.dev.br/recebido#${F}`)).toBeNull()
  })

  it('acha o endereço nos argumentos do Windows', () => {
    expect(enderecoNosArgumentos(['C:\\Auri.exe', '--x', `auri://receber#${F}`])).toBe(
      `auri://receber#${F}`
    )
    expect(enderecoNosArgumentos(['C:\\Auri.exe'])).toBeNull()
  })

  it('guarda na fila até a tela retirar, sem repetir', () => {
    const avisar = vi.fn()
    const caixa = criarCaixa(avisar)
    expect(caixa.receber(`auri://receber#${F}`)).toBe(true)
    expect(caixa.receber(`auri://receber/${F}`)).toBe(true)
    expect(caixa.receber('auri://outro')).toBe(false)
    expect(avisar).toHaveBeenCalledTimes(2)
    expect(caixa.retirar()).toEqual([F])
    expect(caixa.retirar()).toEqual([])
  })

  it('confirmação de sessão vai para outra fila, com as mesmas formas', () => {
    for (const endereco of [
      `auri://confirmacao#${F}`,
      `auri://confirmacao?r=${F}`,
      `auri://confirmacao/${F}`,
      `AURI://Confirmacao/#${F}/`
    ]) {
      expect(lerEndereco(endereco)).toEqual({ tipo: 'confirmacao', fragmento: F })
    }
    expect(lerEndereco(`auri://confirmar#${F}`)).toBeNull()
    expect(lerEndereco(`auri://confirmacao#${F}&x=1`)).toBeNull()
    expect(lerEndereco(`https://auri.dev.br/resposta#${F}`)).toBeNull()

    const avisar = vi.fn()
    const caixa = criarCaixa(avisar)
    expect(caixa.receber(`auri://confirmacao#${F}`)).toBe(true)
    expect(caixa.receber(`auri://confirmacao/${F}`)).toBe(true)
    expect(avisar).toHaveBeenCalledTimes(2)
    expect(avisar).toHaveBeenLastCalledWith('confirmacao')
    expect(caixa.retirar()).toEqual([])
    expect(caixa.retirarConfirmacoes()).toEqual([F])
    expect(caixa.retirarConfirmacoes()).toEqual([])
  })
})
