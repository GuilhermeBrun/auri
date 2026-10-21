import { describe, expect, it, vi } from 'vite-plus/test'
import { paraBase64url } from '../../../web/contrato/assinatura/base64url'
import {
  chaveDoCodigo as chaveNoSite,
  expandirIda,
  idNoServidor,
  type Buscar
} from '../../../web/contrato/link-curto'
import contrato from '../../../web/contrato/link-curto.json'
import {
  chaveDoCodigo,
  codigoDaVolta,
  createLinksCurtos,
  linkCurto,
  novoCodigo
} from './links-curtos'

const ORIGEM = 'https://auri.dev.br'

function siteFalso() {
  const guardados = new Map<string, string>()
  const buscar = vi.fn<Buscar>(async (endereco, opcoes) => {
    const id = new URL(endereco).searchParams.get('id') ?? ''
    if (opcoes?.method === 'PUT') {
      const { dados } = JSON.parse(opcoes.body as string) as { dados: string }
      if (!guardados.has(id)) guardados.set(id, dados)
      return new Response(null, { status: 204 })
    }
    const dados = guardados.get(id)
    return dados ? new Response(dados) : new Response(null, { status: 404 })
  })
  return { guardados, buscar }
}

describe('link curto no Auri', () => {
  it('a chave do código é a mesma que a página calcula', async () => {
    const codigo = novoCodigo()
    expect(paraBase64url(chaveDoCodigo(codigo))).toBe(paraBase64url(await chaveNoSite(codigo)))
  })

  it('monta o link curto e o que vai para o site a partir do link longo', () => {
    const longo = `${ORIGEM}/assinar#1.chave.dados_cifrados`
    const curto = linkCurto(longo, 'AAECAwQFBgcICQoLDA0ODw', 1000, (link) => `Assine: ${link}`)
    expect(curto).toEqual({
      link: `${ORIGEM}/assinar#AAECAwQFBgcICQoLDA0ODw`,
      mensagem: `Assine: ${ORIGEM}/assinar#AAECAwQFBgcICQoLDA0ODw`,
      codigo: 'AAECAwQFBgcICQoLDA0ODw',
      dados: '1.dados_cifrados',
      expira: 1000 + contrato.folgaDaIdaS
    })
  })

  it('acha o código da resposta na mensagem, no auri:// ou sozinho', () => {
    const codigo = 'AAECAwQFBgcICQoLDA0ODw'
    expect(codigoDaVolta(`Termo assinado\nhttps://auri.dev.br/recebido#${codigo}`)).toBe(codigo)
    expect(codigoDaVolta(`Confirmo.\nhttps://auri.dev.br/resposta/#${codigo}`)).toBe(codigo)
    expect(codigoDaVolta(`auri://confirmacao#${codigo}`)).toBe(codigo)
    expect(codigoDaVolta(`  ${codigo} `)).toBe(codigo)
    expect(codigoDaVolta('https://auri.dev.br/recebido#1.abc.def')).toBeNull()
    expect(codigoDaVolta(`https://auri.dev.br/assinar#${codigo}`)).toBeNull()
  })

  it('encurta quando o site guarda e volta ao link longo quando não responde', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const site = siteFalso()
    const codigo = novoCodigo()
    const longo = `${ORIGEM}/confirmar#1.${paraBase64url(chaveDoCodigo(codigo))}.cifrado`
    const envio = {
      link: longo,
      mensagem: `Confirme: ${longo}`,
      numero: '5565999990000',
      curto: linkCurto(longo, codigo, 2_000_000_000, (link) => `Confirme: ${link}`)
    }
    const curto = await createLinksCurtos({ buscar: site.buscar }).encurtar(envio)
    expect(curto).toEqual({
      link: `${ORIGEM}/confirmar#${codigo}`,
      mensagem: `Confirme: ${ORIGEM}/confirmar#${codigo}`,
      numero: '5565999990000'
    })
    expect(await expandirIda(codigo, { origem: ORIGEM, buscar: site.buscar })).toBe(
      longo.slice(longo.indexOf('#') + 1)
    )

    const fora = createLinksCurtos({ buscar: () => Promise.reject(new TypeError('offline')) })
    expect(await fora.encurtar(envio)).toEqual({
      link: longo,
      mensagem: `Confirme: ${longo}`,
      numero: '5565999990000'
    })
  })

  it('troca a resposta curta pela longa e explica quando não acha', async () => {
    const site = siteFalso()
    const links = createLinksCurtos({ buscar: site.buscar })
    const codigo = novoCodigo()
    expect(await links.expandir('Sem link nenhum')).toBe('Sem link nenhum')
    await expect(links.expandir(`https://auri.dev.br/resposta#${codigo}`)).rejects.toThrow(
      /30 dias/
    )
    const fora = createLinksCurtos({ buscar: () => Promise.reject(new TypeError('offline')) })
    await expect(fora.expandir(codigo)).rejects.toThrow(/internet/)
  })

  it('a resposta lida na conferência serve para guardar sem ir ao site de novo', async () => {
    const site = siteFalso()
    const codigo = novoCodigo()
    site.guardados.set(await idNoServidor(codigo), '1.id.cifrado')
    const links = createLinksCurtos({ buscar: site.buscar })
    const texto = `https://auri.dev.br/recebido#${codigo}`
    expect(await links.expandir(texto)).toBe('1.id.cifrado')
    site.buscar.mockRejectedValue(new TypeError('offline'))
    expect(await links.expandir(texto)).toBe('1.id.cifrado')
    expect(site.buscar).toHaveBeenCalledTimes(1)
  })
})
