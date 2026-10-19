import { describe, expect, test } from 'vite-plus/test'
import { deBase64url, paraBase64url } from './base64url'
import { cifrar, novaChave, sha256 } from './cifra'
import { comprimir } from './compressao'
import {
  CPF_FICTICIO,
  ID_FICTICIO,
  TEXTO_FICTICIO,
  assinaturaFicticia,
  termoFicticio
} from './ficticio'
import {
  LIMITE_IDA,
  LIMITE_VOLTA,
  LinkInvalido,
  LinkLongo,
  cpfValido,
  fragmentoDaVolta,
  idDaVolta,
  lerIda,
  lerVolta,
  montarIda,
  montarVolta,
  nomeCompleto,
  novoId,
  venceu,
  type Resposta
} from './formato'
import { codificar, decodificar, simplificar } from './traco'

const fragmento = (link: string): string => link.slice(link.indexOf('#') + 1)

function trocarCaractere(texto: string, posicao: number): string {
  const trocado = texto[posicao] === 'A' ? 'B' : 'A'
  return texto.slice(0, posicao) + trocado + texto.slice(posicao + 1)
}

async function motivo(promessa: Promise<unknown>): Promise<string> {
  const erro = await promessa.then(
    () => null,
    (falha: unknown) => falha
  )
  expect(erro).toBeInstanceOf(LinkInvalido)
  return (erro as LinkInvalido).motivo
}

const respostaFicticia = async (mudancas: Partial<Resposta> = {}): Promise<Resposta> => ({
  id: ID_FICTICIO,
  h: await sha256(TEXTO_FICTICIO),
  nome: 'Maria Fictícia de Souza',
  cpf: CPF_FICTICIO,
  rel: 'mae',
  ok: true,
  em: Math.floor(Date.UTC(2026, 9, 19, 18, 32) / 1000),
  tz: -240,
  ...mudancas
})

describe('link de ida', () => {
  test('leva versão, chave e termo cifrado no fragmento', async () => {
    const chave = novaChave()
    const link = await montarIda(termoFicticio(), chave)
    const [versao, chaveTexto, dados] = fragmento(link).split('.')
    expect(link.startsWith('https://auri.dev.br/assinar#1.')).toBe(true)
    expect(versao).toBe('1')
    expect(chaveTexto).toBe(paraBase64url(chave))
    expect(chaveTexto).toHaveLength(43)
    expect(dados).toMatch(/^[\w-]+$/)
    expect(link).not.toContain('Fictícia')
  })

  test('ida e volta, com ou sem o #', async () => {
    const chave = novaChave()
    const link = await montarIda(termoFicticio(), chave)
    for (const lido of [fragmento(link), `#${fragmento(link)}`]) {
      const ida = await lerIda(lido)
      expect(ida.termo).toEqual(termoFicticio())
      expect(ida.chave).toEqual(chave)
    }
  })

  test('o termo de 6 seções cabe com folga no limite', async () => {
    const link = await montarIda(termoFicticio(), novaChave())
    expect(TEXTO_FICTICIO.length).toBeGreaterThan(1500)
    expect(link.length).toBeLessThan(TEXTO_FICTICIO.length)
    expect(link.length).toBeLessThan(LIMITE_IDA / 2)
  })

  test('responsável de outro parentesco leva o parentesco; os outros papéis, não', async () => {
    const chave = novaChave()
    const avo = termoFicticio({ resp: { papel: 'outro', par: 'Avó' } })
    expect((await lerIda(fragmento(await montarIda(avo, chave)))).termo.resp).toEqual({
      papel: 'outro',
      par: 'Avó'
    })
    const mae = termoFicticio({ resp: { papel: 'mae', par: 'Mãe' } })
    expect((await lerIda(fragmento(await montarIda(mae, chave)))).termo.resp).toEqual({
      papel: 'mae'
    })
  })

  test('não leva campos que o formato não conhece', async () => {
    const termo = { ...termoFicticio(), cpf: CPF_FICTICIO } as ReturnType<typeof termoFicticio>
    const link = await montarIda(termo, novaChave())
    expect((await lerIda(fragmento(link))).termo).not.toHaveProperty('cpf')
  })

  test('recusa montar termo incompleto', async () => {
    const chave = novaChave()
    const casos = [
      termoFicticio({ id: 'curto' }),
      termoFicticio({ cli: { nome: 'Clínica Exemplo', whats: '(65) 99999-0000' } }),
      termoFicticio({ pac: { nome: ' ', nasc: '2019-03-04' } }),
      termoFicticio({ pac: { nome: 'Ana', nasc: '04/03/2019' } }),
      termoFicticio({ resp: { papel: 'outro' } }),
      termoFicticio({ mod: { titulo: 'Termo', versao: 0 } }),
      termoFicticio({ txt: '\n\n  \n' }),
      termoFicticio({ ate: 1.5 })
    ]
    for (const termo of casos) await expect(montarIda(termo, chave)).rejects.toThrow(TypeError)
    await expect(montarIda(termoFicticio(), new Uint8Array(16))).rejects.toThrow(RangeError)
  })

  test('termo longo demais não vira link', async () => {
    const palavras = Array.from({ length: 900 }, (_, i) => (i * 7919).toString(36)).join(' ')
    const erro = await montarIda(termoFicticio({ txt: palavras }), novaChave()).catch(
      (falha: unknown) => falha
    )
    expect(erro).toBeInstanceOf(LinkLongo)
    expect((erro as LinkLongo).tamanho).toBeGreaterThan(LIMITE_IDA)
    const link = await montarIda(termoFicticio({ txt: palavras }), novaChave(), { limite: 10_000 })
    expect(link.length).toBe((erro as LinkLongo).tamanho)
  })

  test('outra origem só muda o começo do link', async () => {
    const link = await montarIda(termoFicticio(), novaChave(), { origem: 'http://localhost:5173' })
    expect(link.startsWith('http://localhost:5173/assinar#1.')).toBe(true)
  })
})

