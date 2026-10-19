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
  `,
  `
  CREATE TABLE attendance_signatures (
    id                INTEGER PRIMARY KEY,
    appointment_id    INTEGER NOT NULL REFERENCES appointments (id) ON DELETE RESTRICT,
    patient_id        INTEGER NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    signer_nome       TEXT NOT NULL CHECK (length(trim(signer_nome)) > 0),
    signer_papel      TEXT NOT NULL CHECK (signer_papel IN ('paciente', 'mae', 'pai', 'outro')),
    signer_parentesco TEXT NOT NULL,
    traco             BLOB NOT NULL,
    assinado_em       TEXT NOT NULL,
    fuso_minutos      INTEGER NOT NULL,
    computador        TEXT NOT NULL,
    registro_sha256   TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE INDEX attendance_signatures_appointment ON attendance_signatures (appointment_id);
  CREATE INDEX attendance_signatures_patient ON attendance_signatures (patient_id);

  CREATE TABLE attendance_voids (
    signature_id INTEGER PRIMARY KEY REFERENCES attendance_signatures (id) ON DELETE RESTRICT,
    motivo       TEXT NOT NULL CHECK (length(trim(motivo)) > 0),
    computador   TEXT NOT NULL,
    anulado_em   TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TRIGGER attendance_signatures_only_one_active
  BEFORE INSERT ON attendance_signatures
  WHEN EXISTS (
    SELECT 1 FROM attendance_signatures s
    WHERE s.appointment_id = NEW.appointment_id
      AND s.id NOT IN (SELECT signature_id FROM attendance_voids)
  )
  BEGIN
    SELECT RAISE(ABORT, 'Esta sessão já tem a chegada assinada.');
  END;

  CREATE TRIGGER attendance_signatures_no_update
  BEFORE UPDATE ON attendance_signatures
  BEGIN
    SELECT RAISE(ABORT, 'Uma assinatura não pode ser alterada.');
  END;

  CREATE TRIGGER attendance_signatures_no_delete
  BEFORE DELETE ON attendance_signatures
  BEGIN
    SELECT RAISE(ABORT, 'Uma assinatura não pode ser apagada.');
  END;

  CREATE TRIGGER attendance_voids_no_update
  BEFORE UPDATE ON attendance_voids
  BEGIN
    SELECT RAISE(ABORT, 'Uma anulação não pode ser alterada.');
  END;

  CREATE TRIGGER attendance_voids_no_delete
  BEFORE DELETE ON attendance_voids
  BEGIN
    SELECT RAISE(ABORT, 'Uma anulação não pode ser apagada.');
  END;

  CREATE TRIGGER appointments_signed_locked
  BEFORE UPDATE OF patient_id, inicio, fim, tipo, presenca ON appointments
  WHEN (
    NEW.patient_id IS NOT OLD.patient_id OR NEW.inicio IS NOT OLD.inicio
    OR NEW.fim IS NOT OLD.fim OR NEW.tipo IS NOT OLD.tipo OR NEW.presenca IS NOT OLD.presenca
  )
  AND EXISTS (
    SELECT 1 FROM attendance_signatures s
    WHERE s.appointment_id = OLD.id
      AND s.id NOT IN (SELECT signature_id FROM attendance_voids)
  )
  BEGIN
    SELECT RAISE(ABORT, 'A chegada desta sessão foi assinada: paciente, horário, tipo e presença não mudam mais.');
  END;

  CREATE TRIGGER appointments_signed_no_delete
  BEFORE DELETE ON appointments
  WHEN EXISTS (SELECT 1 FROM attendance_signatures s WHERE s.appointment_id = OLD.id)
  BEGIN
    SELECT RAISE(ABORT, 'Esta sessão tem assinatura registrada e não pode ser excluída.');
  END;
  `,
  `
  CREATE TABLE clinic (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    nome         TEXT,
    documento    TEXT,
    endereco     TEXT,
    telefone     TEXT,
    whatsapp     TEXT,
    profissional TEXT,
    registro     TEXT,
    logo         BLOB,
    updated_at   TEXT NOT NULL DEFAULT ${NOW}
  );

  INSERT INTO clinic (id) VALUES (1);
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
