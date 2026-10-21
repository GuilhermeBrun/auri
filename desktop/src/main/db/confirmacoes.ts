import { addDays, differenceInMinutes, format, startOfDay } from 'date-fns'
import {
  abertoNoHorario,
  diaAberto,
  horarioDoDia,
  minutesOf,
  timeOf,
  type Funcionamento
} from '../../shared/agenda'
import {
  PERTO_DEMAIS,
  PRAZO_DA_CONFIRMACAO_MS,
  TOLERANCIA_DA_RESPOSTA_MS,
  prazoCurtoDemais,
  prazoDaConfirmacao,
  type AvisosDaConfirmacao,
  type ConfirmacaoEnvio,
  type ConfirmacaoLista,
  type ConfirmacaoRecebida,
  type HorarioLiberado,
  type JanelaDeEnvio,
  type OutraResposta,
  type Vaga
} from '../../shared/confirmacao'
import { parseIsoLocalDateTime, toIsoLocalDateTime } from '../../shared/dates'
import { isValidPhone } from '../../shared/masks'
import { shortName } from '../../shared/names'
import { contatoPrincipal } from '../../shared/responsavel'
import { numeroDoWhatsApp } from '../../shared/terms'
import { LinkInvalido } from '../../../../web/contrato/assinatura/formato'
import {
  confirmacaoValida,
  fragmentoDaVolta,
  idDaVolta,
  type Confirmacao,
  type Decisao
} from '../../../../web/contrato/confirmacao/formato'
import { hora, mensagemDaIda, quando } from '../../../../web/contrato/confirmacao/textos'
import { lerVolta, montarIda } from '../confirmacao/link'
import { novaChave, novoEnvio } from '../terms/link'
import { getAppointment, listAppointments } from './appointments'
import { busyIn } from './busy'
import { getClinic, getFuncionamento } from './clinic'
import type { Db } from './connection'
import { cobrarFalta, estornar, getBilling } from './finance'
import { getPatient } from './patients'

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
const MINUTOS_DO_PRAZO = PRAZO_DA_CONFIRMACAO_MS / 60_000

const minutosDoDia = (data: Date): number => data.getHours() * 60 + data.getMinutes()

export function janelaDeEnvio(
  funcionamento: Funcionamento,
  agora: Date,
  prazo: Date = new Date(agora.getTime() + PRAZO_DA_CONFIRMACAO_MS)
): JanelaDeEnvio {
  const horario = horarioDoDia(funcionamento, agora)
  if (!horario || !abertoNoHorario(funcionamento, agora)) {
    return {
      aberta: false,
      motivo:
        'A clínica está fechada agora. Envie com a clínica aberta, até 2 horas antes de fechar, para o prazo não vencer com ela fechada.'
    }
  }
  const minutos = Math.ceil((prazo.getTime() - agora.getTime()) / 60_000)
  const ultimo = minutesOf(horario.fecha) - minutos
  if (minutosDoDia(agora) > ultimo) {
    return {
      aberta: false,
      motivo:
        minutos < MINUTOS_DO_PRAZO
          ? `A clínica fecha às ${horario.fecha}: o prazo venceria com ela fechada. Confirme com a família por telefone.`
          : `A clínica fecha às ${horario.fecha}: o prazo de 2 horas venceria com ela fechada. Envie amanhã cedo ou até as ${timeOf(Math.max(ultimo, 0))}.`
    }
  }
  return { aberta: true, ate: timeOf(ultimo) }
}

export function proximoDiaDeAtendimento(funcionamento: Funcionamento, agora: Date): Date | null {
  for (let d = 1; d <= 7; d++) {
    const dia = addDays(startOfDay(agora), d)
    if (diaAberto(funcionamento, dia)) return dia
  }
  return null
}

function contatoDaFicha(db: Db, patientId: number, agora: Date) {
  const pessoa = contatoPrincipal(getPatient(db, patientId), agora)
  return pessoa
    ? { nome: pessoa.nome, parentesco: pessoa.parentesco, celular: pessoa.celular }
    : null
}

