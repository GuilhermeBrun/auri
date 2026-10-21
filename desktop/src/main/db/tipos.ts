import { toIsoLocalDateTime } from '../../shared/dates'
import {
  CATEGORIA_LABELS,
  destinosAoExcluir,
  ehPrincipal,
  mesmoGrupo,
  mesmoNome,
  tipoInputSchema,
  type CategoriaEtiqueta,
  type TipoAtendimento,
  type TipoInput,
  type UsoDaEtiqueta
} from '../../shared/tipos'
import type { Db } from './connection'

export const TIPO_COLUMNS = `t.id AS tipo_id, t.nome AS tipo_nome, t.cor AS tipo_cor,
         coalesce(a.categoria, t.categoria) AS categoria`

export const TIPO_JOIN = 'JOIN appointment_types t ON t.id = a.tipo_id'

const ORDEM_CATEGORIA = `CASE categoria WHEN 'sessao' THEN 0 WHEN 'avaliacao' THEN 1
  WHEN 'exame' THEN 2 ELSE 3 END`

const COLUNAS = 'id, nome, categoria, cor, duracao, sistema'

export function listTipos(db: Db): TipoAtendimento[] {
  return db
    .prepare(`SELECT ${COLUNAS} FROM appointment_types ORDER BY ${ORDEM_CATEGORIA}, id`)
    .all() as TipoAtendimento[]
}

export function getTipo(db: Db, id: number): TipoAtendimento {
  const row = db.prepare(`SELECT ${COLUNAS} FROM appointment_types WHERE id = ?`).get(id) as
    | TipoAtendimento
    | undefined
  if (!row) throw new Error('Etiqueta não encontrada')
  return row
}

function assertNomeLivre(db: Db, nome: string, id: number | null): void {
  if (listTipos(db).some((t) => t.id !== id && mesmoNome(t.nome, nome))) {
    throw new Error(`Já existe uma etiqueta chamada “${nome}”.`)
  }
}

