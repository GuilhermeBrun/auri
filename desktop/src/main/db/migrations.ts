import type Database from 'better-sqlite3'

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

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
  `,
  `
  ALTER TABLE patients ADD COLUMN celular TEXT;
  ALTER TABLE patients ADD COLUMN email TEXT;
  ALTER TABLE patients ADD COLUMN pai_cpf TEXT;
  ALTER TABLE patients ADD COLUMN pai_rg TEXT;
  ALTER TABLE patients ADD COLUMN pai_celular TEXT;
  ALTER TABLE patients ADD COLUMN pai_email TEXT;
  ALTER TABLE patients ADD COLUMN resp_tipo TEXT
    CHECK (resp_tipo IN ('mae', 'pai', 'outro'));
  ALTER TABLE patients ADD COLUMN resp_nome TEXT;
  ALTER TABLE patients ADD COLUMN resp_parentesco TEXT
    CHECK (resp_parentesco IN ('avo_f', 'avo_m', 'tia', 'tio', 'outro'));
  ALTER TABLE patients ADD COLUMN resp_parentesco_outro TEXT;
  ALTER TABLE patients ADD COLUMN resp_cpf TEXT;
  ALTER TABLE patients ADD COLUMN resp_rg TEXT;
  ALTER TABLE patients ADD COLUMN resp_celular TEXT;
  ALTER TABLE patients ADD COLUMN resp_email TEXT;
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
