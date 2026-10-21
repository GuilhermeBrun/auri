import { addDays, format } from 'date-fns'
import { toIsoDate } from '../../shared/dates'
import { onlyDigits } from '../../shared/masks'
import type {
  SignedTermRecord,
  SignerPapel,
  TermCheck,
  TermLink,
  TermModel,
  TermModelInput,
  TermRequest,
  TermSendInput,
  TermSendResult
} from '../../shared/schemas'
import { mensagemDaIda, numeroDoWhatsApp, preencher, valoresDosCampos } from '../../shared/terms'
import { paraBase64url } from '../../../../web/contrato/assinatura/base64url'
import {
  LIMITE_IDA,
  LinkInvalido,
  LinkLongo,
  cpfValido,
  fragmentoDaVolta,
  idDaVolta,
  nomeCompleto,
  termoValido,
  type Termo
} from '../../../../web/contrato/assinatura/formato'
import { assinaturaMinima, codificar } from '../../../../web/contrato/assinatura/traco'
import { chaveDoCodigo, linkCurto, novoCodigo } from '../links-curtos'
import { lerVolta, montarIda, novaChave, novoEnvio, sha256 } from '../terms/link'
import { getClinic } from './clinic'
import type { Db } from './connection'
import { getPatient } from './patients'

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"

type ModelRow = {
  id: number
  arquivado_em: string | null
  versao: number
  titulo: string
  texto: string
  atualizado_em: string
}

const SELECT_MODELS = `
  SELECT m.id, m.arquivado_em, v.versao, v.titulo, v.texto, v.created_at AS atualizado_em
  FROM term_models m
  JOIN term_versions v ON v.model_id = m.id
   AND v.versao = (SELECT max(versao) FROM term_versions WHERE model_id = m.id)`

function modelFromRow({ arquivado_em, ...row }: ModelRow): TermModel {
  return { ...row, arquivado: arquivado_em !== null }
}

export function listModels(db: Db): TermModel[] {
  const rows = db.prepare(`${SELECT_MODELS} ORDER BY v.titulo COLLATE NOCASE`).all() as ModelRow[]
  return rows.map(modelFromRow)
}

export function getModel(db: Db, id: number): TermModel {
  const row = db.prepare(`${SELECT_MODELS} WHERE m.id = ?`).get(id) as ModelRow | undefined
  if (!row) throw new Error('Modelo de termo não encontrado')
  return modelFromRow(row)
}

const PACIENTE_DE_MEDIDA = 'Maria Eduarda Fictícia de Albuquerque Souza'

export function measureModel(db: Db, input: TermModelInput): { tamanho: number; limite: number } {
  const clinic = getClinic(db)
  const texto = preencher(
    input.texto,
    valoresDosCampos({
      paciente: PACIENTE_DE_MEDIDA,
      nascimento: '2020-01-01',
      clinica: clinic.nome || 'Clínica',
      profissional: clinic.profissional || 'Profissional',
      registro: clinic.registro,
      data: '2026-01-01'
    })
  )
  try {
    const link = montarIda(
      {
        id: novoEnvio(),
        ate: 2 ** 31,
        cli: { nome: (clinic.nome || 'Clínica').slice(0, 80), whats: '5565999990000' },
        pac: { nome: PACIENTE_DE_MEDIDA, nasc: '2020-01-01' },
        resp: { papel: 'outro', par: 'Responsável legal' },
        mod: { titulo: input.titulo || 'Termo', versao: 999 },
        prof: { nome: clinic.profissional || 'Profissional', reg: clinic.registro },
        txt: texto
      },
      novaChave(),
      Infinity
    )
    return { tamanho: link.length, limite: LIMITE_IDA }
  } catch (erro) {
    if (erro instanceof LinkLongo) return { tamanho: erro.tamanho, limite: LIMITE_IDA }
    throw new Error('O texto do termo não tem conteúdo para mostrar.')
  }
}

export function saveModel(db: Db, id: number | null, input: TermModelInput): TermModel {
  const { tamanho, limite } = measureModel(db, input)
  if (tamanho > limite)
    throw new Error(
      `O texto não cabe no link do WhatsApp (${tamanho} de ${limite} caracteres). Encurte o texto.`
    )
  return db.transaction(() => {
    if (id === null) {
      const created = db.prepare('INSERT INTO term_models DEFAULT VALUES').run()
      const modelId = Number(created.lastInsertRowid)
      db.prepare(
        'INSERT INTO term_versions (model_id, versao, titulo, texto) VALUES (?, 1, ?, ?)'
      ).run(modelId, input.titulo, input.texto)
      return getModel(db, modelId)
    }
    const current = getModel(db, id)
    if (current.titulo === input.titulo && current.texto === input.texto) return current
    db.prepare(
      'INSERT INTO term_versions (model_id, versao, titulo, texto) VALUES (?, ?, ?, ?)'
    ).run(id, current.versao + 1, input.titulo, input.texto)
    return getModel(db, id)
  })()
}