describe('link de ida recusado', () => {
  test('versão desconhecida', async () => {
    const link = fragmento(await montarIda(termoFicticio(), novaChave()))
    expect(await motivo(lerIda(link.replace(/^1\./, '2.')))).toBe('versao')
    expect(await motivo(lerIda('0.abc.def'))).toBe('versao')
  })

  test('vazio, sem partes ou com partes a mais', async () => {
    for (const lido of ['', '#', '1', '1.abc', '1.a.b.c', 'v1.a.b', 'x']) {
      expect(await motivo(lerIda(lido))).toBe('incompleto')
    }
  })

  test('cortado no meio, como num link copiado pela metade', async () => {
    const link = fragmento(await montarIda(termoFicticio(), novaChave()))
    for (const tamanho of [50, link.length - 30, link.length - 1]) {
      expect(await motivo(lerIda(link.slice(0, tamanho)))).toBe('incompleto')
    }
  })

  test('um caractere trocado na chave ou nos dados', async () => {
    const link = fragmento(await montarIda(termoFicticio(), novaChave()))
    for (const posicao of [5, 30, 60, link.length - 2]) {
      expect(await motivo(lerIda(trocarCaractere(link, posicao)))).toBe('incompleto')
    }
  })

  test('chave de outro envio', async () => {
    const [versao, , dados] = fragmento(await montarIda(termoFicticio(), novaChave())).split('.')
    const outra = paraBase64url(novaChave())
    expect(await motivo(lerIda(`${versao}.${outra}.${dados}`))).toBe('incompleto')
  })

  test('dado cifrado para outro fim (dado adicional diferente)', async () => {
    const chave = novaChave()
    const json = new TextEncoder().encode(JSON.stringify(termoFicticio()))
    const dados = await cifrar(chave, `auri/termo/1/volta/${ID_FICTICIO}`, await comprimir(json))
    const lido = `1.${paraBase64url(chave)}.${paraBase64url(dados)}`
    expect(await motivo(lerIda(lido))).toBe('incompleto')
  })

  test('decifra, mas o conteúdo não é um termo', async () => {
    const chave = novaChave()
    for (const conteudo of ['{"id":"x"}', '[]', 'não é json', 'ÿ']) {
      const json = new TextEncoder().encode(conteudo)
      const dados = await cifrar(chave, 'auri/termo/1/ida', await comprimir(json))
      expect(await motivo(lerIda(`1.${paraBase64url(chave)}.${paraBase64url(dados)}`))).toBe(
        'incompleto'
      )
    }
  })

  test('longo demais para ser do Auri', async () => {
    expect(await motivo(lerIda(`1.${'A'.repeat(43)}.${'A'.repeat(9000)}`))).toBe('incompleto')
  })
})