export function listarParaConfirmar(db: Db, agora: Date): ConfirmacaoLista {
  const funcionamento = getFuncionamento(db)
  const janela = janelaDeEnvio(funcionamento, agora)
  const dia = proximoDiaDeAtendimento(funcionamento, agora)
  if (!dia) return { dia: null, janela, sessoes: [] }
  const sessoes = listAppointments(db, toIsoLocalDateTime(dia), toIsoLocalDateTime(addDays(dia, 1)))
    .filter((a) => a.presenca === '')
    .map((a) => ({
      appointment_id: a.id,
      inicio: a.inicio,
      fim: a.fim,
      patient_id: a.patient_id,
      patient_nome: a.patient_nome,
      tipo_nome: a.tipo_nome,
      contato: contatoDaFicha(db, a.patient_id, agora),
      confirmado: a.confirmado_em !== null,
      pedido: a.pedido
    }))
  return { dia: format(dia, 'yyyy-MM-dd'), janela, sessoes }
}

type RequestRow = {
  id: number
  envio: string
  appointment_id: number
  inicio: string
  destino_numero: string
  prazo: string
  confirmacao: string
  chave: Buffer | null
  link: string | null
  estado: 'aguardando' | 'respondido' | 'cancelado' | 'vencido'
  resposta: Decisao | null
  outra_resposta: Decisao | null
  charge_id: number | null
}

function envioDe(row: RequestRow, reenvio: boolean): ConfirmacaoEnvio {
  const confirmacao = JSON.parse(row.confirmacao) as Confirmacao
  return {
    appointment_id: row.appointment_id,
    link: row.link ?? '',
    numero: row.destino_numero,
    mensagem: mensagemDaIda(confirmacao, row.link ?? ''),
    prazo: row.prazo,
    reenvio
  }
}

function faltaDaClinica(clinic: ReturnType<typeof getClinic>): string[] {
  const falta: string[] = []
  if (!clinic.nome) falta.push('o nome da clínica')
  if (!clinic.whatsapp) falta.push('o WhatsApp da clínica')
  if (!clinic.profissional) falta.push('o profissional responsável')
  return falta
}

export function enviarConfirmacao(
  db: Db,
  appointmentId: number,
  computador: string,
  agora: Date = new Date()
): ConfirmacaoEnvio {
  return db.transaction(() => {
    processarPrazos(db, computador, agora)
    const pendente = db
      .prepare(
        "SELECT * FROM confirmation_requests WHERE appointment_id = ? AND estado = 'aguardando'"
      )
      .get(appointmentId) as RequestRow | undefined
    if (pendente) return envioDe(pendente, true)

    const a = getAppointment(db, appointmentId)
    if (a.presenca !== '') throw new Error('Esta sessão já tem a presença marcada.')
    if (a.confirmado_em !== null) throw new Error('Esta sessão já está confirmada.')
    const clinic = getClinic(db)
    const falta = faltaDaClinica(clinic)
    if (falta.length > 0)
      throw new Error(`Para pedir confirmação, preencha na tela Clínica: ${falta.join(', ')}.`)
    const inicio = parseIsoLocalDateTime(a.inicio)
    if (prazoCurtoDemais(inicio, agora)) throw new Error(PERTO_DEMAIS)
    const prazo = prazoDaConfirmacao(inicio, agora)
    const janela = janelaDeEnvio(clinic.funcionamento, agora, prazo)
    if (!janela.aberta) throw new Error(janela.motivo)
    const patient = getPatient(db, a.patient_id)
    const contato = contatoPrincipal(patient, agora)
    if (!contato) throw new Error('Cadastre o contato principal na ficha do paciente.')
    if (!isValidPhone(contato.celular))
      throw new Error(`Cadastre o celular de ${contato.nome.split(' ')[0]} na ficha do paciente.`)

    const confirmacao = confirmacaoValida({
      id: novoEnvio(),
      ate: Math.floor(prazo.getTime() / 1000),
      tz: 0 - inicio.getTimezoneOffset(),
      cli: { nome: clinic.nome.slice(0, 80), whats: numeroDoWhatsApp(clinic.whatsapp) },
      pac: { nome: shortName(patient.nome).slice(0, 120) },
      ses: {
        ini: Math.floor(inicio.getTime() / 1000),
        dur: differenceInMinutes(parseIsoLocalDateTime(a.fim), inicio),
        prof: shortName(clinic.profissional).slice(0, 120)
      },
      cob: getBilling(db, patient.id)?.service_id != null
    })
    const chave = novaChave()
    const link = montarIda(confirmacao, chave)
    const criado = db
      .prepare(
        `INSERT INTO confirmation_requests (envio, appointment_id, inicio, destino_nome,
           destino_numero, prazo, computador, confirmacao, chave, link)
         VALUES (@envio, @appointment_id, @inicio, @destino_nome, @destino_numero, @prazo,
           @computador, @confirmacao, @chave, @link)`
      )
      .run({
        envio: confirmacao.id,
        appointment_id: a.id,
        inicio: a.inicio,
        destino_nome: contato.nome,
        destino_numero: numeroDoWhatsApp(contato.celular),
        prazo: prazo.toISOString(),
        computador,
        confirmacao: JSON.stringify(confirmacao),
        chave,
        link
      })
    const row = db
      .prepare('SELECT * FROM confirmation_requests WHERE id = ?')
      .get(criado.lastInsertRowid) as RequestRow
    return envioDe(row, false)
  })()
}