export function setModelArchived(db: Db, id: number, arquivado: boolean): TermModel {
  getModel(db, id)
  db.prepare(`UPDATE term_models SET arquivado_em = ${arquivado ? NOW : 'NULL'} WHERE id = ?`).run(
    id
  )
  return getModel(db, id)
}

type RequestRow = {
  id: number
  envio: string
  patient_id: number
  model_id: number
  titulo: string
  versao: number
  versao_atual: number
  termo: string
  texto_sha256: string
  destino_nome: string
  destino_papel: SignerPapel
  destino_parentesco: string
  destino_cpf: string | null
  destino_numero: string
  prazo: string
  created_at: string
  estado: 'aguardando' | 'cancelado' | 'trocado' | 'assinado'
  estado_em: string | null
  chave: Buffer | null
  link: string | null
  codigo: string | null
  signed_id: number | null
  signed_nome: string | null
  signed_parentesco: string | null
  signed_assinado_em: number | null
  signed_fuso: number | null
  signed_recebido_em: string | null
  signed_resposta: string | null
}

const SELECT_REQUESTS = `
  SELECT r.*, v.model_id, v.titulo, v.versao,
         (SELECT max(versao) FROM term_versions WHERE model_id = v.model_id) AS versao_atual,
         s.id AS signed_id, s.nome AS signed_nome, s.parentesco AS signed_parentesco,
         s.assinado_em AS signed_assinado_em, s.fuso_minutos AS signed_fuso,
         s.recebido_em AS signed_recebido_em, s.resposta_sha256 AS signed_resposta
  FROM term_requests r
  JOIN term_versions v ON v.id = r.version_id
  LEFT JOIN signed_terms s ON s.request_id = r.id`

function requestFromRow(row: RequestRow, now: Date): TermRequest {
  const vencido = row.estado === 'aguardando' && row.prazo < now.toISOString()
  return {
    id: row.id,
    patient_id: row.patient_id,
    model_id: row.model_id,
    titulo: row.titulo,
    versao: row.versao,
    versao_atual: row.versao_atual,
    destino_nome: row.destino_nome,
    destino_papel: row.destino_papel,
    destino_parentesco: row.destino_parentesco,
    destino_numero: row.destino_numero,
    prazo: row.prazo,
    created_at: row.created_at,
    estado: vencido ? 'vencido' : row.estado,
    estado_em: vencido ? row.prazo : row.estado_em,
    assinado:
      row.signed_id === null
        ? null
        : {
            id: row.signed_id,
            nome: row.signed_nome ?? '',
            parentesco: row.signed_parentesco ?? '',
            assinado_em: row.signed_assinado_em ?? 0,
            fuso_minutos: row.signed_fuso ?? 0,
            recebido_em: row.signed_recebido_em ?? ''
          }
  }
}

function requestRow(db: Db, where: string, value: number | string): RequestRow | undefined {
  return db.prepare(`${SELECT_REQUESTS} WHERE ${where}`).get(value) as RequestRow | undefined
}

function getRequest(db: Db, id: number, now: Date): TermRequest {
  const row = requestRow(db, 'r.id = ?', id)
  if (!row) throw new Error('Envio de termo não encontrado')
  return requestFromRow(row, now)
}

export function listPatientTerms(db: Db, patientId: number, now: Date = new Date()): TermRequest[] {
  const rows = db
    .prepare(`${SELECT_REQUESTS} WHERE r.patient_id = ? ORDER BY r.created_at DESC, r.id DESC`)
    .all(patientId) as RequestRow[]
  return rows.map((row) => requestFromRow(row, now))
}

function forgetExpiredKeys(db: Db, now: Date): void {
  db.prepare(
    `UPDATE term_requests SET chave = NULL, link = NULL, codigo = NULL
     WHERE estado = 'aguardando' AND chave IS NOT NULL AND prazo < ?`
  ).run(now.toISOString())
}

function missingClinicData(clinic: ReturnType<typeof getClinic>): string[] {
  const missing: string[] = []
  if (!clinic.nome) missing.push('o nome da clínica')
  if (!clinic.whatsapp) missing.push('o WhatsApp da clínica')
  if (!clinic.profissional) missing.push('o profissional responsável')
  return missing
}