function contar(db: Db, sql: string, id: number): number {
  return (db.prepare(sql).get(id) as { n: number }).n
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

function emUso(db: Db, tipo: TipoAtendimento): string | null {
  if (ehPrincipal(tipo.categoria)) {
    const sessoes = contar(db, 'SELECT count(*) AS n FROM appointments WHERE tipo_id = ?', tipo.id)
    if (sessoes > 0) return plural(sessoes, 'agendamento', 'agendamentos')
    const espera = contar(
      db,
      'SELECT count(*) AS n FROM waitlist_entries WHERE tipo_id = ?',
      tipo.id
    )
    return espera > 0 ? 'a fila de espera' : null
  }
  const n = contar(db, 'SELECT count(*) AS n FROM commitments WHERE etiqueta_id = ?', tipo.id)
  return n > 0 ? plural(n, 'compromisso', 'compromissos') : null
}

function assertNaoEUltima(db: Db, tipo: TipoAtendimento): void {
  if (listTipos(db).some((t) => t.id !== tipo.id && mesmoGrupo(t.categoria, tipo.categoria))) {
    return
  }
  throw new Error(
    ehPrincipal(tipo.categoria)
      ? 'Deixe pelo menos uma etiqueta de sessão, avaliação ou exame.'
      : 'Deixe pelo menos uma etiqueta de compromisso.'
  )
}

function assertTrocaDeCategoria(db: Db, atual: TipoAtendimento, nova: CategoriaEtiqueta): void {
  if (mesmoGrupo(atual.categoria, nova)) return
  if (atual.sistema === 'reserva') {
    throw new Error('A Reserva é sempre um compromisso.')
  }
  const uso = emUso(db, atual)
  if (uso) {
    throw new Error(
      `“${atual.nome}” está em ${uso}. Para virar ${CATEGORIA_LABELS[nova]}, crie outra etiqueta.`
    )
  }
  assertNaoEUltima(db, atual)
}

function categoriaDaquiPraFrente(db: Db, id: number, agora: Date): void {
  db.prepare(
    `UPDATE appointments SET categoria = (SELECT categoria FROM appointment_types WHERE id = @id)
     WHERE tipo_id = @id AND inicio >= @agora
       AND NOT EXISTS (SELECT 1 FROM attendance_signatures s WHERE s.appointment_id = appointments.id)
       AND NOT EXISTS (SELECT 1 FROM finance_charges c WHERE c.appointment_id = appointments.id)
       AND NOT EXISTS (SELECT 1 FROM finance_package_uses u WHERE u.appointment_id = appointments.id)`
  ).run({ id, agora: toIsoLocalDateTime(agora) })
}

export function saveTipo(
  db: Db,
  id: number | null,
  input: TipoInput,
  agora: Date = new Date()
): TipoAtendimento {
  const tipo = tipoInputSchema.parse(input)
  return db.transaction(() => {
    assertNomeLivre(db, tipo.nome, id)
    if (id === null) {
      const result = db
        .prepare(
          `INSERT INTO appointment_types (nome, categoria, cor, duracao)
           VALUES (@nome, @categoria, @cor, @duracao)`
        )
        .run(tipo)
      return getTipo(db, Number(result.lastInsertRowid))
    }
    const atual = getTipo(db, id)
    assertTrocaDeCategoria(db, atual, tipo.categoria)
    db.prepare(
      `UPDATE appointment_types
       SET nome = @nome, categoria = @categoria, cor = @cor, duracao = @duracao
       WHERE id = @id`
    ).run({ ...tipo, id })
    if (atual.categoria !== tipo.categoria && ehPrincipal(tipo.categoria)) {
      categoriaDaquiPraFrente(db, id, agora)
    }
    return getTipo(db, id)
  })()
}

export function usoDoTipo(db: Db, id: number): UsoDaEtiqueta {
  getTipo(db, id)
  return db
    .prepare(
      `SELECT (SELECT count(*) FROM appointments WHERE tipo_id = @id) AS agendamentos,
              (SELECT count(*) FROM commitments WHERE etiqueta_id = @id) AS compromissos,
              (SELECT count(*) FROM waitlist_entries
                WHERE tipo_id = @id AND encerrado_em IS NULL) AS espera`
    )
    .get({ id }) as UsoDaEtiqueta
}

function assertDestino(db: Db, tipo: TipoAtendimento, destino: number | null): void {
  const uso = usoDoTipo(db, tipo.id)
  if (destino === null) {
    if (uso.agendamentos + uso.compromissos + uso.espera === 0) return
    throw new Error(`Escolha a etiqueta que fica no lugar de “${tipo.nome}”.`)
  }
  const outra = getTipo(db, destino)
  if (!destinosAoExcluir(listTipos(db), tipo).some((t) => t.id === outra.id)) {
    throw new Error(`“${outra.nome}” não pode ficar no lugar de “${tipo.nome}”.`)
  }
}

export function removeTipo(
  db: Db,
  id: number,
  destino: number | null,
  agora: Date = new Date()
): void {
  db.transaction(() => {
    const tipo = getTipo(db, id)
    if (tipo.sistema === 'reserva') throw new Error('A Reserva não pode ser excluída.')
    assertNaoEUltima(db, tipo)
    assertDestino(db, tipo, destino)
    db.pragma('defer_foreign_keys = ON')
    const categorias = db
      .prepare('SELECT id, categoria FROM appointments WHERE tipo_id = ?')
      .all(id) as { id: number; categoria: string | null }[]
    db.prepare('DELETE FROM appointment_types WHERE id = ?').run(id)
    if (destino !== null) {
      db.prepare('UPDATE appointments SET tipo_id = ? WHERE tipo_id = ?').run(destino, id)
      const manter = db.prepare('UPDATE appointments SET categoria = ? WHERE id = ?')
      for (const a of categorias) manter.run(a.categoria, a.id)
      categoriaDaquiPraFrente(db, destino, agora)
      db.prepare('UPDATE commitments SET etiqueta_id = ? WHERE etiqueta_id = ?').run(destino, id)
    }
    db.prepare('UPDATE waitlist_entries SET tipo_id = ? WHERE tipo_id = ?').run(destino, id)
  })()
}

export function tipoPadrao(db: Db): number {
  const row = db
    .prepare(
      `SELECT id FROM appointment_types
       WHERE categoria IN ('sessao', 'avaliacao', 'exame')
       ORDER BY categoria <> 'sessao', id LIMIT 1`
    )
    .get() as { id: number } | undefined
  if (!row) throw new Error('Cadastre uma etiqueta de sessão na tela Clínica.')
  return row.id
}

export function assertTipoUsavel(db: Db, id: number): TipoAtendimento {
  const tipo = getTipo(db, id)
  if (!ehPrincipal(tipo.categoria)) {
    throw new Error(`“${tipo.nome}” não é uma etiqueta de sessão, avaliação ou exame.`)
  }
  return tipo
}

export function assertCompromissoUsavel(db: Db, id: number): TipoAtendimento {
  const tipo = getTipo(db, id)
  if (tipo.categoria !== 'compromisso') {
    throw new Error(`“${tipo.nome}” não é uma etiqueta de compromisso.`)
  }
  return tipo
}
