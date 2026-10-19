import type Database from 'better-sqlite3'
import { parseSerie } from '../../shared/serie'

type Migration = string | ((db: Database.Database) => void)

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

const MIGRATIONS: Migration[] = [
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
  `,
  `
  CREATE TABLE term_models (
    id           INTEGER PRIMARY KEY,
    arquivado_em TEXT,
    created_at   TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE term_versions (
    id         INTEGER PRIMARY KEY,
    model_id   INTEGER NOT NULL REFERENCES term_models (id) ON DELETE RESTRICT,
    versao     INTEGER NOT NULL CHECK (versao >= 1),
    titulo     TEXT NOT NULL CHECK (length(trim(titulo)) > 0),
    texto      TEXT NOT NULL CHECK (length(trim(texto)) > 0),
    created_at TEXT NOT NULL DEFAULT ${NOW},
    UNIQUE (model_id, versao)
  );

  CREATE TABLE term_requests (
    id                 INTEGER PRIMARY KEY,
    envio              TEXT NOT NULL UNIQUE,
    patient_id         INTEGER NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    version_id         INTEGER NOT NULL REFERENCES term_versions (id) ON DELETE RESTRICT,
    termo              TEXT NOT NULL,
    texto_sha256       TEXT NOT NULL,
    destino_nome       TEXT NOT NULL,
    destino_papel      TEXT NOT NULL CHECK (destino_papel IN ('paciente', 'mae', 'pai', 'outro')),
    destino_parentesco TEXT NOT NULL,
    destino_cpf        TEXT,
    destino_numero     TEXT NOT NULL,
    prazo              TEXT NOT NULL,
    computador         TEXT NOT NULL,
    chave              BLOB,
    link               TEXT,
    estado             TEXT NOT NULL DEFAULT 'aguardando'
      CHECK (estado IN ('aguardando', 'cancelado', 'trocado', 'assinado')),
    estado_em          TEXT,
    created_at         TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE INDEX term_requests_patient ON term_requests (patient_id);

  CREATE TABLE signed_terms (
    id               INTEGER PRIMARY KEY,
    request_id       INTEGER NOT NULL UNIQUE REFERENCES term_requests (id) ON DELETE RESTRICT,
    patient_id       INTEGER NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    nome             TEXT NOT NULL,
    cpf              TEXT NOT NULL,
    papel            TEXT NOT NULL CHECK (papel IN ('paciente', 'mae', 'pai', 'outro')),
    parentesco       TEXT NOT NULL,
    traco            BLOB NOT NULL,
    assinado_em      INTEGER NOT NULL,
    fuso_minutos     INTEGER NOT NULL,
    recebido_em      TEXT NOT NULL,
    computador       TEXT NOT NULL,
    resposta_sha256  TEXT NOT NULL,
    registro_sha256  TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE INDEX signed_terms_patient ON signed_terms (patient_id);

  CREATE TRIGGER term_versions_no_update
  BEFORE UPDATE ON term_versions
  BEGIN
    SELECT RAISE(ABORT, 'Uma versão de termo não pode ser alterada.');
  END;

  CREATE TRIGGER term_versions_no_delete
  BEFORE DELETE ON term_versions
  BEGIN
    SELECT RAISE(ABORT, 'Uma versão de termo não pode ser apagada.');
  END;

  CREATE TRIGGER term_requests_content_locked
  BEFORE UPDATE OF envio, patient_id, version_id, termo, texto_sha256, destino_nome, destino_papel,
    destino_parentesco, destino_cpf, destino_numero, prazo, computador, created_at ON term_requests
  BEGIN
    SELECT RAISE(ABORT, 'O conteúdo de um envio não muda.');
  END;

  CREATE TRIGGER term_requests_signed_locked
  BEFORE UPDATE OF estado ON term_requests
  WHEN OLD.estado <> 'aguardando'
  BEGIN
    SELECT RAISE(ABORT, 'Este envio já foi concluído.');
  END;

  CREATE TRIGGER term_requests_no_delete
  BEFORE DELETE ON term_requests
  BEGIN
    SELECT RAISE(ABORT, 'Um envio de termo não pode ser apagado.');
  END;

  CREATE TRIGGER signed_terms_no_update
  BEFORE UPDATE ON signed_terms
  BEGIN
    SELECT RAISE(ABORT, 'Um termo assinado não pode ser alterado.');
  END;

  CREATE TRIGGER signed_terms_no_delete
  BEFORE DELETE ON signed_terms
  BEGIN
    SELECT RAISE(ABORT, 'Um termo assinado não pode ser apagado.');
  END;
  `,
  (db) => {
    db.exec(`
    ALTER TABLE patients ADD COLUMN rg TEXT;
    ALTER TABLE patients ADD COLUMN uf TEXT CHECK (length(uf) = 2);
    ALTER TABLE patients ADD COLUMN serie_numero TEXT
      CHECK (serie_numero GLOB '[1-9]' OR serie_numero GLOB '[1-9][0-9]');
    ALTER TABLE patients ADD COLUMN serie_tipo TEXT CHECK (serie_tipo IN ('ano', 'serie', 'grau'));
    ALTER TABLE patients ADD COLUMN serie_etapa TEXT
      CHECK (serie_etapa IN ('infantil', 'fundamental', 'medio'));
    ALTER TABLE patients ADD COLUMN contato_principal TEXT
      CHECK (contato_principal IN ('mae', 'pai', 'responsavel', 'paciente'));

    CREATE TABLE patient_activities (
      id         INTEGER PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
      atividade  TEXT NOT NULL,
      dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
      inicio     TEXT NOT NULL,
      fim        TEXT NOT NULL,
      CHECK (fim > inicio)
    );

    CREATE INDEX patient_activities_patient ON patient_activities (patient_id);
    `)
    const rows = db
      .prepare("SELECT id, serie FROM patients WHERE trim(coalesce(serie, '')) <> ''")
      .all() as { id: number; serie: string }[]
    const update = db.prepare(
      `UPDATE patients SET serie_numero = @serie_numero, serie_tipo = @serie_tipo,
         serie_etapa = @serie_etapa, serie = NULL
       WHERE id = @id`
    )
    for (const row of rows) {
      const parsed = parseSerie(row.serie)
      if (parsed) update.run({ ...parsed, serie_etapa: parsed.serie_etapa || null, id: row.id })
    }
  },
  `
  CREATE TABLE clinic_hours (
    dia_semana INTEGER PRIMARY KEY CHECK (dia_semana BETWEEN 0 AND 6),
    abre       TEXT NOT NULL CHECK (abre GLOB '[0-2][0-9]:[0-5][0-9]'),
    fecha      TEXT NOT NULL CHECK (fecha GLOB '[0-2][0-9]:[0-5][0-9]'),
    CHECK (fecha > abre)
  );

  INSERT INTO clinic_hours (dia_semana, abre, fecha) VALUES
    (1, '07:00', '20:00'),
    (2, '07:00', '20:00'),
    (3, '07:00', '20:00'),
    (4, '07:00', '20:00'),
    (5, '07:00', '20:00'),
    (6, '07:00', '12:00');

  ALTER TABLE appointments ADD COLUMN confirmado_em TEXT;
  `
]

export class DatabaseTooNewError extends Error {
  override name = 'DatabaseTooNewError'

  constructor(version: number) {
    super(
      `O banco de dados é de uma versão mais nova do Auri (v${version}). Atualize o aplicativo.`
    )
  }
}

export function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > MIGRATIONS.length) {
    throw new DatabaseTooNewError(current)
  }
  for (let version = current; version < MIGRATIONS.length; version++) {
    const migration = MIGRATIONS[version]
    db.transaction(() => {
      if (typeof migration === 'string') db.exec(migration)
      else migration(db)
      db.pragma(`user_version = ${version + 1}`)
    })()
  }
}

export const SCHEMA_VERSION = MIGRATIONS.length