export function sendTerm(
  db: Db,
  patientId: number,
  input: TermSendInput,
  computador: string,
  now: Date = new Date()
): TermSendResult {
  return db.transaction(() => {
    forgetExpiredKeys(db, now)
    const clinic = getClinic(db)
    const missing = missingClinicData(clinic)
    if (missing.length > 0)
      throw new Error(`Para enviar termos, preencha na tela Clínica: ${missing.join(', ')}.`)
    const patient = getPatient(db, patientId)
    if (!patient.data_nascimento)
      throw new Error('Preencha a data de nascimento do paciente na ficha.')
    const model = getModel(db, input.model_id)
    if (model.arquivado) throw new Error('Este modelo de termo está arquivado.')
    const version = db
      .prepare('SELECT id FROM term_versions WHERE model_id = ? AND versao = ?')
      .get(model.id, model.versao) as { id: number }

    const { papel } = input.destino
    const texto = preencher(
      model.texto,
      valoresDosCampos({
        paciente: patient.nome,
        nascimento: patient.data_nascimento,
        clinica: clinic.nome,
        profissional: clinic.profissional,
        registro: clinic.registro,
        data: toIsoDate(now)
      })
    )
    const prazo = addDays(now, input.dias)
    const termo: Termo = termoValido({
      id: novoEnvio(),
      ate: Math.floor(prazo.getTime() / 1000),
      cli: { nome: clinic.nome.slice(0, 80), whats: numeroDoWhatsApp(clinic.whatsapp) },
      pac: { nome: patient.nome, nasc: patient.data_nascimento },
      resp: papel === 'outro' ? { papel, par: input.destino.parentesco } : { papel },
      mod: { titulo: model.titulo, versao: model.versao },
      prof: { nome: clinic.profissional, reg: clinic.registro },
      txt: texto
    })
    const codigo = novoCodigo()
    const chave = chaveDoCodigo(codigo)
    const link = montarIda(termo, chave)

    db.prepare(
      `UPDATE term_requests SET estado = 'trocado', estado_em = ${NOW}, chave = NULL, link = NULL, codigo = NULL
       WHERE patient_id = ? AND estado = 'aguardando'
         AND version_id IN (SELECT id FROM term_versions WHERE model_id = ?)`
    ).run(patientId, model.id)
    const numero = numeroDoWhatsApp(input.destino.celular)
    const created = db
      .prepare(
        `INSERT INTO term_requests (envio, patient_id, version_id, termo, texto_sha256, destino_nome,
           destino_papel, destino_parentesco, destino_cpf, destino_numero, prazo, computador,
           chave, link, codigo)
         VALUES (@envio, @patient_id, @version_id, @termo, @texto_sha256, @destino_nome,
           @destino_papel, @destino_parentesco, @destino_cpf, @destino_numero, @prazo, @computador,
           @chave, @link, @codigo)`
      )
      .run({
        envio: termo.id,
        patient_id: patientId,
        version_id: version.id,
        termo: JSON.stringify(termo),
        texto_sha256: sha256(termo.txt),
        destino_nome: input.destino.nome,
        destino_papel: input.destino.papel,
        destino_parentesco: input.destino.parentesco,
        destino_cpf: input.destino.cpf ? onlyDigits(input.destino.cpf) : null,
        destino_numero: numero,
        prazo: prazo.toISOString(),
        computador,
        chave,
        link,
        codigo
      })
    const request = getRequest(db, Number(created.lastInsertRowid), now)
    return { request, ...linkOf(request, termo, link, codigo) }
  })()
}

function linkOf(request: TermRequest, termo: Termo, link: string, codigo: string | null): TermLink {
  const mensagem = (endereco: string): string =>
    mensagemDaIda({
      destino: request.destino_nome,
      titulo: request.titulo,
      paciente: termo.pac.nome.trim().split(/\s+/)[0],
      clinica: termo.cli.nome,
      link: endereco
    })
  return {
    link,
    numero: request.destino_numero,
    mensagem: mensagem(link),
    ...(codigo && { curto: linkCurto(link, codigo, termo.ate, mensagem) })
  }
}

export function termLink(db: Db, requestId: number, now: Date = new Date()): TermLink {
  const row = requestRow(db, 'r.id = ?', requestId)
  if (!row) throw new Error('Envio de termo não encontrado')
  const request = requestFromRow(row, now)
  if (request.estado !== 'aguardando' || !row.link)
    throw new Error('Este envio não está mais aguardando assinatura.')
  return linkOf(request, JSON.parse(row.termo) as Termo, row.link, row.codigo)
}