type Pendente = {
  id: number
  appointment_id: number
  inicio: string
  prazo: string
  confirmacao: string
  a_inicio: string | null
  presenca: string | null
  confirmado_em: string | null
}

function liberar(db: Db, appointmentId: number): void {
  db.prepare(
    `UPDATE appointments SET presenca = 'desmarcou', confirmado_em = NULL, updated_at = ${NOW}
     WHERE id = ?`
  ).run(appointmentId)
}

function vencer(db: Db, pendente: Pendente, computador: string): void {
  liberar(db, pendente.appointment_id)
  let chargeId: number | null = null
  let erro: string | null = null
  if ((JSON.parse(pendente.confirmacao) as Confirmacao).cob) {
    try {
      chargeId = cobrarFalta(db, pendente.appointment_id, computador)
    } catch (falha) {
      erro = falha instanceof Error ? falha.message : 'A cobrança não foi lançada.'
    }
  }
  db.prepare(
    `UPDATE confirmation_requests
     SET estado = 'vencido', vencido_em = prazo, link = NULL, charge_id = ?, cobranca_erro = ?
     WHERE id = ?`
  ).run(chargeId, erro, pendente.id)
}

export function processarPrazos(db: Db, computador: string, agora: Date = new Date()): number {
  return db.transaction(() => {
    const pendentes = db
      .prepare(
        `SELECT r.id, r.appointment_id, r.inicio, r.prazo, r.confirmacao, a.inicio AS a_inicio,
                a.presenca, a.confirmado_em
         FROM confirmation_requests r LEFT JOIN appointments a ON a.id = r.appointment_id
         WHERE r.estado = 'aguardando'`
      )
      .all() as Pendente[]
    const iso = agora.toISOString()
    let mudou = 0
    for (const p of pendentes) {
      if (p.a_inicio !== p.inicio || p.presenca !== null) {
        db.prepare(
          `UPDATE confirmation_requests SET estado = 'cancelado', chave = NULL, link = NULL
           WHERE id = ?`
        ).run(p.id)
      } else if (p.confirmado_em !== null) {
        db.prepare(
          `UPDATE confirmation_requests
           SET estado = 'respondido', resposta = 'confirmada', recebido_em = ?, link = NULL
           WHERE id = ?`
        ).run(iso, p.id)
      } else if (p.prazo <= iso) {
        vencer(db, p, computador)
      } else {
        continue
      }
      mudou++
    }
    db.prepare(
      `UPDATE confirmation_requests SET chave = NULL, link = NULL
       WHERE estado <> 'aguardando' AND chave IS NOT NULL AND inicio < ?`
    ).run(toIsoLocalDateTime(agora))
    return mudou
  })()
}