describe('link de volta', () => {
  test('leva só a versão, o id às claras e a resposta cifrada', async () => {
    const chave = novaChave()
    const link = await montarVolta(chave, await respostaFicticia(), assinaturaFicticia())
    expect(link.startsWith(`https://auri.dev.br/recebido#1.${ID_FICTICIO}.`)).toBe(true)
    expect(link).not.toContain(paraBase64url(chave))
    expect(link).not.toContain(CPF_FICTICIO)
    expect(idDaVolta(fragmento(link))).toBe(ID_FICTICIO)
  })

  test('ida e volta, com a assinatura simplificada na tolerância 2', async () => {
    const chave = novaChave()
    const resposta = await respostaFicticia()
    const assinatura = assinaturaFicticia()
    const link = await montarVolta(chave, resposta, assinatura)
    const volta = await lerVolta(fragmento(link), chave)
    expect(volta.resposta).toEqual(resposta)
    expect(volta.assinatura).toEqual(assinatura.map((traco) => simplificar(traco, 2)))
    expect(link.length).toBeLessThanOrEqual(LIMITE_VOLTA)
  })

  test('responsável de outro parentesco leva o parentesco', async () => {
    const chave = novaChave()
    const resposta = await respostaFicticia({ rel: 'outro', par: 'Avó' })
    const link = await montarVolta(chave, resposta, assinaturaFicticia())
    expect((await lerVolta(fragmento(link), chave)).resposta).toMatchObject({ par: 'Avó' })
    const semPar = await respostaFicticia({ rel: 'outro' })
    await expect(montarVolta(chave, semPar, assinaturaFicticia())).rejects.toThrow(TypeError)
  })

  test('assinatura comprida sobe a tolerância até caber', async () => {
    const chave = novaChave()
    const assinatura = assinaturaFicticia(10, 600, 30)
    const fina = codificar(assinatura.map((traco) => simplificar(traco, 2)))
    const link = await montarVolta(chave, await respostaFicticia(), assinatura)
    const { assinatura: lida } = await lerVolta(fragmento(link), chave)
    expect(codificar(lida).length).toBeLessThan(fina.length)
    expect(link.length).toBeLessThanOrEqual(LIMITE_VOLTA)
  })

  test('assinatura que não cabe nem na tolerância 6', async () => {
    const longa = assinaturaFicticia(14, 800, 60)
    await expect(montarVolta(novaChave(), await respostaFicticia(), longa)).rejects.toBeInstanceOf(
      LinkLongo
    )
  })

  test('recusa montar resposta incompleta', async () => {
    const chave = novaChave()
    const casos: Partial<Resposta>[] = [
      { cpf: '123.456.789-09' },
      { h: 'abc' },
      { nome: '' },
      { ok: false as true },
      { tz: 900 },
      { rel: 'tia' as 'outro' }
    ]
    for (const caso of casos) {
      await expect(montarVolta(chave, await respostaFicticia(caso), [])).rejects.toThrow(TypeError)
    }
  })
})

