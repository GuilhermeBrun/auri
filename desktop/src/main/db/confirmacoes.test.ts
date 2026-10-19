import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { emptyPatientInput } from '../../shared/schemas'
import { lerIda, montarVolta, type Decisao } from '../../../../web/contrato/confirmacao/formato'
import { createAppointment, getAppointment, updateAppointment } from './appointments'
import { saveClinic } from './clinic'
import {
  aplicarOutraResposta,
  avisosDaConfirmacao,
  dispensarAviso,
  enviarConfirmacao,
  janelaDeEnvio,
  listarParaConfirmar,
  processarPrazos,
  receberConfirmacao
} from './confirmacoes'
import { openDatabase, type Db } from './connection'
import { getPatientFinance, saveService, setBilling } from './finance'
import { createPatient } from './patients'
import { FUNCIONAMENTO_PADRAO } from '../../shared/agenda'

const PC = 'Recepção'
const AGORA = new Date(2026, 9, 19, 8, 30)
const minutos = (n: number): Date => new Date(AGORA.getTime() + n * 60_000)

let db: Db
let patientId: number
let sessaoId: number

function clinica(): void {
  saveClinic(db, {
    nome: 'Clínica Fictícia',
    documento: '',
    endereco: '',
    telefone: '',
    whatsapp: '(65) 99999-0000',
    profissional: 'Lara Fictícia Souza',
    registro: '',
    logo: ''
  })
}

function paciente(nome: string, celular = '(65) 98888-1111'): number {
  return createPatient(db, {
    ...emptyPatientInput(),
    nome,
    data_nascimento: '2019-03-04',
    mae_nome: 'Maria Fictícia',
    mae_celular: celular,
    contato_principal: 'mae'
  }).id
}

function marcar(inicio: string, fim: string, patient = patientId): number {
  return createAppointment(db, { patient_id: patient, inicio, fim, observacao: '' }, AGORA).id
}

beforeEach(() => {
  db = openDatabase(':memory:')
  clinica()
  patientId = paciente('Ana Beatriz Fictícia')
  sessaoId = marcar('2026-10-20T14:00', '2026-10-20T14:50')
})

async function responder(link: string, res: Decisao, em: Date): Promise<string> {
  const { chave, confirmacao } = await lerIda(link.slice(link.indexOf('#')))
  const volta = await montarVolta(chave, {
    id: confirmacao.id,
    res,
    em: Math.floor(em.getTime() / 1000),
    tz: -240
  })
  return `Sessão: Ana\n${volta}`
}

function cobrar(): void {
  const service = saveService(db, null, { nome: 'Sessão', valor_centavos: 19000 }).id
  setBilling(db, patientId, {
    forma: 'particular',
    service_id: service,
    insurer_id: null,
    carteirinha: '',
    desde: '2026-01-01'
  })
}

const cobrancas = () =>
  getPatientFinance(db, patientId).charges.filter((c) => c.motivo === 'falta_cobrada')

describe('janela de envio', () => {
  it('só com a clínica aberta e até 2 horas antes de fechar', () => {
    expect(janelaDeEnvio(FUNCIONAMENTO_PADRAO, AGORA)).toEqual({ aberta: true, ate: '18:00' })
    expect(janelaDeEnvio(FUNCIONAMENTO_PADRAO, new Date(2026, 9, 19, 18, 1)).aberta).toBe(false)
    expect(janelaDeEnvio(FUNCIONAMENTO_PADRAO, new Date(2026, 9, 19, 6, 59)).aberta).toBe(false)
    expect(janelaDeEnvio(FUNCIONAMENTO_PADRAO, new Date(2026, 9, 18, 9)).aberta).toBe(false)
    expect(janelaDeEnvio(FUNCIONAMENTO_PADRAO, new Date(2026, 9, 24, 10, 30))).toMatchObject({
      aberta: false,
      motivo: expect.stringContaining('fecha às 12:00')
    })
  })
})

