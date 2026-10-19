import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { deBase64url, paraBase64url } from '../contrato/assinatura/base64url'
import { novaChave, sha256 } from '../contrato/assinatura/cifra'
import { termoFicticio } from '../contrato/assinatura/ficticio'
import {
  LIMITE_IDA,
  LIMITE_VOLTA,
  ORIGEM,
  PAPEIS,
  cpfValido,
  fragmentoDaVolta,
  idDaVolta,
  lerVolta,
  montarIda,
  nomeCompleto,
  novoId,
  type Papel,
  type Termo
} from '../contrato/assinatura/formato'
import { ALTURA, ESPESSURA, LARGURA, tracoParaSvg } from '../contrato/assinatura/traco'

const AJUDA = `Link de teste do termo, só com dados fictícios.

  npm run termo:teste -- --whats 5565999990000
      gera um link de ida e espera a resposta que chegar no WhatsApp

  npm run termo:teste -- ler
      lê uma resposta de um link gerado antes neste computador

Opções:
  --whats   WhatsApp que recebe a resposta, com 55 e DDD (o seu, no teste)
  --para    número do celular que assina, para montar o link wa.me de ida
  --tamanho aumenta o termo até o link de ida chegar perto desse tamanho
  --papel   quem deve assinar: ${PAPEIS.join(', ')} (padrão: mae)
  --dias    prazo em dias (padrão: 7; 0 gera um link já vencido)
  --site    outro endereço do site, como a prévia da Vercel (padrão: ${ORIGEM})
`

const CHAVES = join(tmpdir(), 'auri-termo-teste.json')

type Guardado = Record<string, { chave: string; h: string; criado: string }>

const milhar = (numero: number): string => numero.toLocaleString('pt-BR')
const numero = (texto: string | undefined, padrao: number): number => {
  const valor = texto === undefined ? padrao : Number(texto)
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`Número inválido: ${texto}`)
  return valor
}

function guardados(): Guardado {
  try {
    return JSON.parse(readFileSync(CHAVES, 'utf8')) as Guardado
  } catch {
    return {}
  }
}

const SILABAS =
  'ba be bi bo bu ca ce ci co cu da de di do du fa fe fi fo fu ga go gu la le li lo lu ma me mi mo mu na ne ni no nu pa pe pi po pu ra re ri ro ru sa se si so su ta te ti to tu va ve vi vo'.split(
    ' '
  )

function anexo(palavras: number): string {
  let semente = 12345
  const sortear = (quantos: number): number => {
    semente = (semente * 16807) % 2147483647
    return semente % quantos
  }
  const texto: string[] = []
  for (let i = 0; i < palavras; i++) {
    const silabas = 1 + sortear(3)
    texto.push(Array.from({ length: silabas }, () => SILABAS[sortear(SILABAS.length)]).join(''))
    if (i % 24 === 23) texto.push('.\n\n')
  }
  return `\n\n## Anexo de teste\n\n${texto.join(' ')}.`
}

async function termoNoTamanho(termo: Termo, chave: Uint8Array, site: string, alvo: number) {
  let palavras = 0
  let link = await montarIda(termo, chave, { origem: site, limite: Infinity })
  while (alvo > 0 && link.length < alvo) {
    palavras += 20
    termo = { ...termo, txt: termoFicticio().txt + anexo(palavras) }
    link = await montarIda(termo, chave, { origem: site, limite: Infinity })
  }
  return { termo, link }
}

function dia(segundos: number): string {
  const data = new Date(segundos * 1000)
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

type Opcoes = Partial<Record<'whats' | 'para' | 'tamanho' | 'papel' | 'dias' | 'site', string>>

const mensagemDeErro = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro)

async function gerar(valores: Opcoes) {
  const whats = valores.whats ?? '5565999990000'
  if (!/^\d{12,13}$/.test(whats))
    throw new Error('--whats precisa de 55, DDD e número, sem espaços')
  const papel = (valores.papel ?? 'mae') as Papel
  if (!PAPEIS.includes(papel)) throw new Error(`--papel precisa ser ${PAPEIS.join(', ')}`)
  const site = (valores.site ?? ORIGEM).replace(/\/+$/, '')
  const dias = numero(valores.dias, 7)
  const id = novoId()
  const chave = novaChave()
  const base = termoFicticio({
    id,
    ate: Math.floor(Date.now() / 1000 + (dias === 0 ? -60 : dias * 86_400)),
    cli: { nome: 'Clínica Exemplo', whats },
    resp: papel === 'outro' ? { papel, par: 'Avó' } : { papel }
  })
  const { termo, link } = await termoNoTamanho(base, chave, site, numero(valores.tamanho, 0))
  const todos = guardados()
  todos[id] = {
    chave: paraBase64url(chave),
    h: await sha256(termo.txt),
    criado: new Date().toISOString()
  }
  writeFileSync(CHAVES, `${JSON.stringify(todos, null, 2)}\n`)

  const acima = link.length > LIMITE_IDA ? `, acima do limite de ${milhar(LIMITE_IDA)}` : ''
  console.log(`\nTermo de ${milhar(termo.txt.length)} caracteres, vence em ${dia(termo.ate)}.`)
  console.log(`\nLink de ida (${milhar(link.length)} caracteres${acima}):\n${link}`)
  if (valores.para) {
    const mensagem = `Olá! A ${termo.cli.nome} enviou o termo "${termo.mod.titulo}" de ${termo.pac.nome} para você ler e assinar pelo celular. O link vale até ${dia(termo.ate)}:\n${link}`
    const wa = `https://wa.me/${valores.para}?text=${encodeURIComponent(mensagem)}`
    console.log(`\nMensagem pelo wa.me (${milhar(wa.length)} caracteres):\n${wa}`)
  }
  console.log(`\nChave guardada em ${CHAVES}.`)
}

