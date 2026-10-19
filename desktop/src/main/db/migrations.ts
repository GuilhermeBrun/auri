import type Database from 'better-sqlite3'
import { parseSerie } from '../../shared/serie'

type Migration = string | ((db: Database.Database) => void)

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

function onlyVoid(table: string, columns: string[]): string {
  const changed = columns.map((c) => `NEW.${c} IS NOT OLD.${c}`).join(' OR ')
  return `
  CREATE TRIGGER ${table}_only_void
  BEFORE UPDATE ON ${table}
  WHEN OLD.estornado_em IS NOT NULL OR NEW.estornado_em IS NULL
    OR length(trim(coalesce(NEW.estorno_motivo, ''))) = 0
    OR length(trim(coalesce(NEW.estorno_computador, ''))) = 0
    OR ${changed}
  BEGIN
    SELECT RAISE(ABORT, 'Um lançamento não muda: só pode ser estornado, uma vez.');
  END;

  CREATE TRIGGER ${table}_no_delete
  BEFORE DELETE ON ${table}
  BEGIN
    SELECT RAISE(ABORT, 'Um lançamento não pode ser apagado: estorne.');
  END;`
}

const VOID_COLUMNS = `
    estornado_em       TEXT,
    estorno_motivo     TEXT,
    estorno_computador TEXT`

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
  `,
  `
  CREATE TABLE waitlist_entries (
    id               INTEGER PRIMARY KEY,
    patient_id       INTEGER NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    tipo             TEXT NOT NULL DEFAULT 'sessao',
    duracao          INTEGER NOT NULL CHECK (duracao BETWEEN 15 AND 240 AND duracao % 15 = 0),
    dias             TEXT NOT NULL DEFAULT '' CHECK (dias NOT GLOB '*[^0-6,]*'),
    periodos         TEXT NOT NULL DEFAULT '',
    prioridade       TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('normal', 'alta')),
    observacao       TEXT,
    encerrado_em     TEXT,
    encerrado_motivo TEXT CHECK (encerrado_motivo IN ('agendado', 'removido')),
    appointment_id   INTEGER REFERENCES appointments (id) ON DELETE SET NULL,
    created_at       TEXT NOT NULL DEFAULT ${NOW},
    updated_at       TEXT NOT NULL DEFAULT ${NOW},
    CHECK ((encerrado_em IS NULL) = (encerrado_motivo IS NULL))
  );

  CREATE UNIQUE INDEX waitlist_entries_open ON waitlist_entries (patient_id)
    WHERE encerrado_em IS NULL;
  `,
  `
  CREATE TABLE finance_services (
    id             INTEGER PRIMARY KEY,
    nome           TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
    arquivado_em   TEXT,
    created_at     TEXT NOT NULL DEFAULT ${NOW},
    updated_at     TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE finance_plans (
    id             INTEGER PRIMARY KEY,
    nome           TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    sessoes        INTEGER NOT NULL CHECK (sessoes BETWEEN 1 AND 100),
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
    validade_dias  INTEGER CHECK (validade_dias BETWEEN 1 AND 730),
    arquivado_em   TEXT,
    created_at     TEXT NOT NULL DEFAULT ${NOW},
    updated_at     TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE finance_insurers (
    id                    INTEGER PRIMARY KEY,
    nome                  TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    valor_sessao_centavos INTEGER NOT NULL CHECK (valor_sessao_centavos >= 0),
    arquivado_em          TEXT,
    created_at            TEXT NOT NULL DEFAULT ${NOW},
    updated_at            TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE finance_billing (
    patient_id  INTEGER PRIMARY KEY REFERENCES patients (id) ON DELETE RESTRICT,
    forma       TEXT NOT NULL CHECK (forma IN ('particular', 'pacote', 'convenio')),
    service_id  INTEGER REFERENCES finance_services (id) ON DELETE RESTRICT,
    insurer_id  INTEGER REFERENCES finance_insurers (id) ON DELETE RESTRICT,
    carteirinha TEXT,
    desde       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT ${NOW},
    updated_at  TEXT NOT NULL DEFAULT ${NOW},
    CHECK (forma = 'convenio' OR service_id IS NOT NULL),
    CHECK (forma <> 'convenio' OR insurer_id IS NOT NULL)
  );

  CREATE TABLE finance_packages (
    id             INTEGER PRIMARY KEY,
    patient_id     INTEGER NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    plan_id        INTEGER REFERENCES finance_plans (id) ON DELETE RESTRICT,
    nome           TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    sessoes        INTEGER NOT NULL CHECK (sessoes >= 1),
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
    inicio         TEXT NOT NULL,
    validade       TEXT CHECK (validade >= inicio),
    computador     TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT ${NOW},${VOID_COLUMNS}
  );

  CREATE INDEX finance_packages_patient ON finance_packages (patient_id);

  CREATE TABLE finance_charges (
    id             INTEGER PRIMARY KEY,
    patient_id     INTEGER NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    data           TEXT NOT NULL,
    descricao      TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
    motivo         TEXT NOT NULL CHECK (motivo IN ('sessao', 'falta_cobrada', 'pacote', 'avulsa')),
    appointment_id INTEGER REFERENCES appointments (id) ON DELETE RESTRICT,
    package_id     INTEGER REFERENCES finance_packages (id) ON DELETE RESTRICT,
    insurer_id     INTEGER REFERENCES finance_insurers (id) ON DELETE RESTRICT,
    computador     TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT ${NOW},${VOID_COLUMNS},
    CHECK ((motivo IN ('sessao', 'falta_cobrada')) = (appointment_id IS NOT NULL)),
    CHECK ((motivo = 'pacote') = (package_id IS NOT NULL))
  );

  CREATE INDEX finance_charges_patient ON finance_charges (patient_id);
  CREATE UNIQUE INDEX finance_charges_one_per_session ON finance_charges (appointment_id)
    WHERE appointment_id IS NOT NULL AND estornado_em IS NULL;

  CREATE TABLE finance_package_uses (
    id             INTEGER PRIMARY KEY,
    package_id     INTEGER NOT NULL REFERENCES finance_packages (id) ON DELETE RESTRICT,
    appointment_id INTEGER NOT NULL REFERENCES appointments (id) ON DELETE RESTRICT,
    computador     TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT ${NOW},${VOID_COLUMNS}
  );

  CREATE INDEX finance_package_uses_package ON finance_package_uses (package_id);
  CREATE UNIQUE INDEX finance_package_uses_one_per_session ON finance_package_uses (appointment_id)
    WHERE estornado_em IS NULL;

  CREATE TABLE finance_payments (
    id             INTEGER PRIMARY KEY,
    patient_id     INTEGER NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
    data           TEXT NOT NULL,
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
    forma          TEXT NOT NULL CHECK (forma IN ('pix', 'dinheiro', 'cartao', 'transferencia')),
    insurer_id     INTEGER REFERENCES finance_insurers (id) ON DELETE RESTRICT,
    observacao     TEXT,
    computador     TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT ${NOW},${VOID_COLUMNS}
  );

  CREATE INDEX finance_payments_patient ON finance_payments (patient_id);
  CREATE INDEX finance_payments_data ON finance_payments (data);
${onlyVoid('finance_packages', ['id', 'patient_id', 'plan_id', 'nome', 'sessoes', 'valor_centavos', 'inicio', 'validade', 'computador', 'created_at'])}
${onlyVoid('finance_charges', ['id', 'patient_id', 'data', 'descricao', 'valor_centavos', 'motivo', 'appointment_id', 'package_id', 'insurer_id', 'computador', 'created_at'])}
${onlyVoid('finance_package_uses', ['id', 'package_id', 'appointment_id', 'computador', 'created_at'])}
${onlyVoid('finance_payments', ['id', 'patient_id', 'data', 'valor_centavos', 'forma', 'insurer_id', 'observacao', 'computador', 'created_at'])}
  `,
  `
  CREATE TABLE appointment_types (
    id           INTEGER PRIMARY KEY,
    nome         TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    categoria    TEXT NOT NULL CHECK (categoria IN ('sessao', 'avaliacao', 'exame')),
    cor          TEXT NOT NULL CHECK (cor IN ('grafite', 'ardosia', 'azul', 'violeta', 'rosa', 'areia')),
    duracao      INTEGER NOT NULL CHECK (duracao BETWEEN 15 AND 240 AND duracao % 15 = 0),
    arquivado_em TEXT,
    created_at   TEXT NOT NULL DEFAULT ${NOW}
  );

  INSERT INTO appointment_types (id, nome, categoria, cor, duracao) VALUES
    (1, 'Sessão', 'sessao', 'grafite', 30),
    (2, 'Avaliação', 'avaliacao', 'azul', 60),
    (3, 'Exame', 'exame', 'violeta', 60);

  CREATE TRIGGER appointment_types_categoria_fixa
  BEFORE UPDATE OF categoria ON appointment_types
  WHEN NEW.categoria IS NOT OLD.categoria
  BEGIN
    SELECT RAISE(ABORT, 'A categoria de um tipo não muda.');
  END;

  CREATE TRIGGER appointment_types_no_delete
  BEFORE DELETE ON appointment_types
  BEGIN
    SELECT RAISE(ABORT, 'Um tipo não pode ser apagado: arquive.');
  END;

  CREATE TABLE tags (
    id           INTEGER PRIMARY KEY,
    nome         TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    cor          TEXT NOT NULL CHECK (cor IN ('grafite', 'ardosia', 'azul', 'violeta', 'rosa', 'areia')),
    arquivado_em TEXT,
    created_at   TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TRIGGER tags_no_delete
  BEFORE DELETE ON tags
  BEGIN
    SELECT RAISE(ABORT, 'Uma etiqueta não pode ser apagada: arquive.');
  END;

  CREATE TABLE appointment_tags (
    appointment_id INTEGER NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
    tag_id         INTEGER NOT NULL REFERENCES tags (id) ON DELETE RESTRICT,
    PRIMARY KEY (appointment_id, tag_id)
  ) WITHOUT ROWID;

  CREATE INDEX appointment_tags_tag ON appointment_tags (tag_id);

  DROP TRIGGER appointments_signed_locked;
  ALTER TABLE appointments ADD COLUMN tipo_id INTEGER REFERENCES appointment_types (id);
  UPDATE appointments SET tipo_id = CASE tipo WHEN 'avaliacao' THEN 2 ELSE 1 END;
  ALTER TABLE appointments DROP COLUMN tipo;
  CREATE INDEX appointments_tipo ON appointments (tipo_id);

  CREATE TRIGGER appointments_tipo_padrao
  AFTER INSERT ON appointments
  WHEN NEW.tipo_id IS NULL
  BEGIN
    UPDATE appointments SET tipo_id = 1 WHERE id = NEW.id;
  END;

  CREATE TRIGGER appointments_signed_locked
  BEFORE UPDATE OF patient_id, inicio, fim, tipo_id, presenca ON appointments
  WHEN (
    NEW.patient_id IS NOT OLD.patient_id OR NEW.inicio IS NOT OLD.inicio
    OR NEW.fim IS NOT OLD.fim OR (OLD.tipo_id IS NOT NULL AND NEW.tipo_id IS NOT OLD.tipo_id)
    OR NEW.presenca IS NOT OLD.presenca
  )
  AND EXISTS (
    SELECT 1 FROM attendance_signatures s
    WHERE s.appointment_id = OLD.id
      AND s.id NOT IN (SELECT signature_id FROM attendance_voids)
  )
  BEGIN
    SELECT RAISE(ABORT, 'A chegada desta sessão foi assinada: paciente, horário, tipo e presença não mudam mais.');
  END;

  ALTER TABLE waitlist_entries ADD COLUMN tipo_id INTEGER REFERENCES appointment_types (id);
  UPDATE waitlist_entries SET tipo_id = CASE tipo WHEN 'avaliacao' THEN 2 ELSE 1 END;
  ALTER TABLE waitlist_entries DROP COLUMN tipo;

  CREATE TRIGGER waitlist_entries_tipo_padrao
  AFTER INSERT ON waitlist_entries
  WHEN NEW.tipo_id IS NULL
  BEGIN
    UPDATE waitlist_entries SET tipo_id = 1 WHERE id = NEW.id;
  END;
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

export function migrate(db: Database.Database, target: number = MIGRATIONS.length): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > MIGRATIONS.length) {
    throw new DatabaseTooNewError(current)
  }
  for (let version = current; version < target; version++) {
    const migration = MIGRATIONS[version]
    db.transaction(() => {
      if (typeof migration === 'string') db.exec(migration)
      else migration(db)
      db.pragma(`user_version = ${version + 1}`)
    })()
  }
}

export const SCHEMA_VERSION = MIGRATIONS.length