describe('lista do próximo dia de atendimento', () => {
  it('traz as sessões do dia seguinte com o contato principal', () => {
    const outro = paciente('Bruno Fictício', '')
    marcar('2026-10-20T09:00', '2026-10-20T09:30', outro)
    marcar('2026-10-21T09:00', '2026-10-21T09:30')
    const lista = listarParaConfirmar(db, AGORA)
    expect(lista.dia).toBe('2026-10-20')
    expect(lista.sessoes.map((s) => s.patient_nome)).toEqual([
      'Bruno Fictício',
      'Ana Beatriz Fictícia'
    ])
    expect(lista.sessoes[1].contato).toEqual({
      nome: 'Maria Fictícia',
      parentesco: 'Mãe',
      celular: '(65) 98888-1111'
    })
    expect(lista.sessoes[0].contato?.celular).toBe('')
  })

  it('na sexta, as sessões de segunda', () => {
    marcar('2026-10-26T09:00', '2026-10-26T09:30')
    expect(listarParaConfirmar(db, new Date(2026, 9, 23, 9)).dia).toBe('2026-10-24')
    db.prepare('DELETE FROM clinic_hours WHERE dia_semana = 6').run()
    expect(listarParaConfirmar(db, new Date(2026, 9, 23, 9)).dia).toBe('2026-10-26')
  })
})

describe('envio', () => {
  it('monta o link com prazo de 2 horas e marca aguardando', async () => {
    const envio = enviarConfirmacao(db, sessaoId, PC, AGORA)
    expect(envio).toMatchObject({ numero: '5565988881111', reenvio: false })
    expect(envio.prazo).toBe(minutos(120).toISOString())
    expect(envio.mensagem).toContain('confirmação da sessão de Ana Beatriz com Lara Fictícia')
    expect(envio.mensagem).toContain('às 14:00')
    const { confirmacao } = await lerIda(envio.link.slice(envio.link.indexOf('#')))
    expect(confirmacao.cob).toBe(false)
    expect(getAppointment(db, sessaoId).pedido).toEqual({
      estado: 'aguardando',
      prazo: envio.prazo
    })
  })

  it('reenviar devolve o mesmo link', () => {
    const primeiro = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const segundo = enviarConfirmacao(db, sessaoId, PC, minutos(10))
    expect(segundo).toEqual({ ...primeiro, reenvio: true })
  })

  it('recusa fora da janela, perto da sessão, sem celular ou já confirmada', () => {
    expect(() => enviarConfirmacao(db, sessaoId, PC, new Date(2026, 9, 19, 19))).toThrow(/fecha/)
    const logo = marcar('2026-10-19T10:00', '2026-10-19T10:30')
    expect(() => enviarConfirmacao(db, logo, PC, AGORA)).toThrow(/menos de 2 horas/)
    const semCelular = marcar('2026-10-20T08:00', '2026-10-20T08:30', paciente('Caio', ''))
    expect(() => enviarConfirmacao(db, semCelular, PC, AGORA)).toThrow(/celular de Maria/)
    updateAppointment(db, sessaoId, {
      patient_id: patientId,
      inicio: '2026-10-20T14:00',
      fim: '2026-10-20T14:50',
      observacao: '',
      confirmado: true
    })
    expect(() => enviarConfirmacao(db, sessaoId, PC, AGORA)).toThrow(/já está confirmada/)
  })

  it('pede os dados da clínica', () => {
    db.prepare('UPDATE clinic SET whatsapp = NULL').run()
    expect(() => enviarConfirmacao(db, sessaoId, PC, AGORA)).toThrow(/WhatsApp da clínica/)
  })
})

