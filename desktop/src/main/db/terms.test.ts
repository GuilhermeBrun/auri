import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput, type TermSendInput } from '../../shared/schemas'
import { CPF_FICTICIO, assinaturaFicticia } from '../../../../web/contrato/assinatura/ficticio'
import { lerIda, montarVolta, type Resposta } from '../../../../web/contrato/assinatura/formato'
import { sha256 } from '../terms/link'
import { saveClinic } from './clinic'
import { openDatabase, type Db } from './connection'
import { createPatient } from './patients'
import {
  acceptResponse,
  cancelTerm,
  checkResponse,
  listModels,
  listPatientTerms,
  saveModel,
  sendTerm,
  setModelArchived,
  signedTermRecord,
  termLink
} from './terms'

let db: Db
let patientId: number
let modelId: number

const AGORA = new Date(Date.UTC(2026, 9, 19, 15, 0))
const DEPOIS = new Date(Date.UTC(2026, 9, 19, 18, 0))

const TEXTO =
  '# Termo de {clinica}\n\nAutorizo o atendimento de **{paciente}**, nascida em {nascimento}.'

const para = (over: Partial<TermSendInput['destino']> = {}): TermSendInput => ({
  model_id: modelId,
  destino: {
    papel: 'mae',
    nome: 'Marina Fictícia',
    parentesco: 'Mãe',
    cpf: '123.456.789-09',
    celular: '(65) 99999-1234',
    ...over
  },
  dias: 7
})

beforeEach(() => {
  db = openDatabase(':memory:')
  saveClinic(db, {
    nome: 'Clínica Fictícia',
    documento: '',
    endereco: '',
    telefone: '',
    whatsapp: '(65) 99999-0000',
    profissional: 'Lara Fictícia',
    registro: 'CRFa 0-0000',
    logo: ''
  })
  patientId = createPatient(db, {
    ...emptyPatientInput(),
    nome: 'Helena Fictícia',
    data_nascimento: '2019-03-12'
  }).id
  modelId = saveModel(db, null, { titulo: 'Consentimento', texto: TEXTO }).id
})

async function responder(link: string, over: Partial<Resposta> = {}): Promise<string> {
  const { chave, termo } = await lerIda(link.slice(link.indexOf('#')))
  const resposta: Resposta = {
    id: termo.id,
    h: sha256(termo.txt),
    nome: 'Marina Fictícia',
    cpf: CPF_FICTICIO,
    rel: 'mae',
    ok: true,
    em: Math.floor(AGORA.getTime() / 1000) + 600,
    tz: -240,
    ...over
  }
  return `Termo assinado: Consentimento · Helena\n${await montarVolta(chave, resposta, assinaturaFicticia())}`
}

describe('modelos de termo', () => {
  it('editar cria a versão seguinte, sem mexer na anterior', () => {
    expect(listModels(db)).toMatchObject([{ id: modelId, versao: 1, arquivado: false }])
    expect(saveModel(db, modelId, { titulo: 'Consentimento', texto: TEXTO }).versao).toBe(1)
    expect(
      saveModel(db, modelId, { titulo: 'Consentimento', texto: `${TEXTO}\n\nMais.` }).versao
    ).toBe(2)
    expect(() => db.prepare('UPDATE term_versions SET texto = ?').run('outro')).toThrow(
      /não pode ser alterada/
    )
    expect(() => db.prepare('DELETE FROM term_versions').run()).toThrow(/não pode ser apagada/)
  })

  it('arquivar tira do envio e desarquivar devolve', () => {
    setModelArchived(db, modelId, true)
    expect(() => sendTerm(db, patientId, para(), 'Recepção', AGORA)).toThrow(/arquivado/)
    expect(setModelArchived(db, modelId, false).arquivado).toBe(false)
  })
})