export function cancelTerm(db: Db, requestId: number, now: Date = new Date()): TermRequest {
  const request = getRequest(db, requestId, now)
  if (request.estado !== 'aguardando' && request.estado !== 'vencido')
    throw new Error('Este envio não está mais aguardando assinatura.')
  db.prepare(
    `UPDATE term_requests SET estado = 'cancelado', estado_em = ${NOW}, chave = NULL, link = NULL, codigo = NULL
     WHERE id = ?`
  ).run(requestId)
  return getRequest(db, requestId, now)
}

const PARENTESCO_DO_PAPEL: Record<Exclude<SignerPapel, 'outro'>, string> = {
  paciente: 'Próprio paciente',
  mae: 'Mãe',
  pai: 'Pai'
}

const PAPEL_NA_FRASE: Record<SignerPapel, string> = {
  paciente: 'o próprio paciente',
  mae: 'a mãe',
  pai: 'o pai',
  outro: 'o responsável'
}

const brDate = (iso: string): string => format(new Date(iso), 'dd/MM')

const fail = (erro: string, guardado: number | null = null): TermCheck => ({
  ok: false,
  erro,
  guardado
})

const INCOMPLETA = 'A resposta chegou incompleta. Peça para enviar de novo pelo mesmo link.'

type Opened = Extract<TermCheck, { ok: true }> & {
  row: RequestRow
  fragmento: string
  assinatura: Uint8Array
}

function openResponse(db: Db, texto: string, now: Date): Opened | TermCheck {
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
  const row = requestRow(db, 'r.envio = ?', envio)
  if (!row) return fail('Esta resposta não é de um termo enviado por este Auri.')
  if (row.estado === 'assinado') {
    return row.signed_resposta === sha256(fragmento)
      ? fail('Este termo já está guardado.', row.signed_id)
      : fail(`Este termo já foi assinado em ${brDate(row.signed_recebido_em ?? row.created_at)}.`)
  }
  if (row.estado === 'cancelado') return fail('Este envio foi cancelado. Envie o termo de novo.')
  if (row.estado === 'trocado') return fail('Este link foi trocado por um envio mais novo.')
  if (row.prazo < now.toISOString())
    return fail(`Este link venceu em ${brDate(row.prazo)}. Envie o termo de novo.`)
  if (!row.chave) return fail(INCOMPLETA)

  let volta: ReturnType<typeof lerVolta>
  try {
    volta = lerVolta(fragmento, row.chave)
  } catch {
    return fail(INCOMPLETA)
  }
  const r = volta.resposta
  if (r.h !== row.texto_sha256) return fail('O texto assinado não é o que foi enviado.')
  if (!nomeCompleto(r.nome)) return fail('Falta o nome completo de quem assinou.')
  if (!cpfValido(r.cpf)) return fail('O CPF de quem assinou não é válido.')
  if (assinaturaMinima(volta.assinatura)) return fail('A assinatura chegou vazia.')

  const parentesco = r.rel === 'outro' ? (r.par ?? 'Responsável legal') : PARENTESCO_DO_PAPEL[r.rel]
  const avisos: string[] = []
  if (row.destino_cpf && row.destino_cpf !== r.cpf)
    avisos.push(`O CPF não é o de ${row.destino_nome} na ficha. Confira quem assinou.`)
  if (r.rel !== row.destino_papel)
    avisos.push(
      `O termo foi enviado para ${PAPEL_NA_FRASE[row.destino_papel]}, e quem assinou foi ${PAPEL_NA_FRASE[r.rel]}.`
    )
  const diferenca = Math.abs(r.em * 1000 - now.getTime()) / 60_000
  if (diferenca > 10 && r.em * 1000 > now.getTime())
    avisos.push('A hora do celular estava adiantada. Confira a hora da assinatura.')

  const assinatura = codificar(volta.assinatura)
  const patient = getPatient(db, row.patient_id)
  return {
    ok: true,
    request: requestFromRow(row, now),
    patient_nome: patient.nome,
    resposta: {
      nome: r.nome,
      cpf: r.cpf,
      papel: r.rel,
      parentesco,
      assinado_em: r.em,
      fuso_minutos: r.tz
    },
    traco: paraBase64url(assinatura),
    avisos,
    row,
    fragmento,
    assinatura
  }
}