describe('resposta', () => {
  it('confirmar marca confirmado', async () => {
    const { link } = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const recebida = receberConfirmacao(
      db,
      await responder(link, 'confirmada', minutos(10)),
      PC,
      minutos(12)
    )
    expect(recebida).toMatchObject({
      ok: true,
      tipo: 'confirmada',
      titulo: 'Ana Beatriz confirmou'
    })
    const a = getAppointment(db, sessaoId)
    expect(a.confirmado_em).not.toBeNull()
    expect(a.pedido?.estado).toBe('confirmado')
  })

  it('desmarcar libera o horário e devolve a vaga', async () => {
    const { link } = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const recebida = receberConfirmacao(
      db,
      await responder(link, 'desmarcada', minutos(10)),
      PC,
      minutos(12)
    )
    expect(recebida).toMatchObject({
      ok: true,
      tipo: 'desmarcada',
      vaga: { inicio: '2026-10-20T14:00', fim: '2026-10-20T14:50' }
    })
    const a = getAppointment(db, sessaoId)
    expect(a.presenca).toBe('desmarcou')
    expect(a.pedido?.estado).toBe('desmarcado')
    expect(avisosDaConfirmacao(db, minutos(15)).liberados).toMatchObject([
      { appointment_id: sessaoId, motivo: 'desmarcou' }
    ])
    expect(() => marcar('2026-10-20T14:00', '2026-10-20T14:50', paciente('Duda'))).not.toThrow()
  })

  it('a mesma resposta de novo não muda nada; outra diferente espera a secretária', async () => {
    const { link } = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const sim = await responder(link, 'confirmada', minutos(10))
    receberConfirmacao(db, sim, PC, minutos(11))
    expect(receberConfirmacao(db, sim, PC, minutos(12))).toMatchObject({ tipo: 'repetida' })
    const nao = await responder(link, 'desmarcada', minutos(20))
    const outra = receberConfirmacao(db, nao, PC, minutos(21))
    expect(outra).toMatchObject({ ok: true, tipo: 'outra' })
    expect(getAppointment(db, sessaoId).presenca).toBe('')
    expect(avisosDaConfirmacao(db, minutos(22)).outras).toMatchObject([
      { appointment_id: sessaoId, resposta: 'desmarcada' }
    ])
    const aplicada = aplicarOutraResposta(db, outra.ok ? outra.request_id : 0)
    expect(aplicada).toMatchObject({ ok: true, tipo: 'desmarcada' })
    expect(getAppointment(db, sessaoId).presenca).toBe('desmarcou')
    expect(avisosDaConfirmacao(db, minutos(22)).outras).toEqual([])
  })

  it('recusa resposta incompleta, de outro Auri ou de pedido cancelado', async () => {
    expect(receberConfirmacao(db, 'oi', PC, AGORA)).toMatchObject({ ok: false })
    const { link } = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const texto = await responder(link, 'confirmada', minutos(5))
    expect(receberConfirmacao(db, texto.slice(0, -8), PC, minutos(6))).toMatchObject({
      ok: false,
      erro: expect.stringMatching(/incompleta|não é de um pedido/)
    })
    db.prepare(
      "UPDATE appointments SET inicio = '2026-10-20T15:00', fim = '2026-10-20T15:50'"
    ).run()
    expect(receberConfirmacao(db, texto, PC, minutos(6))).toMatchObject({
      ok: false,
      erro: expect.stringContaining('cancelado')
    })
  })
})