describe('envio', () => {
  it('pede os dados da clínica antes de enviar', () => {
    db.prepare('UPDATE clinic SET whatsapp = NULL, profissional = NULL').run()
    expect(() => sendTerm(db, patientId, para(), 'Recepção', AGORA)).toThrow(
      'Para enviar termos, preencha na tela Clínica: o WhatsApp da clínica, o profissional responsável.'
    )
  })

  it('preenche os campos e a página lê o link', async () => {
    const enviado = sendTerm(db, patientId, para(), 'Recepção', AGORA)
    expect(enviado.numero).toBe('5565999991234')
    expect(enviado.mensagem).toBe(
      `Olá, Marina! Para ler e assinar pelo celular: "Consentimento", de Helena (Clínica Fictícia).\n${enviado.link}`
    )
    const { termo } = await lerIda(enviado.link.slice(enviado.link.indexOf('#')))
    expect(termo.txt).toBe(
      '# Termo de Clínica Fictícia\n\nAutorizo o atendimento de **Helena Fictícia**, nascida em 12/03/2019.'
    )
    expect(termo).toMatchObject({
      cli: { nome: 'Clínica Fictícia', whats: '5565999990000' },
      resp: { papel: 'mae' },
      mod: { titulo: 'Consentimento', versao: 1 }
    })
    expect(enviado.request).toMatchObject({ estado: 'aguardando', destino_nome: 'Marina Fictícia' })
    expect(termLink(db, enviado.request.id, AGORA).link).toBe(enviado.link)
    expect(termLink(db, enviado.request.id, AGORA).curto).toEqual(enviado.curto)
    const curto = enviado.curto!
    expect(curto.link).toMatch(/^https:\/\/auri\.dev\.br\/assinar#[\w-]{22}$/)
    expect(curto.mensagem).toBe(enviado.mensagem.replace(enviado.link, curto.link))
    expect(enviado.link.endsWith(`.${curto.dados}`)).toBe(true)
    expect(curto.expira).toBe(termo.ate + 86_400)
  })

  it('enviar de novo troca o envio anterior, que deixa de valer', async () => {
    const primeiro = sendTerm(db, patientId, para(), 'Recepção', AGORA)
    sendTerm(db, patientId, para(), 'Recepção', AGORA)
    expect(listPatientTerms(db, patientId, AGORA).map((r) => r.estado)).toEqual([
      'aguardando',
      'trocado'
    ])
    const check = checkResponse(db, await responder(primeiro.link), DEPOIS)
    expect(check).toEqual({
      ok: false,
      erro: 'Este link foi trocado por um envio mais novo.',
      guardado: null
    })
  })
})

describe('recebimento', () => {
  it('confere, avisa e guarda o termo assinado, que não muda mais', async () => {
    const enviado = sendTerm(db, patientId, para({ cpf: '' }), 'Recepção', AGORA)
    const mensagem = await responder(enviado.link, { rel: 'pai' })
    const check = checkResponse(db, mensagem, DEPOIS)
    expect(check).toMatchObject({
      ok: true,
      patient_nome: 'Helena Fictícia',
      resposta: { nome: 'Marina Fictícia', cpf: CPF_FICTICIO, papel: 'pai', parentesco: 'Pai' },
      avisos: ['O termo foi enviado para a mãe, e quem assinou foi o pai.']
    })

    const guardado = acceptResponse(db, mensagem, 'Recepção', DEPOIS)
    expect(guardado.estado).toBe('assinado')
    expect(guardado.assinado).toMatchObject({ nome: 'Marina Fictícia', parentesco: 'Pai' })
    expect(db.prepare('SELECT chave, link FROM term_requests').get()).toEqual({
      chave: null,
      link: null
    })
    expect(checkResponse(db, mensagem, DEPOIS)).toEqual({
      ok: false,
      erro: 'Este termo já está guardado.',
      guardado: guardado.assinado!.id
    })
    expect(() => db.prepare("UPDATE signed_terms SET nome = 'Outra'").run()).toThrow(
      /não pode ser alterado/
    )
    expect(() => db.prepare('DELETE FROM signed_terms').run()).toThrow(/não pode ser apagado/)
    expect(() => db.prepare("UPDATE term_requests SET estado = 'aguardando'").run()).toThrow(
      /já foi concluído/
    )
    expect(() => db.prepare("UPDATE term_requests SET termo = '{}'").run()).toThrow(/não muda/)

    const record = signedTermRecord(db, guardado.assinado!.id)
    expect(record).toMatchObject({
      titulo: 'Consentimento',
      versao: 1,
      clinica: 'Clínica Fictícia',
      paciente: { nome: 'Helena Fictícia', nascimento: '2019-03-12' },
      cpf: CPF_FICTICIO,
      destino_numero: '5565999991234'
    })
    expect(record.registro_sha256).toMatch(/^[\da-f]{64}$/)
  })

  it('avisa quando o CPF não é o da ficha', async () => {
    const enviado = sendTerm(db, patientId, para({ cpf: '529.982.247-25' }), 'Recepção', AGORA)
    const check = checkResponse(db, await responder(enviado.link), DEPOIS)
    expect(check.ok && check.avisos).toEqual([
      'O CPF não é o de Marina Fictícia na ficha. Confira quem assinou.'
    ])
  })

  it('recusa texto trocado, CPF inválido, nome incompleto e resposta danificada', async () => {
    const { link } = sendTerm(db, patientId, para(), 'Recepção', AGORA)
    const erro = async (over: Partial<Resposta>): Promise<string> => {
      const check = checkResponse(db, await responder(link, over), DEPOIS)
      return check.ok ? '' : check.erro
    }
    expect(await erro({ h: 'f'.repeat(64) })).toBe('O texto assinado não é o que foi enviado.')
    expect(await erro({ cpf: '11111111111' })).toBe('O CPF de quem assinou não é válido.')
    expect(await erro({ nome: 'Marina' })).toBe('Falta o nome completo de quem assinou.')
    const ok = await responder(link)
    const cortada = checkResponse(db, ok.slice(0, -12), DEPOIS)
    expect(cortada.ok ? '' : cortada.erro).toMatch(/incompleta/)
    expect(checkResponse(db, 'oi', DEPOIS)).toMatchObject({ ok: false, erro: /Cole a mensagem/ })
  })

  it('recusa resposta de envio desconhecido, cancelado ou vencido', async () => {
    const outro = openDatabase(':memory:')
    const { link } = sendTerm(db, patientId, para(), 'Recepção', AGORA)
    const mensagem = await responder(link)
    expect(checkResponse(outro, mensagem, DEPOIS)).toMatchObject({
      erro: 'Esta resposta não é de um termo enviado por este Auri.'
    })
    const vencido = new Date(AGORA.getTime() + 8 * 86_400_000)
    expect(checkResponse(db, mensagem, vencido)).toMatchObject({ erro: /^Este link venceu em/ })
    expect(listPatientTerms(db, patientId, vencido)[0].estado).toBe('vencido')
    cancelTerm(db, listPatientTerms(db, patientId, AGORA)[0].id, AGORA)
    expect(checkResponse(db, mensagem, DEPOIS)).toMatchObject({ erro: /foi cancelado/ })
    expect(() => acceptResponse(db, mensagem, 'Recepção', DEPOIS)).toThrow(/foi cancelado/)
  })
})
