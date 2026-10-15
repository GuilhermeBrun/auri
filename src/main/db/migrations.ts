import type Database from 'better-sqlite3'

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

/**
 * Cada item é uma versão do banco. Nunca altere uma migration já publicada:
 * acrescente uma nova no final. A versão atual fica em PRAGMA user_version.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE patients (
    id              INTEGER PRIMARY KEY,
    nome            TEXT NOT NULL,
    data_nascimento TEXT,
    cpf             TEXT,
    escola          TEXT,
    serie           TEXT,
    professora      TEXT,
    mae_nome        TEXT,
    mae_cpf         TEXT,
    mae_rg          TEXT,
    mae_celular     TEXT,
    mae_email       TEXT,
    mae_profissao   TEXT,
    pai_nome        TEXT,
    pai_profissao   TEXT,
    endereco        TEXT,
    bairro          TEXT,
    cidade          TEXT,
    indicacao       TEXT,
    pediatra        TEXT,
    data_entrada    TEXT,
    observacoes     TEXT,
    ativo           INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT ${NOW},
    updated_at      TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE appointments (
    id          INTEGER PRIMARY KEY,
    patient_id  INTEGER NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    inicio      TEXT NOT NULL,
    fim         TEXT NOT NULL,
    observacao  TEXT,
    created_at  TEXT NOT NULL DEFAULT ${NOW},
    updated_at  TEXT NOT NULL DEFAULT ${NOW},
    CHECK (fim > inicio)
  );

  CREATE INDEX appointments_inicio ON appointments (inicio);
  CREATE INDEX appointments_patient ON appointments (patient_id);
  `,
  // Registro da sessão (tipo, presença e evolução) e anamnese
  `
  ALTER TABLE appointments ADD COLUMN tipo TEXT NOT NULL DEFAULT 'sessao'
    CHECK (tipo IN ('sessao', 'avaliacao'));
  ALTER TABLE appointments ADD COLUMN presenca TEXT
    CHECK (presenca IN ('presente', 'falta', 'desmarcou'));
  ALTER TABLE appointments ADD COLUMN evolucao TEXT;

  CREATE TABLE anamneses (
    patient_id      INTEGER PRIMARY KEY REFERENCES patients (id) ON DELETE RESTRICT,
    data            TEXT,
    queixa          TEXT,
    gestacao        TEXT,
    alimentacao     TEXT,
    sono            TEXT,
    desenvolvimento TEXT,
    saude           TEXT,
    rotina          TEXT,
    terapias        TEXT,
    observacoes     TEXT,
    created_at      TEXT NOT NULL DEFAULT ${NOW},
    updated_at      TEXT NOT NULL DEFAULT ${NOW}
  );
  `
]

export function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > MIGRATIONS.length) {
    throw new Error(
      `O banco de dados é de uma versão mais nova do Auri (v${current}). Atualize o aplicativo.`
    )
  }
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version])
      db.pragma(`user_version = ${version + 1}`)
    })()
  }
}

export const SCHEMA_VERSION = MIGRATIONS.length
