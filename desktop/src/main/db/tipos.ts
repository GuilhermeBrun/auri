import {
  etiquetaInputSchema,
  mesmoNome,
  tipoInputSchema,
  type Etiqueta,
  type EtiquetaInput,
  type TipoAtendimento,
  type TipoInput
} from '../../shared/tipos'
import type { Db } from './connection'

export const TIPO_COLUMNS = `t.id AS tipo_id, t.nome AS tipo_nome, t.cor AS tipo_cor,
         t.categoria AS categoria`

export const TIPO_JOIN = 'JOIN appointment_types t ON t.id = a.tipo_id'

const ORDEM_CATEGORIA = `CASE categoria WHEN 'sessao' THEN 0 WHEN 'avaliacao' THEN 1 ELSE 2 END`

type TipoRow = Omit<TipoAtendimento, 'arquivado'> & { arquivado_em: string | null }
type EtiquetaRow = Omit<Etiqueta, 'arquivado'> & { arquivado_em: string | null }

function ativo<T extends { arquivado_em: string | null }>({
  arquivado_em,
  ...rest
}: T): Omit<T, 'arquivado_em'> & { arquivado: boolean } {
  return { ...rest, arquivado: arquivado_em !== null }
}

export function listTipos(db: Db): TipoAtendimento[] {
  const rows = db
    .prepare(
      `SELECT id, nome, categoria, cor, duracao, arquivado_em FROM appointment_types
       ORDER BY arquivado_em IS NOT NULL, ${ORDEM_CATEGORIA}, id`
    )
    .all() as TipoRow[]
  return rows.map(ativo)
}

export function getTipo(db: Db, id: number): TipoAtendimento {
  const row = db
    .prepare(
      'SELECT id, nome, categoria, cor, duracao, arquivado_em FROM appointment_types WHERE id = ?'
    )
    .get(id) as TipoRow | undefined
  if (!row) throw new Error('Tipo de atendimento não encontrado')
  return ativo(row)
}

function assertNomeLivre<T extends { id: number; nome: string; arquivado: boolean }>(
  lista: T[],
  nome: string,
  id: number | null,
  mensagem: string
): void {
  if (lista.some((item) => item.id !== id && !item.arquivado && mesmoNome(item.nome, nome))) {
    throw new Error(mensagem)
  }
}

export function saveTipo(db: Db, id: number | null, input: TipoInput): TipoAtendimento {
  const tipo = tipoInputSchema.parse(input)
  return db.transaction(() => {
    assertNomeLivre(listTipos(db), tipo.nome, id, `Já existe um tipo chamado “${tipo.nome}”.`)
    if (id === null) {
      const result = db
        .prepare(
          `INSERT INTO appointment_types (nome, categoria, cor, duracao)
           VALUES (@nome, @categoria, @cor, @duracao)`
        )
        .run(tipo)
      return getTipo(db, Number(result.lastInsertRowid))
    }
    if (getTipo(db, id).categoria !== tipo.categoria) {
      throw new Error('A categoria de um tipo não muda.')
    }
    db.prepare(
      'UPDATE appointment_types SET nome = @nome, cor = @cor, duracao = @duracao WHERE id = @id'
    ).run({ ...tipo, id })
    return getTipo(db, id)
  })()
}

export function archiveTipo(db: Db, id: number, arquivado: boolean): TipoAtendimento {
  return db.transaction(() => {
    const tipo = getTipo(db, id)
    if (arquivado) {
      const outros = listTipos(db).filter((t) => t.id !== id && !t.arquivado)
      if (outros.length === 0) throw new Error('Deixe pelo menos um tipo de atendimento ativo.')
    } else {
      assertNomeLivre(listTipos(db), tipo.nome, id, `Já existe um tipo chamado “${tipo.nome}”.`)
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
      `SELECT id FROM appointment_types WHERE arquivado_em IS NULL
       ORDER BY categoria <> 'sessao', id LIMIT 1`
    )
    .get() as { id: number } | undefined
  if (!row) throw new Error('Cadastre um tipo de atendimento na tela Clínica.')
  return row.id
}

export function assertTipoUsavel(db: Db, id: number): TipoAtendimento {
  const tipo = getTipo(db, id)
  if (tipo.arquivado) throw new Error(`O tipo “${tipo.nome}” foi arquivado. Escolha outro.`)
  return tipo
}

export function listEtiquetas(db: Db): Etiqueta[] {
  const rows = db
    .prepare(
      `SELECT id, nome, cor, arquivado_em FROM tags
       ORDER BY arquivado_em IS NOT NULL, nome COLLATE NOCASE, id`
    )
    .all() as EtiquetaRow[]
  return rows.map(ativo)
}

function getEtiqueta(db: Db, id: number): Etiqueta {
  const row = db.prepare('SELECT id, nome, cor, arquivado_em FROM tags WHERE id = ?').get(id) as
    | EtiquetaRow
    | undefined
  if (!row) throw new Error('Etiqueta não encontrada')
  return ativo(row)
}

export function saveEtiqueta(db: Db, id: number | null, input: EtiquetaInput): Etiqueta {
  const etiqueta = etiquetaInputSchema.parse(input)
  return db.transaction(() => {
    assertNomeLivre(
      listEtiquetas(db),
      etiqueta.nome,
      id,
      `Já existe uma etiqueta chamada “${etiqueta.nome}”.`
    )
    if (id === null) {
      const result = db.prepare('INSERT INTO tags (nome, cor) VALUES (@nome, @cor)').run(etiqueta)
      return getEtiqueta(db, Number(result.lastInsertRowid))
    }
    getEtiqueta(db, id)
    db.prepare('UPDATE tags SET nome = @nome, cor = @cor WHERE id = @id').run({ ...etiqueta, id })
    return getEtiqueta(db, id)
  })()
}

export function archiveEtiqueta(db: Db, id: number, arquivado: boolean): Etiqueta {
  return db.transaction(() => {
    const etiqueta = getEtiqueta(db, id)
    if (!arquivado) {
      assertNomeLivre(
        listEtiquetas(db),
        etiqueta.nome,
        id,
        `Já existe uma etiqueta chamada “${etiqueta.nome}”.`
      )
    }
    db.prepare(
      `UPDATE tags
       SET arquivado_em = CASE WHEN @arquivado = 1
         THEN coalesce(arquivado_em, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) END
       WHERE id = @id`
    ).run({ id, arquivado: Number(arquivado) })
    return getEtiqueta(db, id)
  })()
}

export function setAppointmentEtiquetas(
  db: Db,
  appointmentId: number,
  ids: readonly number[],
  antes: readonly number[] = []
): void {
  const unicos = [...new Set(ids)]
  for (const id of unicos) {
    const etiqueta = getEtiqueta(db, id)
    if (etiqueta.arquivado && !antes.includes(id)) {
      throw new Error(`A etiqueta “${etiqueta.nome}” foi arquivada.`)
    }
  }
  db.prepare('DELETE FROM appointment_tags WHERE appointment_id = ?').run(appointmentId)
  const insert = db.prepare('INSERT INTO appointment_tags (appointment_id, tag_id) VALUES (?, ?)')
  for (const id of unicos) insert.run(appointmentId, id)
}