const fail = (erro: string): ConfirmacaoRecebida => ({ ok: false, erro })

const INCOMPLETA = 'A resposta chegou incompleta. Peça para enviar de novo pelo mesmo link.'

type Recebida = RequestRow & { patient_nome: string; a_inicio: string; a_fim: string }

function horarioLivre(db: Db, row: Recebida): boolean {
  return busyIn(db, row.a_inicio, row.a_fim, { appointment: row.appointment_id }).length === 0
}

const MUDOU_DE_HORARIO =
  'A sessão mudou de horário depois do pedido. A resposta não muda mais nada: combine com a família.'
const PRESENCA_MARCADA =
  'A presença desta sessão já foi marcada. A resposta não muda mais nada: combine com a família.'

function confirmar(db: Db, appointmentId: number): void {
  db.prepare(
    `UPDATE appointments
     SET presenca = NULL, confirmado_em = coalesce(confirmado_em, ${NOW}), updated_at = ${NOW}
     WHERE id = ?`
  ).run(appointmentId)
}

function estornarFalta(db: Db, chargeId: number | null, computador: string): boolean {
  if (chargeId === null) return false
  const ativa = db
    .prepare('SELECT 1 FROM finance_charges WHERE id = ? AND estornado_em IS NULL')
    .get(chargeId)
  if (!ativa) return false
  estornar(
    db,
    'charge',
    chargeId,
    'Respondeu no prazo da confirmação; a resposta chegou depois.',
    computador
  )
  return true
}

const ACAO: Record<Decisao, string> = { confirmada: 'confirmar', desmarcada: 'desmarcar' }