describe('link de volta recusado', () => {
  test('chave de outro envio', async () => {
    const link = await montarVolta(novaChave(), await respostaFicticia(), assinaturaFicticia())
    expect(await motivo(lerVolta(fragmento(link), novaChave()))).toBe('incompleto')
  })

  test('resposta de um envio usada em outro (id de fora trocado)', async () => {
    const chave = novaChave()
    const link = fragmento(await montarVolta(chave, await respostaFicticia(), assinaturaFicticia()))
    const outroId = novoId()
    const trocado = link.replace(ID_FICTICIO, outroId)
    expect(idDaVolta(trocado)).toBe(outroId)
    expect(await motivo(lerVolta(trocado, chave))).toBe('incompleto')
  })

  test('id de dentro diferente do de fora', async () => {
    const chave = novaChave()
    const outroId = novoId()
    const link = fragmento(await montarVolta(chave, await respostaFicticia(), []))
    const dados = deBase64url(link.split('.')[2])
    expect(dados.length).toBeGreaterThan(28)
    const corpo = new TextEncoder().encode(JSON.stringify(await respostaFicticia()))
    const pacote = new Uint8Array(2 + corpo.length)
    new DataView(pacote.buffer).setUint16(0, corpo.length)
    pacote.set(corpo, 2)
    const cifrado = await cifrar(chave, `auri/termo/1/volta/${outroId}`, await comprimir(pacote))
    expect(await motivo(lerVolta(`1.${outroId}.${paraBase64url(cifrado)}`, chave))).toBe(
      'incompleto'
    )
  })

  test('cortada, com um caractere trocado ou com versão desconhecida', async () => {
    const chave = novaChave()
    const link = fragmento(await montarVolta(chave, await respostaFicticia(), assinaturaFicticia()))
    expect(await motivo(lerVolta(link.slice(0, -10), chave))).toBe('incompleto')
    expect(await motivo(lerVolta(trocarCaractere(link, link.length - 20), chave))).toBe(
      'incompleto'
    )
    expect(await motivo(lerVolta(link.replace(/^1\./, '7.'), chave))).toBe('versao')
    expect(() => idDaVolta(`1.${ID_FICTICIO}.AAAA`)).toThrow(LinkInvalido)
    expect(() => idDaVolta(`1.curto.${'A'.repeat(60)}`)).toThrow(LinkInvalido)
  })

  test('assinatura danificada dentro da cifra', async () => {
    const chave = novaChave()
    const corpo = new TextEncoder().encode(JSON.stringify(await respostaFicticia()))
    const pacote = new Uint8Array(2 + corpo.length + 2)
    new DataView(pacote.buffer).setUint16(0, corpo.length)
    pacote.set(corpo, 2)
    pacote.set([1, 0], 2 + corpo.length)
    expect(() => decodificar(pacote.subarray(2 + corpo.length))).toThrow()
    const cifrado = await cifrar(
      chave,
      `auri/termo/1/volta/${ID_FICTICIO}`,
      await comprimir(pacote)
    )
    expect(await motivo(lerVolta(`1.${ID_FICTICIO}.${paraBase64url(cifrado)}`, chave))).toBe(
      'incompleto'
    )
  })
})

describe('resposta colada no Auri', () => {
  test('acha o fragmento na mensagem inteira do WhatsApp, no link ou sozinho', async () => {
    const link = await montarVolta(novaChave(), await respostaFicticia(), assinaturaFicticia())
    const mensagem = `Termo assinado: Termo de consentimento (Ana Beatriz Fictícia)\n${link}`
    expect(fragmentoDaVolta(mensagem)).toBe(fragmento(link))
    expect(fragmentoDaVolta(link.replace('recebido#', 'recebido/#'))).toBe(fragmento(link))
    expect(fragmentoDaVolta(`  ${fragmento(link)}\n`)).toBe(fragmento(link))
    expect(fragmentoDaVolta('Bom dia! Assinei.')).toBeNull()
  })
})

describe('campos de quem assina', () => {
  test('CPF pelos dígitos verificadores', () => {
    expect(cpfValido(CPF_FICTICIO)).toBe(true)
    expect(cpfValido('12345678900')).toBe(false)
    expect(cpfValido('11111111111')).toBe(false)
    expect(cpfValido('123.456.789-09')).toBe(false)
    expect(cpfValido('1234567890')).toBe(false)
  })

  test('nome completo tem ao menos duas palavras com letras', () => {
    expect(nomeCompleto('Maria Fictícia')).toBe(true)
    expect(nomeCompleto('  Maria   de   Souza ')).toBe(true)
    expect(nomeCompleto('Maria')).toBe(false)
    expect(nomeCompleto('Maria .')).toBe(false)
    expect(nomeCompleto('')).toBe(false)
  })
})

describe('prazo', () => {
  test('vence depois do segundo indicado em ate', () => {
    const termo = termoFicticio({ ate: 1_000 })
    expect(venceu(termo, 1_000_000)).toBe(false)
    expect(venceu(termo, 1_000_001)).toBe(true)
  })
})

describe('ids', () => {
  test('16 bytes sorteados em 22 caracteres', () => {
    const id = novoId()
    expect(id).toMatch(/^[\w-]{22}$/)
    expect(deBase64url(id)).toHaveLength(16)
    expect(novoId()).not.toBe(id)
  })
})