export function checkResponse(db: Db, texto: string, now: Date = new Date()): TermCheck {
  const opened = openResponse(db, texto, now)
  if (!opened.ok) return opened
  const { row: _row, fragmento: _fragmento, assinatura: _assinatura, ...check } = opened as Opened
  return check
}

export function canonicalTerm(
  termo: Termo,
  signer: Extract<TermCheck, { ok: true }>['resposta'],
  traco: string,
  recebido_em: string,
  destino_numero: string
): string {
  return JSON.stringify({
    envio: termo.id,
    texto_sha256: sha256(termo.txt),
    texto: termo.txt,
    modelo: termo.mod,
    clinica: termo.cli.nome,
    paciente: termo.pac,
    assinou: {
      nome: signer.nome,
      cpf: signer.cpf,
      papel: signer.papel,
      parentesco: signer.parentesco
    },
    traco,
    assinado_em: signer.assinado_em,
    fuso_minutos: signer.fuso_minutos,
    recebido_em,
    destino_numero
  })
}

export function acceptResponse(
  db: Db,
  texto: string,
  computador: string,
  now: Date = new Date()
): TermRequest {
  return db.transaction(() => {
    const opened = openResponse(db, texto, now)
    if (!opened.ok) throw new Error(opened.erro)
    const { row, fragmento, assinatura, resposta, traco } = opened as Opened
    const recebido_em = now.toISOString()
    const termo = JSON.parse(row.termo) as Termo
    db.prepare(
      `INSERT INTO signed_terms (request_id, patient_id, nome, cpf, papel, parentesco, traco,
         assinado_em, fuso_minutos, recebido_em, computador, resposta_sha256, registro_sha256)
       VALUES (@request_id, @patient_id, @nome, @cpf, @papel, @parentesco, @traco, @assinado_em,
         @fuso_minutos, @recebido_em, @computador, @resposta_sha256, @registro_sha256)`
    ).run({
      request_id: row.id,
      patient_id: row.patient_id,
      nome: resposta.nome,
      cpf: resposta.cpf,
      papel: resposta.papel,
      parentesco: resposta.parentesco,
      traco: Buffer.from(assinatura),
      assinado_em: resposta.assinado_em,
      fuso_minutos: resposta.fuso_minutos,
      recebido_em,
      computador,
      resposta_sha256: sha256(fragmento),
      registro_sha256: sha256(
        canonicalTerm(termo, resposta, traco, recebido_em, row.destino_numero)
      )
    })
    db.prepare(
      `UPDATE term_requests SET estado = 'assinado', estado_em = ?, chave = NULL, link = NULL, codigo = NULL
       WHERE id = ?`
    ).run(recebido_em, row.id)
    return getRequest(db, row.id, now)
  })()
}

type SignedRow = {
  id: number
  nome: string
  cpf: string
  parentesco: string
  traco: Buffer
  assinado_em: number
  fuso_minutos: number
  recebido_em: string
  registro_sha256: string
  termo: string
  texto_sha256: string
  destino_numero: string
  enviado_em: string
}

export function signedTermRecord(db: Db, signedId: number): SignedTermRecord {
  const row = db
    .prepare(
      `SELECT s.id, s.nome, s.cpf, s.parentesco, s.traco, s.assinado_em, s.fuso_minutos,
              s.recebido_em, s.registro_sha256, r.termo, r.texto_sha256, r.destino_numero,
              r.created_at AS enviado_em
       FROM signed_terms s JOIN term_requests r ON r.id = s.request_id
       WHERE s.id = ?`
    )
    .get(signedId) as SignedRow | undefined
  if (!row) throw new Error('Termo assinado não encontrado')
  const termo = JSON.parse(row.termo) as Termo
  return {
    id: row.id,
    envio: termo.id,
    titulo: termo.mod.titulo,
    versao: termo.mod.versao,
    texto: termo.txt,
    texto_sha256: row.texto_sha256,
    clinica: termo.cli.nome,
    profissional: { nome: termo.prof.nome, registro: termo.prof.reg },
    paciente: { nome: termo.pac.nome, nascimento: termo.pac.nasc },
    nome: row.nome,
    cpf: row.cpf,
    parentesco: row.parentesco,
    traco: paraBase64url(new Uint8Array(row.traco)),
    assinado_em: row.assinado_em,
    fuso_minutos: row.fuso_minutos,
    recebido_em: row.recebido_em,
    enviado_em: row.enviado_em,
    destino_numero: row.destino_numero,
    registro_sha256: row.registro_sha256,
    logo: getClinic(db).logo
  }
}