export function receberConfirmacao(
  db: Db,
  texto: string,
  computador: string,
  agora: Date = new Date()
): ConfirmacaoRecebida {
  return db.transaction((): ConfirmacaoRecebida => {
    processarPrazos(db, computador, agora)
    const fragmento = fragmentoDaVolta(texto)
    if (!fragmento) return fail('Cole a mensagem inteira que chegou pelo WhatsApp, ou só o link.')
    let envio: string
    try {
      envio = idDaVolta(fragmento)
    } catch (erro) {
      return fail(
        erro instanceof LinkInvalido && erro.motivo === 'versao'
          ? 'Esta resposta é de uma versão mais nova do Auri. Atualize o Auri.'
          : INCOMPLETA
      )
    }
    const row = db
      .prepare(
        `SELECT r.*, p.nome AS patient_nome, a.inicio AS a_inicio, a.fim AS a_fim
         FROM confirmation_requests r
         JOIN appointments a ON a.id = r.appointment_id
         JOIN patients p ON p.id = a.patient_id
         WHERE r.envio = ?`
      )
      .get(envio) as Recebida | undefined
    if (!row) return fail('Esta resposta não é de um pedido de confirmação deste Auri.')
    if (row.estado === 'cancelado')
      return fail('Este pedido foi cancelado: a sessão mudou de horário ou já foi desmarcada.')
    if (!row.chave) return fail('Esta sessão já passou. A resposta não muda mais nada.')
    if (row.inicio !== row.a_inicio) return fail(MUDOU_DE_HORARIO)
    let res: Decisao
    let em: number
    try {
      ;({ res, em } = lerVolta(fragmento, row.chave))
    } catch {
      return fail(INCOMPLETA)
    }

    const confirmacao = JSON.parse(row.confirmacao) as Confirmacao
    const quem = shortName(row.patient_nome)
    const sessao = quando(confirmacao)
    const vaga: Vaga = { inicio: row.a_inicio, fim: row.a_fim }
    const base = { request_id: row.id, appointment_id: row.appointment_id, resposta: res }
    const registrar = (): void => {
      db.prepare(
        `UPDATE confirmation_requests
         SET estado = 'respondido', resposta = ?, respondido_em = ?, recebido_em = ?, link = NULL
         WHERE id = ?`
      ).run(res, em, agora.toISOString(), row.id)
    }

    if (row.estado === 'aguardando') {
      if (res === 'confirmada') confirmar(db, row.appointment_id)
      else liberar(db, row.appointment_id)
      registrar()
      return res === 'confirmada'
        ? {
            ok: true,
            tipo: 'confirmada',
            titulo: `${quem} confirmou`,
            detalhe: `Sessão de ${sessao}.`,
            vaga: null,
            ...base
          }
        : {
            ok: true,
            tipo: 'desmarcada',
            titulo: `${quem} desmarcou`,
            detalhe: `O horário de ${sessao} ficou livre.`,
            vaga,
            ...base
          }
    }

    if (row.estado === 'respondido') {
      if (res === row.resposta)
        return {
          ok: true,
          tipo: 'repetida',
          titulo: 'Esta resposta já foi aplicada',
          detalhe: `${quem} respondeu "${ACAO[res]}" para a sessão de ${sessao}.`,
          vaga: null,
          ...base
        }
      db.prepare('UPDATE confirmation_requests SET outra_resposta = ? WHERE id = ?').run(
        res,
        row.id
      )
      return {
        ok: true,
        tipo: 'outra',
        titulo: `${quem} mandou outra resposta`,
        detalhe: `Agora quer ${ACAO[res]} a sessão de ${sessao}. Nada mudou na agenda.`,
        vaga: null,
        ...base
      }
    }

    if (em * 1000 > Date.parse(row.prazo) + TOLERANCIA_DA_RESPOSTA_MS)
      return fail(
        `A resposta foi dada depois do prazo (${hora(confirmacao.ate, confirmacao.tz)}). O horário já tinha sido liberado.`
      )
    db.prepare(
      'UPDATE confirmation_requests SET outra_resposta = ?, respondido_em = ? WHERE id = ?'
    ).run(res, em, row.id)
    const limite = hora(confirmacao.ate + TOLERANCIA_DA_RESPOSTA_MS / 1000, confirmacao.tz)
    return {
      ok: true,
      tipo: 'conferir',
      titulo: `${quem} respondeu depois do vencimento`,
      detalhe: `Pelo relógio do celular, a resposta saiu às ${hora(em, confirmacao.tz)}, dentro do prazo. Confira na conversa do WhatsApp se a mensagem chegou até as ${limite} antes de ${ACAO[res]} a sessão de ${sessao}.`,
      vaga: null,
      ...base
    }
  })()
}

