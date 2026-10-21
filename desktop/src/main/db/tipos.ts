import { toIsoLocalDateTime } from '../../shared/dates'
import {
  CATEGORIA_LABELS,
  ehPrincipal,
  mesmoNome,
  tipoInputSchema,
  type CategoriaEtiqueta,
  type TipoAtendimento,
  type TipoInput
} from '../../shared/tipos'
import type { Db } from './connection'

export const TIPO_COLUMNS = `t.id AS tipo_id, t.nome AS tipo_nome, t.cor AS tipo_cor,
         coalesce(a.categoria, t.categoria) AS categoria`

export const TIPO_JOIN = 'JOIN appointment_types t ON t.id = a.tipo_id'

const ORDEM_CATEGORIA = `CASE categoria WHEN 'sessao' THEN 0 WHEN 'avaliacao' THEN 1
  WHEN 'exame' THEN 2 WHEN 'compromisso' THEN 3 ELSE 4 END`

const COLUNAS = 'id, nome, categoria, cor, duracao, sistema, arquivado_em'

type TipoRow = Omit<TipoAtendimento, 'arquivado'> & { arquivado_em: string | null }

function ativo({ arquivado_em, ...rest }: TipoRow): TipoAtendimento {
  return { ...rest, arquivado: arquivado_em !== null }
}

export function listTipos(db: Db): TipoAtendimento[] {
  const rows = db
    .prepare(
      `SELECT ${COLUNAS} FROM appointment_types
       ORDER BY arquivado_em IS NOT NULL, ${ORDEM_CATEGORIA}, id`
    )
    .all() as TipoRow[]
  return rows.map(ativo)
}

export function getTipo(db: Db, id: number): TipoAtendimento {
  const row = db.prepare(`SELECT ${COLUNAS} FROM appointment_types WHERE id = ?`).get(id) as
    | TipoRow
    | undefined
  if (!row) throw new Error('Etiqueta não encontrada')
  return ativo(row)
}

function assertNomeLivre(db: Db, nome: string, id: number | null): void {
  if (listTipos(db).some((t) => t.id !== id && !t.arquivado && mesmoNome(t.nome, nome))) {
    throw new Error(`Já existe uma etiqueta chamada “${nome}”.`)
  }
}

const GRUPO = (c: CategoriaEtiqueta): string => (ehPrincipal(c) ? 'principal' : c)

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
  if (tipo.categoria === 'marca') {
    const n = contar(db, 'SELECT count(*) AS n FROM appointment_tags WHERE tag_id = ?', tipo.id)
    return n > 0 ? plural(n, 'agendamento', 'agendamentos') : null
  }
  const n = contar(db, 'SELECT count(*) AS n FROM commitments WHERE etiqueta_id = ?', tipo.id)
  return n > 0 ? plural(n, 'compromisso', 'compromissos') : null
}

function assertUltimoAtivo(db: Db, tipo: TipoAtendimento): void {
  const grupo = GRUPO(tipo.categoria)
  if (grupo === 'marca') return
  const outros = listTipos(db).filter(
    (t) => t.id !== tipo.id && !t.arquivado && GRUPO(t.categoria) === grupo
  )
  if (outros.length > 0) return
  throw new Error(
    grupo === 'principal'
      ? 'Deixe pelo menos uma etiqueta de sessão, avaliação ou exame ativa.'
      : 'Deixe pelo menos uma etiqueta de compromisso ativa.'
  )
}

function assertTrocaDeCategoria(db: Db, atual: TipoAtendimento, nova: CategoriaEtiqueta): void {
  if (atual.categoria === nova || GRUPO(atual.categoria) === GRUPO(nova)) return
  if (atual.sistema === 'reserva') {
    throw new Error('A Reserva é sempre um compromisso.')
  }
  const uso = emUso(db, atual)
  if (uso) {
    throw new Error(
      `“${atual.nome}” está em ${uso}. Para virar ${CATEGORIA_LABELS[nova]}, crie outra etiqueta.`
    )
  }
  if (!atual.arquivado) assertUltimoAtivo(db, atual)
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

export function archiveTipo(db: Db, id: number, arquivado: boolean): TipoAtendimento {
  return db.transaction(() => {
    const tipo = getTipo(db, id)
    if (arquivado) {
      if (!tipo.arquivado) assertUltimoAtivo(db, tipo)
    } else {
      assertNomeLivre(db, tipo.nome, id)
    }
    db.prepare(
      `UPDATE appointment_types
       SET arquivado_em = CASE WHEN @arquivado = 1
         THEN coalesce(arquivado_em, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) END
       WHERE id = @id`
    ).run({ id, arquivado: Number(arquivado) })
    return getTipo(db, id)
  })()
}

export function tipoPadrao(db: Db): number {
  const row = db
    .prepare(
      `SELECT id FROM appointment_types
       WHERE arquivado_em IS NULL AND categoria IN ('sessao', 'avaliacao', 'exame')
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
  if (tipo.arquivado) throw new Error(`A etiqueta “${tipo.nome}” foi arquivada. Escolha outra.`)
  return tipo
}

export function assertCompromissoUsavel(
  db: Db,
  id: number,
  antes: number | null = null
): TipoAtendimento {
  const tipo = getTipo(db, id)
  if (tipo.categoria !== 'compromisso') {
    throw new Error(`“${tipo.nome}” não é uma etiqueta de compromisso.`)
  }
  if (tipo.arquivado && id !== antes) {
    throw new Error(`A etiqueta “${tipo.nome}” foi arquivada. Escolha outra.`)
  }
  return tipo
}

export function setAppointmentEtiquetas(
  db: Db,
  appointmentId: number,
  ids: readonly number[],
  antes: readonly number[] = []
): void {
  const unicos = [...new Set(ids)]
  for (const id of unicos) {
    const etiqueta = getTipo(db, id)
    if (etiqueta.categoria !== 'marca') {
      throw new Error(`“${etiqueta.nome}” não é uma marca.`)
    }
    if (etiqueta.arquivado && !antes.includes(id)) {
      throw new Error(`A etiqueta “${etiqueta.nome}” foi arquivada.`)
    }
  }
  db.prepare('DELETE FROM appointment_tags WHERE appointment_id = ?').run(appointmentId)
  const insert = db.prepare('INSERT INTO appointment_tags (appointment_id, tag_id) VALUES (?, ?)')
  for (const id of unicos) insert.run(appointmentId, id)
}