function fuso(minutos: number): string {
  const horas = Math.abs(minutos) / 60
  return `UTC${minutos < 0 ? '−' : '+'}${Number.isInteger(horas) ? horas : horas.toFixed(1)}`
}

async function ler(texto: string): Promise<boolean> {
  const fragmento = fragmentoDaVolta(texto)
  if (!fragmento) return false
  const id = idDaVolta(fragmento)
  const guardado = guardados()[id]
  if (!guardado)
    throw new Error(`A resposta é do envio ${id}, que não foi gerado neste computador.`)
  const { resposta, assinatura } = await lerVolta(fragmento, deBase64url(guardado.chave))
  const tamanho = `${ORIGEM}/recebido#${fragmento}`.length
  const pontos = assinatura.reduce((total, traco) => total + traco.length, 0)
  const desenho = join(tmpdir(), `auri-termo-${id}.svg`)
  const caminhos = assinatura.map((traco) => `<path d="${tracoParaSvg(traco)}"/>`).join('')
  writeFileSync(
    desenho,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA} ${ALTURA}" width="${LARGURA}" height="${ALTURA}"><rect width="100%" height="100%" fill="#fff"/><g fill="none" stroke="#1b1b22" stroke-width="${ESPESSURA}" stroke-linecap="round" stroke-linejoin="round">${caminhos}</g></svg>\n`
  )
  const em = new Date(resposta.em * 1000)
  const linhas = [
    `Resposta de ${milhar(tamanho)} caracteres (limite de ${milhar(LIMITE_VOLTA)}), envio ${id}`,
    `  Nome: ${resposta.nome}${nomeCompleto(resposta.nome) ? '' : ' (incompleto)'}`,
    `  CPF: ${resposta.cpf}${cpfValido(resposta.cpf) ? '' : ' (inválido)'}`,
    `  Quem assina: ${resposta.rel}${resposta.par ? ` (${resposta.par})` : ''}`,
    `  Aceite: ${resposta.ok ? 'marcado' : 'não marcado'}`,
    `  Assinado em: ${em.toLocaleString('pt-BR')} (hora do celular, ${fuso(resposta.tz)})`,
    `  Texto: ${resposta.h === guardado.h ? 'igual ao enviado' : 'DIFERENTE do enviado'} (SHA-256)`,
    `  Assinatura: ${assinatura.length} ${assinatura.length === 1 ? 'traço' : 'traços'}, ${milhar(pontos)} pontos, desenho em ${desenho}`
  ]
  console.log(`\n${linhas.join('\n')}\n`)
  return true
}

function esperarResposta(): Promise<void> {
  console.log(
    '\nCole aqui a resposta que chegou no WhatsApp (a mensagem inteira ou só o link) e tecle Enter.'
  )
  console.log('Ctrl+C sai; depois dá para ler com `npm run termo:teste -- ler`.\n')
  const linhas = createInterface({ input: process.stdin })
  return new Promise((pronto) => {
    linhas.on('line', (linha) => {
      ler(linha).then(
        (lida) => {
          if (!lida) return
          linhas.close()
          pronto()
        },
        (erro: unknown) => console.error(`\n${mensagemDeErro(erro)}\n`)
      )
    })
    linhas.on('close', () => pronto())
  })
}

const { values: valores, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    whats: { type: 'string' },
    para: { type: 'string' },
    tamanho: { type: 'string' },
    papel: { type: 'string' },
    dias: { type: 'string' },
    site: { type: 'string' },
    ajuda: { type: 'boolean', short: 'h' }
  }
})

try {
  if (valores.ajuda) {
    console.log(AJUDA)
  } else if (positionals[0] === 'ler') {
    const colado = positionals.slice(1).join(' ')
    if (!colado) await esperarResposta()
    else if (!(await ler(colado))) throw new Error('Não achei uma resposta no texto colado.')
  } else {
    await gerar(valores)
    await esperarResposta()
  }
} catch (erro) {
  console.error(`\n${mensagemDeErro(erro)}\n`)
  process.exitCode = 1
}