export function aplicarOutraResposta(
  db: Db,
  requestId: number,
  computador: string,
  agora: Date = new Date()
): ConfirmacaoRecebida {
  return db.transaction((): ConfirmacaoRecebida => {
    const row = db
      .prepare(
        `SELECT r.*, p.nome AS patient_nome, a.inicio AS a_inicio, a.fim AS a_fim,
                a.presenca AS presenca
         FROM confirmation_requests r
         JOIN appointments a ON a.id = r.appointment_id
         JOIN patients p ON p.id = a.patient_id
         WHERE r.id = ?`
      )
      .get(requestId) as (Recebida & { presenca: string | null }) | undefined
    if (!row?.outra_resposta) throw new Error('Não há outra resposta para aplicar.')
    if (row.inicio !== row.a_inicio) throw new Error(MUDOU_DE_HORARIO)
    if (row.presenca !== null && row.presenca !== 'desmarcou') throw new Error(PRESENCA_MARCADA)
    const outra = row.outra_resposta
    const sessao = quando(JSON.parse(row.confirmacao) as Confirmacao)
    const vencido = row.estado === 'vencido'
    const livre = row.presenca === null || horarioLivre(db, row)
    if (outra === 'confirmada' && !livre && !vencido)
      throw new Error('O horário já foi ocupado. Remarque a sessão.')
    const estornou = vencido && estornarFalta(db, row.charge_id, computador)
    const cobranca = estornou ? ' A cobrança da falta foi estornada.' : ''
    let vaga: Vaga | null = null
    let detalhe: string
    if (outra === 'desmarcada') {
      if (row.presenca === null) liberar(db, row.appointment_id)
      vaga = { inicio: row.a_inicio, fim: row.a_fim }
      detalhe = `O horário de ${sessao} ficou livre.${cobranca}`
    } else if (livre) {
      confirmar(db, row.appointment_id)
      detalhe = `A sessão de ${sessao} está confirmada.${cobranca}`
    } else {
      detalhe = `O horário de ${sessao} já foi ocupado: remarque a sessão.${cobranca}`
    }
    db.prepare(
      `UPDATE confirmation_requests
       SET estado = 'respondido', resposta = outra_resposta, outra_resposta = NULL,
           recebido_em = coalesce(recebido_em, ?), link = NULL, aviso_visto_em = NULL
       WHERE id = ?`
    ).run(agora.toISOString(), requestId)
    return {
      ok: true,
      tipo: outra,
      resposta: outra,
      titulo: outra === 'desmarcada' ? 'Sessão desmarcada' : 'Sessão confirmada',
      detalhe,
      request_id: row.id,
      appointment_id: row.appointment_id,
      vaga
    }
  })()
}

type AvisoRow = {
  request_id: number
  appointment_id: number
  patient_nome: string
  inicio: string
  fim: string
  estado: 'respondido' | 'vencido'
  resposta: Decisao | null
  outra_resposta: Decisao | null
  charge_id: number | null
  cobranca_erro: string | null
  aviso_visto_em: string | null
  presenca: string | null
}

export function avisosDaConfirmacao(db: Db, agora: Date = new Date()): AvisosDaConfirmacao {
  const rows = db
    .prepare(
      `SELECT r.id AS request_id, r.appointment_id, p.nome AS patient_nome, a.inicio, a.fim,
              r.estado, r.resposta, r.outra_resposta, r.charge_id, r.cobranca_erro,
              r.aviso_visto_em, a.presenca
       FROM confirmation_requests r
       JOIN appointments a ON a.id = r.appointment_id
       JOIN patients p ON p.id = a.patient_id
       WHERE r.estado IN ('respondido', 'vencido') AND a.inicio = r.inicio AND a.fim > ?
       ORDER BY a.inicio, r.id`
    )
    .all(toIsoLocalDateTime(agora)) as AvisoRow[]
  const liberados: HorarioLiberado[] = []
  const outras: OutraResposta[] = []
  for (const row of rows) {
    const base = {
      request_id: row.request_id,
      appointment_id: row.appointment_id,
      patient_nome: row.patient_nome,
      inicio: row.inicio,
      fim: row.fim
    }
    if (row.outra_resposta)
      outras.push({ ...base, resposta: row.outra_resposta, vencido: row.estado === 'vencido' })
    const liberado =
      row.presenca === 'desmarcou' && (row.estado === 'vencido' || row.resposta === 'desmarcada')
    if (liberado && row.aviso_visto_em === null)
      liberados.push({
        ...base,
        motivo: row.estado === 'vencido' ? 'sem_resposta' : 'desmarcou',
        falta_cobrada: row.charge_id !== null,
        cobranca_erro: row.cobranca_erro
      })
  }
  return { liberados, outras }
}

export function dispensarAviso(db: Db, requestId: number, tipo: 'liberado' | 'outra'): void {
  const result = db
    .prepare(
      tipo === 'liberado'
        ? `UPDATE confirmation_requests SET aviso_visto_em = ${NOW} WHERE id = ?`
        : 'UPDATE confirmation_requests SET outra_resposta = NULL WHERE id = ?'
    )
    .run(requestId)
  if (result.changes === 0) throw new Error('Pedido de confirmação não encontrado')
}
