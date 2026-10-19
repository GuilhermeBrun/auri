import { describe, expect, test } from 'vite-plus/test'
import { CPF_FICTICIO, assinaturaFicticia, termoFicticio } from '../../contrato/assinatura/ficticio'
import {
  dataDeNascimento,
  declaracao,
  diaEMes,
  faltas,
  linkDoWhatsApp,
  mascaraDoCpf,
  mensagemDaVolta,
  opcoesDePapel,
  parentesco,
  preenchidoVazio,
  resposta,
  telefone,
  textoDeFaltas,
  type Preenchido
} from './textos'

const preenchido = (mudancas: Partial<Preenchido> = {}): Preenchido => ({
  nome: 'Maria Fictícia de Souza',
  cpf: CPF_FICTICIO,
  rel: 'mae',
  aceite: true,
  tracos: assinaturaFicticia(),
  ...mudancas
})

describe('campos', () => {
  test('máscara do CPF enquanto digita', () => {
    expect(mascaraDoCpf('')).toBe('')
    expect(mascaraDoCpf('123')).toBe('123')
    expect(mascaraDoCpf('1234')).toBe('123.4')
    expect(mascaraDoCpf('1234567')).toBe('123.456.7')
    expect(mascaraDoCpf('1234567890')).toBe('123.456.789-0')
    expect(mascaraDoCpf('123.456.789-09 99')).toBe('123.456.789-09')
  })

  test('WhatsApp da clínica por extenso', () => {
    expect(telefone('5565999990000')).toBe('(65) 99999-0000')
    expect(telefone('556533330000')).toBe('(65) 3333-0000')
    expect(telefone('14155550100')).toBe('+14155550100')
  })

  test('datas no formato do Brasil', () => {
    expect(dataDeNascimento('2019-03-04')).toBe('04/03/2019')
    expect(diaEMes(new Date(2026, 9, 25, 23, 59).getTime() / 1000)).toBe('25/10')
  })
})

describe('quem assina', () => {
  test('menor com a mãe na ficha: mãe marcada, pai e responsável legal ao lado', () => {
    const termo = termoFicticio()
    expect(preenchidoVazio(termo).rel).toBe('mae')
    expect(opcoesDePapel(termo)).toEqual([
      { papel: 'mae', rotulo: 'Mãe' },
      { papel: 'pai', rotulo: 'Pai' },
      { papel: 'outro', rotulo: 'Responsável legal (tutor ou guardião)' }
    ])
    expect(parentesco(termo, 'outro')).toBe('Responsável legal')
    expect(parentesco(termo, 'mae')).toBeUndefined()
  })

  test('responsável de outro parentesco aparece com o parentesco da ficha', () => {
    const termo = termoFicticio({ resp: { papel: 'outro', par: 'Avó' } })
    expect(preenchidoVazio(termo).rel).toBe('outro')
    expect(opcoesDePapel(termo).at(-1)).toEqual({
      papel: 'outro',
      rotulo: 'Avó, responsável legal'
    })
    expect(parentesco(termo, 'outro')).toBe('Avó')
  })

  test('paciente maior de idade vê "Você, paciente" primeiro', () => {
    const termo = termoFicticio({ resp: { papel: 'paciente' } })
    expect(opcoesDePapel(termo).map(({ rotulo }) => rotulo)).toEqual([
      'Você, paciente',
      'Mãe',
      'Pai',
      'Responsável legal (curador)'
    ])
  })

  test('a declaração acompanha quem assina', () => {
    const termo = termoFicticio()
    expect(declaracao(termo, 'mae')).toContain('Declaro ser a mãe de Ana Beatriz Fictícia')
    expect(declaracao(termo, 'pai')).toContain('Declaro ser o pai de Ana Beatriz Fictícia')
    expect(declaracao(termo, 'outro')).toContain('responsável legal de Ana Beatriz Fictícia')
    expect(declaracao(termo, 'paciente')).toContain('Sou Ana Beatriz Fictícia')
  })
})

describe('o que falta para enviar', () => {
  test('tudo preenchido', () => {
    expect(faltas(preenchido())).toEqual([])
    expect(textoDeFaltas([])).toBe('')
  })

  test('lista o que falta, na ordem da página', () => {
    const vazio = preenchidoVazio(termoFicticio())
    expect(faltas(vazio)).toEqual(['nome completo', 'CPF', 'marcar o aceite', 'assinar'])
    expect(textoDeFaltas(faltas(vazio))).toBe(
      'Falta nome completo, CPF, marcar o aceite e assinar.'
    )
    expect(textoDeFaltas(['CPF'])).toBe('Falta CPF.')
  })

  test('assinatura mínima, CPF inválido e nome de uma palavra não passam', () => {
    expect(
      faltas(
        preenchido({
          tracos: [
            [
              [10, 10],
              [12, 10]
            ]
          ]
        })
      )
    ).toEqual(['assinar'])
    expect(faltas(preenchido({ cpf: '12345678900' }))).toEqual(['CPF'])
    expect(faltas(preenchido({ nome: 'Maria' }))).toEqual(['nome completo'])
  })
})

describe('resposta', () => {
  test('nome sem espaços sobrando, hora e fuso do aparelho', () => {
    const agora = new Date(Date.UTC(2026, 9, 19, 18, 32, 5))
    const termo = termoFicticio()
    const feita = resposta(
      termo,
      'a'.repeat(64),
      preenchido({ nome: '  Maria   Fictícia ' }),
      agora
    )
    expect(feita).toEqual({
      id: termo.id,
      h: 'a'.repeat(64),
      nome: 'Maria Fictícia',
      cpf: CPF_FICTICIO,
      rel: 'mae',
      ok: true,
      em: Math.floor(agora.getTime() / 1000),
      tz: 0 - agora.getTimezoneOffset()
    })
  })

  test('fuso de Greenwich sai como 0, que volta igual pelo JSON', () => {
    const agora = Object.assign(new Date(), { getTimezoneOffset: () => 0 })
    const { tz } = resposta(termoFicticio(), 'a'.repeat(64), preenchido(), agora)
    expect(Object.is(tz, 0)).toBe(true)
  })

  test('responsável de outro parentesco leva o parentesco', () => {
    const termo = termoFicticio({ resp: { papel: 'outro', par: 'Avó' } })
    expect(resposta(termo, 'a'.repeat(64), preenchido({ rel: 'outro' }), new Date())).toMatchObject(
      { rel: 'outro', par: 'Avó' }
    )
  })

  test('mensagem e link do WhatsApp com o texto codificado', () => {
    const termo = termoFicticio()
    const mensagem = mensagemDaVolta(termo, 'https://auri.dev.br/recebido#1.a.b')
    expect(mensagem).toBe(
      'Termo assinado: Termo de consentimento · Ana Beatriz Fictícia\nhttps://auri.dev.br/recebido#1.a.b'
    )
    const link = new URL(linkDoWhatsApp('5565999990000', mensagem))
    expect(link.origin + link.pathname).toBe('https://wa.me/5565999990000')
    expect(link.searchParams.get('text')).toBe(mensagem)
    expect(linkDoWhatsApp('5565999990000')).toBe('https://wa.me/5565999990000')
  })
})