describe('prazo de 2 horas', () => {
  it('sem resposta: libera o horário e lança a cobrança da falta', () => {
    cobrar()
    enviarConfirmacao(db, sessaoId, PC, AGORA)
    expect(processarPrazos(db, PC, minutos(119))).toBe(0)
    expect(processarPrazos(db, PC, minutos(121))).toBe(1)
    const a = getAppointment(db, sessaoId)
    expect(a.presenca).toBe('desmarcou')
    expect(a.pedido?.estado).toBe('sem_resposta')
    expect(cobrancas()).toHaveLength(1)
    expect(avisosDaConfirmacao(db, minutos(122)).liberados).toMatchObject([
      { motivo: 'sem_resposta', cobranca_erro: null }
    ])
    expect(processarPrazos(db, PC, minutos(180))).toBe(0)
  })

  it('sem forma de cobrança, libera e avisa que não cobrou', () => {
    enviarConfirmacao(db, sessaoId, PC, AGORA)
    processarPrazos(db, PC, minutos(130))
    expect(getAppointment(db, sessaoId).presenca).toBe('desmarcou')
    expect(avisosDaConfirmacao(db, minutos(131)).liberados[0].cobranca_erro).toMatch(
      /forma de cobrança/
    )
  })

  it('o que venceu com o app fechado é processado ao abrir', () => {
    cobrar()
    enviarConfirmacao(db, sessaoId, PC, AGORA)
    expect(processarPrazos(db, PC, new Date(2026, 9, 20, 7))).toBe(1)
    const row = db.prepare('SELECT vencido_em, prazo FROM confirmation_requests').get() as {
      vencido_em: string
      prazo: string
    }
    expect(row.vencido_em).toBe(row.prazo)
  })

  it('confirmado à mão ou remarcado antes do prazo não vence', () => {
    enviarConfirmacao(db, sessaoId, PC, AGORA)
    updateAppointment(db, sessaoId, {
      patient_id: patientId,
      inicio: '2026-10-20T14:00',
      fim: '2026-10-20T14:50',
      observacao: '',
      confirmado: true
    })
    expect(processarPrazos(db, PC, minutos(130))).toBe(1)
    expect(getAppointment(db, sessaoId)).toMatchObject({
      presenca: '',
      pedido: { estado: 'confirmado' }
    })
  })

  it('resposta dada no prazo que chegou depois desfaz a liberação e estorna', async () => {
    cobrar()
    const { link } = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const texto = await responder(link, 'confirmada', minutos(118))
    processarPrazos(db, PC, minutos(125))
    expect(cobrancas()).toHaveLength(1)
    const recebida = receberConfirmacao(db, texto, PC, minutos(140))
    expect(recebida).toMatchObject({ ok: true, tipo: 'no_prazo' })
    expect(recebida.ok && recebida.detalhe).toContain('estornada')
    expect(getAppointment(db, sessaoId)).toMatchObject({
      presenca: '',
      pedido: { estado: 'confirmado' }
    })
    expect(cobrancas().every((c) => c.estorno !== null)).toBe(true)
  })

  it('resposta no prazo com o horário já ocupado pede para remarcar', async () => {
    const { link } = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const texto = await responder(link, 'confirmada', minutos(119))
    processarPrazos(db, PC, minutos(125))
    marcar('2026-10-20T14:00', '2026-10-20T14:50', paciente('Duda'))
    const recebida = receberConfirmacao(db, texto, PC, minutos(140))
    expect(recebida.ok && recebida.detalhe).toContain('remarque')
    expect(getAppointment(db, sessaoId).presenca).toBe('desmarcou')
  })

  it('resposta dada depois do prazo é recusada', async () => {
    const { link } = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const texto = await responder(link, 'confirmada', minutos(126))
    expect(receberConfirmacao(db, texto, PC, minutos(127))).toMatchObject({
      ok: false,
      erro: expect.stringContaining('depois do prazo')
    })
    expect(getAppointment(db, sessaoId).presenca).toBe('desmarcou')
  })

  it('o aviso some ao dispensar e a chave some depois da sessão', () => {
    enviarConfirmacao(db, sessaoId, PC, AGORA)
    processarPrazos(db, PC, minutos(130))
    const [aviso] = avisosDaConfirmacao(db, minutos(131)).liberados
    dispensarAviso(db, aviso.request_id, 'liberado')
    expect(avisosDaConfirmacao(db, minutos(132)).liberados).toEqual([])
    processarPrazos(db, PC, new Date(2026, 9, 20, 15))
    const row = db.prepare('SELECT chave FROM confirmation_requests').get() as { chave: null }
    expect(row.chave).toBeNull()
  })
})
