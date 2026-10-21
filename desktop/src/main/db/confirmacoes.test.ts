import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { runOperation } from '../operations'
import { emptyPatientInput } from '../../shared/schemas'
import { lerIda, montarVolta, type Decisao } from '../../../../web/contrato/confirmacao/formato'
import {
  createAppointment,
  getAppointment,
  moveAppointment,
  updateAppointment
} from './appointments'
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
import { expandirIda, encurtarVolta, type Buscar } from '../../../../web/contrato/link-curto'
import { createLinksCurtos } from '../links-curtos'

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

describe('lista para confirmar', () => {
  const proximo = (lista: ReturnType<typeof listarParaConfirmar>) =>
    lista.grupos.find((g) => !g.hoje)

  it('traz as sessões do dia seguinte com o contato principal', () => {
    const outro = paciente('Bruno Fictício', '')
    marcar('2026-10-20T09:00', '2026-10-20T09:30', outro)
    marcar('2026-10-21T09:00', '2026-10-21T09:30')
    const lista = listarParaConfirmar(db, AGORA)
    const amanha = proximo(lista)!
    expect(amanha.dia).toBe('2026-10-20')
    expect(amanha.sessoes.map((s) => s.patient_nome)).toEqual([
      'Bruno Fictício',
      'Ana Beatriz Fictícia'
    ])
    expect(amanha.sessoes[1].contato).toEqual({
      nome: 'Maria Fictícia',
      parentesco: 'Mãe',
      celular: '(65) 98888-1111'
    })
    expect(amanha.sessoes[0].contato?.celular).toBe('')
    expect(amanha.sessoes[1].bloqueio).toBeNull()
  })

  it('traz também as sessões que ainda vão começar hoje, com o que impede o envio', () => {
    marcar('2026-10-19T08:00', '2026-10-19T08:30')
    const perto = marcar('2026-10-19T08:50', '2026-10-19T09:20')
    const encaixe = marcar('2026-10-19T10:00', '2026-10-19T10:30')
    const [hoje] = listarParaConfirmar(db, AGORA).grupos
    expect(hoje).toMatchObject({ dia: '2026-10-19', hoje: true })
    expect(hoje.sessoes.map((s) => [s.appointment_id, s.bloqueio])).toEqual([
      [perto, expect.stringContaining('menos de 30 minutos')],
      [encaixe, null]
    ])
  })

  it('na sexta, as sessões de segunda', () => {
    marcar('2026-10-26T09:00', '2026-10-26T09:30')
    expect(proximo(listarParaConfirmar(db, new Date(2026, 9, 23, 9)))?.dia).toBe('2026-10-24')
    db.prepare('DELETE FROM clinic_hours WHERE dia_semana = 6').run()
    expect(proximo(listarParaConfirmar(db, new Date(2026, 9, 23, 9)))?.dia).toBe('2026-10-26')
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

  it('sessão em menos de 2 horas: prazo até 15 minutos antes dela', () => {
    const encaixe = marcar('2026-10-19T10:00', '2026-10-19T10:30')
    const envio = enviarConfirmacao(db, encaixe, PC, AGORA)
    expect(envio.prazo).toBe(minutos(75).toISOString())
    expect(envio.mensagem).toContain('até as 09:45')
    const quase = marcar('2026-10-19T09:00', '2026-10-19T09:30')
    expect(enviarConfirmacao(db, quase, PC, AGORA).prazo).toBe(minutos(15).toISOString())
  })

  it('perto de fechar, o prazo curto também precisa vencer com a clínica aberta', () => {
    expect(
      janelaDeEnvio(
        FUNCIONAMENTO_PADRAO,
        new Date(2026, 9, 19, 19, 30),
        new Date(2026, 9, 19, 19, 45)
      )
    ).toEqual({ aberta: true, ate: '19:45' })
    expect(
      janelaDeEnvio(
        FUNCIONAMENTO_PADRAO,
        new Date(2026, 9, 19, 19, 50),
        new Date(2026, 9, 19, 20, 5)
      )
    ).toMatchObject({ aberta: false, motivo: expect.stringContaining('por telefone') })
  })

  it('reenviar devolve o mesmo link', () => {
    const primeiro = enviarConfirmacao(db, sessaoId, PC, AGORA)
    const segundo = enviarConfirmacao(db, sessaoId, PC, minutos(10))
    expect(segundo).toEqual({ ...primeiro, reenvio: true })
  })

  it('recusa fora da janela, perto da sessão, sem celular ou já confirmada', () => {
    expect(() => enviarConfirmacao(db, sessaoId, PC, new Date(2026, 9, 19, 19))).toThrow(/fecha/)
    const logo = marcar('2026-10-19T08:55', '2026-10-19T09:25')
    expect(() => enviarConfirmacao(db, logo, PC, AGORA)).toThrow(/menos de 30 minutos/)
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

function siteFalso() {
  const guardados = new Map<string, string>()
  const buscar: Buscar = async (endereco, opcoes) => {
    const id = new URL(endereco).searchParams.get('id') ?? ''
    if (opcoes?.method === 'PUT') {
      guardados.set(id, (JSON.parse(opcoes.body as string) as { dados: string }).dados)
      return new Response(null, { status: 204 })
    }
    const dados = guardados.get(id)
    return dados ? new Response(dados) : new Response(null, { status: 404 })
  }
  return { buscar }
}

describe('link curto', () => {
  it('a família abre pelo código, responde com outro código e o Auri aplica', async () => {
    const site = siteFalso()
    const links = createLinksCurtos({ buscar: site.buscar })
    const envio = await links.encurtar(enviarConfirmacao(db, sessaoId, PC, AGORA))
    expect(envio.link).toMatch(/^https:\/\/auri\.dev\.br\/confirmar#[\w-]{22}$/)
    expect(envio.mensagem).toContain(envio.link)
    expect(envio).not.toHaveProperty('curto')

    const rede = { origem: 'https://auri.dev.br', buscar: site.buscar }
    const codigo = envio.link.slice(envio.link.indexOf('#') + 1)
    const longo = `https://auri.dev.br/confirmar#${await expandirIda(codigo, rede)}`
    const volta = (await responder(longo, 'confirmada', minutos(10))).split('\n')[1]!
    const curta = await encurtarVolta(volta, minutos(10).getTime(), rede)
    expect(curta).toMatch(/^https:\/\/auri\.dev\.br\/resposta#[\w-]{22}$/)

    const texto = await links.expandir(`Confirmo a sessão.\n${curta}`)
    expect(receberConfirmacao(db, texto, PC, minutos(12))).toMatchObject({
      ok: true,
      tipo: 'confirmada'
    })
  })

  it('reenviar devolve o mesmo código', () => {
    const primeiro = enviarConfirmacao(db, sessaoId, PC, AGORA)
    expect(enviarConfirmacao(db, sessaoId, PC, minutos(5)).curto).toEqual(primeiro.curto)
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
    const aplicada = aplicarOutraResposta(db, outra.ok ? outra.request_id : 0, PC)
    expect(aplicada).toMatchObject({ ok: true, tipo: 'desmarcada' })
    expect(getAppointment(db, sessaoId).presenca).toBe('desmarcou')
    expect(avisosDaConfirmacao(db, minutos(22)).outras).toEqual([])
  })

  it('outra resposta não mexe numa sessão remarcada nem com presença marcada', async () => {
    const { link } = enviarConfirmacao(db, sessaoId, PC, AGORA)
    receberConfirmacao(db, await responder(link, 'confirmada', minutos(10)), PC, minutos(11))
    const nao = await responder(link, 'desmarcada', minutos(20))
    const outra = receberConfirmacao(db, nao, PC, minutos(21))
    const requestId = outra.ok ? outra.request_id : 0
    const sessao = { patient_id: patientId, observacao: '' }
    updateAppointment(db, sessaoId, {
      ...sessao,
      inicio: '2026-10-20T14:00',
      fim: '2026-10-20T14:50',
      presenca: 'falta'
    })
    expect(() => aplicarOutraResposta(db, requestId, PC)).toThrow('presença desta sessão')
    updateAppointment(db, sessaoId, {
      ...sessao,
      inicio: '2026-10-20T16:00',
      fim: '2026-10-20T16:50'
    })
    expect(avisosDaConfirmacao(db, minutos(22)).outras).toEqual([])
    expect(() => aplicarOutraResposta(db, requestId, PC)).toThrow('mudou de horário')
    expect(receberConfirmacao(db, nao, PC, minutos(23))).toMatchObject({
      ok: false,
      erro: expect.stringContaining('mudou de horário')
    })
    expect(getAppointment(db, sessaoId).presenca).toBe('')
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
      { motivo: 'sem_resposta', falta_cobrada: true, cobranca_erro: null }
    ])
    expect(processarPrazos(db, PC, minutos(180))).toBe(0)
  })

  it('sem cobrança avisada na mensagem, libera e não cobra', () => {
    enviarConfirmacao(db, sessaoId, PC, AGORA)
    cobrar()
    processarPrazos(db, PC, minutos(130))
    expect(getAppointment(db, sessaoId).presenca).toBe('desmarcou')
    expect(cobrancas()).toEqual([])
    expect(avisosDaConfirmacao(db, minutos(131)).liberados).toMatchObject([
      { falta_cobrada: false, cobranca_erro: null }
    ])
  })

  it('remarcar ou desfazer a falta estorna a cobrança dela', () => {
    cobrar()
    enviarConfirmacao(db, sessaoId, PC, AGORA)
    processarPrazos(db, PC, minutos(130))
    expect(cobrancas().filter((c) => c.estorno === null)).toHaveLength(1)
    moveAppointment(
      db,
      sessaoId,
      { inicio: '2026-10-21T14:00', fim: '2026-10-21T14:50' },
      undefined,
      PC
    )
    expect(cobrancas().filter((c) => c.estorno === null)).toEqual([])
    expect(cobrancas()[0].estorno).toMatchObject({ motivo: 'Sessão remarcada.', computador: PC })

    const outraId = marcar('2026-10-22T14:00', '2026-10-22T14:50')
    const sessao = {
      patient_id: patientId,
      inicio: '2026-10-22T14:00',
      fim: '2026-10-22T14:50',
      observacao: ''
    }
    updateAppointment(db, outraId, { ...sessao, presenca: 'falta' })
    runOperation(db, 'finance:chargeAbsence', [outraId, PC])
    updateAppointment(db, outraId, { ...sessao, presenca: 'desmarcou' }, undefined, PC)
    expect(cobrancas().filter((c) => c.estorno === null)).toHaveLength(1)
    updateAppointment(db, outraId, { ...sessao, presenca: '' }, undefined, PC)
    expect(cobrancas().filter((c) => c.estorno === null)).toEqual([])
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
    expect(recebida).toMatchObject({ ok: true, tipo: 'conferir', resposta: 'confirmada' })
    expect(recebida.ok && recebida.detalhe).toContain('Confira na conversa do WhatsApp')
    expect(getAppointment(db, sessaoId).presenca).toBe('desmarcou')
    expect(cobrancas().every((c) => c.estorno === null)).toBe(true)
    expect(avisosDaConfirmacao(db, minutos(141)).outras).toMatchObject([
      { resposta: 'confirmada', vencido: true }
    ])
    const aplicada = aplicarOutraResposta(db, recebida.ok ? recebida.request_id : 0, PC)
    expect(aplicada.ok && aplicada.detalhe).toContain('estornada')
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
    expect(recebida).toMatchObject({ ok: true, tipo: 'conferir' })
    const aplicada = aplicarOutraResposta(db, recebida.ok ? recebida.request_id : 0, PC)
    expect(aplicada.ok && aplicada.detalhe).toContain('remarque')
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

describe('verificador no main', () => {
  it('só avisa a tela quando algo mudou', () => {
    const avisar = vi.fn()
    expect(runOperation(db, 'confirmacoes:prazos', [PC], avisar)).toEqual({ ok: true, data: 0 })
    expect(avisar).not.toHaveBeenCalled()
    enviarConfirmacao(db, sessaoId, PC, AGORA)
    expect(runOperation(db, 'confirmacoes:prazos', [PC], avisar)).toEqual({ ok: true, data: 1 })
    expect(avisar).toHaveBeenCalledWith(['appointments', 'finance'], null)
  })
})
