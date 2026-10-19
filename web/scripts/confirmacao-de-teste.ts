import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { deBase64url, paraBase64url } from '../contrato/assinatura/base64url'
import { novaChave } from '../contrato/assinatura/cifra'
import { ORIGEM, novoId } from '../contrato/assinatura/formato'
import { confirmacaoFicticia } from '../contrato/confirmacao/ficticio'
import {
  LIMITE_IDA,
  LIMITE_VOLTA,
  fragmentoDaVolta,
  idDaVolta,
  lerVolta,
  montarIda,
  tamanhoNoSite,
  CAMINHO_DA_VOLTA
} from '../contrato/confirmacao/formato'
import { hora, mensagemDaIda, quando } from '../contrato/confirmacao/textos'

const AJUDA = `Link de teste da confirmação de sessão, só com dados fictícios.

  npm run confirmacao:teste -- --whats 5565999990000
      gera um link de ida e espera a resposta que chegar no WhatsApp

  npm run confirmacao:teste -- ler
      lê uma resposta de um link gerado antes neste computador

Opções:
  --whats     WhatsApp que recebe a resposta, com 55 e DDD (o seu, no teste)
  --para      número do celular que responde, para montar o link wa.me de ida
  --minutos   prazo para responder, em minutos (padrão: 120; 0 gera um link já vencido)
  --horas     daqui a quantas horas é a sessão (padrão: 24)
  --sem-cobranca  aviso sem a cobrança da sessão
  --site      outro endereço do site, como a prévia da Vercel (padrão: ${ORIGEM})
`

const CHAVES = join(tmpdir(), 'auri-confirmacao-teste.json')
const FUSO = -240

type Guardado = Record<string, { chave: string; criado: string }>

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

const mensagemDeErro = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro)

type Opcoes = {
  whats?: string
  para?: string
  minutos?: string
  horas?: string
  'sem-cobranca'?: boolean
  site?: string
}

async function gerar(valores: Opcoes) {
  const whats = valores.whats ?? '5565999990000'
  if (!/^\d{12,13}$/.test(whats))
    throw new Error('--whats precisa de 55, DDD e número, sem espaços')
  const site = (valores.site ?? ORIGEM).replace(/\/+$/, '')
  const agora = Math.floor(Date.now() / 1000)
  const minutos = numero(valores.minutos, 120)
  const ini = Math.ceil((agora + numero(valores.horas, 24) * 3600) / 1800) * 1800
  const ate = Math.min(ini, minutos === 0 ? agora - 60 : agora + minutos * 60)
  const id = novoId()
  const chave = novaChave()
  const confirmacao = confirmacaoFicticia({
    id,
    ate,
    tz: FUSO,
    cli: { nome: 'Clínica Exemplo', whats },
    ses: { ini, dur: 50, prof: 'Fernanda' },
    cob: !valores['sem-cobranca']
  })
  const link = await montarIda(confirmacao, chave, { origem: site, limite: Infinity })
  const todos = guardados()
  todos[id] = { chave: paraBase64url(chave), criado: new Date().toISOString() }
  writeFileSync(CHAVES, `${JSON.stringify(todos, null, 2)}\n`)

  const acima = link.length > LIMITE_IDA ? `, acima do limite de ${milhar(LIMITE_IDA)}` : ''
  console.log(`\nSessão ${quando(confirmacao)}, prazo às ${hora(ate, FUSO)} (horário de Cuiabá).`)
  console.log(`\nLink de ida (${milhar(link.length)} caracteres${acima}):\n${link}`)
  const mensagem = mensagemDaIda(confirmacao, link)
  console.log(`\nMensagem:\n${mensagem}`)
  if (valores.para) {
    const wa = `https://wa.me/${valores.para}?text=${encodeURIComponent(mensagem)}`
    console.log(`\nPelo wa.me (${milhar(wa.length)} caracteres):\n${wa}`)
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
  const resposta = await lerVolta(fragmento, deBase64url(guardado.chave))
  const tamanho = tamanhoNoSite(CAMINHO_DA_VOLTA, fragmento)
  const em = new Date(resposta.em * 1000)
  console.log(
    [
      `\nResposta de ${milhar(tamanho)} caracteres (limite de ${milhar(LIMITE_VOLTA)}), envio ${id}`,
      `  Resposta: ${resposta.res}`,
      `  Em: ${em.toLocaleString('pt-BR')} (hora do celular, ${fuso(resposta.tz)})\n`
    ].join('\n')
  )
  return true
}

function esperarResposta(): Promise<void> {
  console.log(
    '\nCole aqui a resposta que chegou no WhatsApp (a mensagem inteira ou só o link) e tecle Enter.'
  )
  console.log('Ctrl+C sai; depois dá para ler com `npm run confirmacao:teste -- ler`.\n')
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
    minutos: { type: 'string' },
    horas: { type: 'string' },
    'sem-cobranca': { type: 'boolean' },
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
    if (process.stdin.isTTY) await esperarResposta()
  }
} catch (erro) {
  console.error(`\n${mensagemDeErro(erro)}\n`)
  process.exitCode = 1
}
