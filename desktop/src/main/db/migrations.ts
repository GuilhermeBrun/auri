import type Database from 'better-sqlite3'
import { parseSerie } from '../../shared/serie'

type Migration =
  | string
  | ((db: Database.Database) => void)
  | { semChavesEstrangeiras: (db: Database.Database) => void }

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
  `,
  `
  CREATE TABLE commitments (
    id         INTEGER PRIMARY KEY,
    tipo       TEXT NOT NULL
      CHECK (tipo IN ('palestra', 'curso', 'hospital', 'reuniao', 'reserva')),
    titulo     TEXT,
    inicio     TEXT NOT NULL,
    fim        TEXT NOT NULL,
    observacao TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    updated_at TEXT NOT NULL DEFAULT ${NOW},
    CHECK (fim > inicio)
  );

  CREATE INDEX commitments_inicio ON commitments (inicio);

  ALTER TABLE clinic ADD COLUMN margem_deslocamento INTEGER NOT NULL DEFAULT 30
    CHECK (margem_deslocamento BETWEEN 0 AND 120);
  `,
  `
  CREATE TABLE confirmation_requests (
    id              INTEGER PRIMARY KEY,
    envio           TEXT NOT NULL UNIQUE,
    appointment_id  INTEGER NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
    inicio          TEXT NOT NULL,
    destino_nome    TEXT NOT NULL,
    destino_numero  TEXT NOT NULL,
    prazo           TEXT NOT NULL,
    computador      TEXT NOT NULL,
    confirmacao     TEXT NOT NULL,
    chave           BLOB,
    link            TEXT,
    estado          TEXT NOT NULL DEFAULT 'aguardando'
      CHECK (estado IN ('aguardando', 'respondido', 'cancelado', 'vencido')),
    resposta        TEXT CHECK (resposta IN ('confirmada', 'desmarcada')),
    respondido_em   INTEGER,
    recebido_em     TEXT,
    outra_resposta  TEXT CHECK (outra_resposta IN ('confirmada', 'desmarcada')),
    vencido_em      TEXT,
    charge_id       INTEGER REFERENCES finance_charges (id),
    cobranca_erro   TEXT,
    aviso_visto_em  TEXT,
    created_at      TEXT NOT NULL DEFAULT ${NOW},
    CHECK ((estado = 'respondido') = (resposta IS NOT NULL))
  );

  CREATE INDEX confirmation_requests_appointment ON confirmation_requests (appointment_id);
  CREATE INDEX confirmation_requests_aguardando ON confirmation_requests (prazo)
    WHERE estado = 'aguardando';

  CREATE TRIGGER confirmation_requests_content_locked
  BEFORE UPDATE OF envio, appointment_id, inicio, destino_nome, destino_numero, prazo, computador,
    confirmacao, created_at ON confirmation_requests
  BEGIN
    SELECT RAISE(ABORT, 'O conteúdo de um pedido de confirmação não muda.');
  END;
  `,
  `
  ALTER TABLE finance_billing ADD COLUMN plan_id INTEGER
    REFERENCES finance_plans (id) ON DELETE RESTRICT;

  UPDATE finance_billing SET plan_id = (
    SELECT k.plan_id FROM finance_packages k
    WHERE k.patient_id = finance_billing.patient_id AND k.plan_id IS NOT NULL
      AND k.estornado_em IS NULL
    ORDER BY k.inicio DESC, k.id DESC LIMIT 1
  )
  WHERE forma = 'pacote';
  `,
  {
    semChavesEstrangeiras: (db) => {
      const principal = `('sessao', 'avaliacao', 'exame')`
      const categoriaDe = (id: string): string =>
        `(SELECT categoria FROM appointment_types WHERE id = ${id})`
      db.exec(`
    DROP TRIGGER appointment_types_categoria_fixa;
    DROP TRIGGER appointment_types_no_delete;
    DROP TRIGGER tags_no_delete;

    CREATE TABLE etiquetas_unificadas (
      id           INTEGER PRIMARY KEY,
      nome         TEXT NOT NULL CHECK (length(trim(nome)) > 0),
      categoria    TEXT NOT NULL
        CHECK (categoria IN ('sessao', 'avaliacao', 'exame', 'compromisso', 'marca')),
      cor          TEXT NOT NULL
        CHECK (cor GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
      duracao      INTEGER CHECK (duracao BETWEEN 15 AND 240 AND duracao % 15 = 0),
      sistema      TEXT UNIQUE CHECK (sistema IN ('reserva')),
      arquivado_em TEXT,
      created_at   TEXT NOT NULL DEFAULT ${NOW},
      CHECK ((categoria = 'marca') = (duracao IS NULL)),
      CHECK (sistema IS NULL OR categoria = 'compromisso')
    );

    CREATE TEMP TABLE cores_antigas (nome TEXT PRIMARY KEY, hex TEXT NOT NULL);
    INSERT INTO cores_antigas VALUES
      ('grafite', '#6b7280'), ('ardosia', '#0ea5e9'), ('azul', '#2563eb'),
      ('violeta', '#7c3aed'), ('rosa', '#db2777'), ('areia', '#d97706');

    INSERT INTO etiquetas_unificadas (id, nome, categoria, cor, duracao, arquivado_em, created_at)
    SELECT t.id, t.nome, t.categoria, coalesce(c.hex, '#6b7280'), t.duracao, t.arquivado_em,
           t.created_at
    FROM appointment_types t LEFT JOIN cores_antigas c ON c.nome = t.cor;

    DROP TABLE appointment_types;
    ALTER TABLE etiquetas_unificadas RENAME TO appointment_types;
    CREATE TEMP TABLE mapa_etiquetas (origem TEXT NOT NULL, antigo TEXT NOT NULL, novo INTEGER NOT NULL,
      PRIMARY KEY (origem, antigo));
    `)

      const ativos = (
        db.prepare('SELECT nome FROM appointment_types WHERE arquivado_em IS NULL').all() as {
          nome: string
        }[]
      ).map((r) => r.nome.trim().toLocaleLowerCase('pt-BR'))
      const livre = (nome: string, sufixo: string, arquivado: boolean): string => {
        const chave = nome.trim().toLocaleLowerCase('pt-BR')
        const final = !arquivado && ativos.includes(chave) ? `${nome.trim()} (${sufixo})` : nome
        if (!arquivado) ativos.push(final.trim().toLocaleLowerCase('pt-BR'))
        return final
      }
      const inserir = db.prepare(
        `INSERT INTO appointment_types (nome, categoria, cor, duracao, sistema, arquivado_em, created_at)
       VALUES (@nome, @categoria, @cor, @duracao, @sistema, @arquivado_em, coalesce(@created_at, ${NOW}))`
      )
      const mapear = db.prepare(
        'INSERT INTO mapa_etiquetas (origem, antigo, novo) VALUES (?, ?, ?)'
      )
      const tags = db
        .prepare(
          `SELECT g.id, g.nome, coalesce(c.hex, '#0ea5e9') AS cor, g.arquivado_em, g.created_at
         FROM tags g LEFT JOIN cores_antigas c ON c.nome = g.cor ORDER BY g.id`
        )
        .all() as {
        id: number
        nome: string
        cor: string
        arquivado_em: string | null
        created_at: string
      }[]
      for (const tag of tags) {
        const result = inserir.run({
          nome: livre(tag.nome, 'Marca', tag.arquivado_em !== null),
          categoria: 'marca',
          cor: tag.cor,
          duracao: null,
          sistema: null,
          arquivado_em: tag.arquivado_em,
          created_at: tag.created_at
        })
        mapear.run('tag', String(tag.id), Number(result.lastInsertRowid))
      }
      const compromissos = [
        ['palestra', 'Palestra', '#ea580c', null],
        ['curso', 'Curso', '#4f46e5', null],
        ['hospital', 'Hospital', '#e11d48', null],
        ['reuniao', 'Reunião', '#0d9488', null],
        ['reserva', 'Reserva', '#6b7280', 'reserva']
      ] as const
      for (const [tipo, nome, cor, sistema] of compromissos) {
        const result = inserir.run({
          nome: livre(nome, 'Compromisso', false),
          categoria: 'compromisso',
          cor,
          duracao: 60,
          sistema,
          arquivado_em: null,
          created_at: null
        })
        mapear.run('compromisso', tipo, Number(result.lastInsertRowid))
      }

      db.exec(`
    CREATE TABLE appointment_tags_unificadas (
      appointment_id INTEGER NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
      tag_id         INTEGER NOT NULL REFERENCES appointment_types (id) ON DELETE RESTRICT,
      PRIMARY KEY (appointment_id, tag_id)
    ) WITHOUT ROWID;
    INSERT INTO appointment_tags_unificadas (appointment_id, tag_id)
    SELECT x.appointment_id, m.novo FROM appointment_tags x
    JOIN mapa_etiquetas m ON m.origem = 'tag' AND m.antigo = CAST(x.tag_id AS TEXT);
    DROP TABLE appointment_tags;
    DROP TABLE tags;
    ALTER TABLE appointment_tags_unificadas RENAME TO appointment_tags;
    CREATE INDEX appointment_tags_tag ON appointment_tags (tag_id);

    CREATE TABLE commitments_unificados (
      id          INTEGER PRIMARY KEY,
      etiqueta_id INTEGER NOT NULL REFERENCES appointment_types (id),
      titulo      TEXT,
      inicio      TEXT NOT NULL,
      fim         TEXT NOT NULL,
      observacao  TEXT,
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      updated_at  TEXT NOT NULL DEFAULT ${NOW},
      CHECK (fim > inicio)
    );
    INSERT INTO commitments_unificados
      (id, etiqueta_id, titulo, inicio, fim, observacao, created_at, updated_at)
    SELECT c.id, m.novo, c.titulo, c.inicio, c.fim, c.observacao, c.created_at, c.updated_at
    FROM commitments c JOIN mapa_etiquetas m ON m.origem = 'compromisso' AND m.antigo = c.tipo;
    DROP TABLE commitments;
    ALTER TABLE commitments_unificados RENAME TO commitments;
    CREATE INDEX commitments_inicio ON commitments (inicio);
    CREATE INDEX commitments_etiqueta ON commitments (etiqueta_id);

    DROP TABLE mapa_etiquetas;
    DROP TABLE cores_antigas;

    ALTER TABLE appointments ADD COLUMN categoria TEXT CHECK (categoria IN ${principal});
    UPDATE appointments SET categoria = ${categoriaDe('appointments.tipo_id')};

    CREATE TRIGGER appointment_types_no_delete
    BEFORE DELETE ON appointment_types
    BEGIN
      SELECT RAISE(ABORT, 'Uma etiqueta não pode ser apagada: arquive.');
    END;

    CREATE TRIGGER appointment_types_categoria_em_uso
    BEFORE UPDATE OF categoria ON appointment_types
    WHEN NEW.categoria IS NOT OLD.categoria AND (
      (NEW.categoria NOT IN ${principal} AND (
        EXISTS (SELECT 1 FROM appointments WHERE tipo_id = OLD.id)
        OR EXISTS (SELECT 1 FROM waitlist_entries WHERE tipo_id = OLD.id)))
      OR (NEW.categoria <> 'marca' AND EXISTS (SELECT 1 FROM appointment_tags WHERE tag_id = OLD.id))
      OR (NEW.categoria <> 'compromisso' AND EXISTS (SELECT 1 FROM commitments WHERE etiqueta_id = OLD.id))
    )
    BEGIN
      SELECT RAISE(ABORT, 'Esta etiqueta está em uso e não pode mudar para essa categoria.');
    END;

    CREATE TRIGGER appointments_etiqueta_principal
    BEFORE INSERT ON appointments
    WHEN NEW.tipo_id IS NOT NULL AND ${categoriaDe('NEW.tipo_id')} NOT IN ${principal}
    BEGIN
      SELECT RAISE(ABORT, 'Escolha uma etiqueta de sessão, avaliação ou exame.');
    END;

    CREATE TRIGGER appointments_etiqueta_principal_troca
    BEFORE UPDATE OF tipo_id ON appointments
    WHEN NEW.tipo_id IS NOT NULL AND ${categoriaDe('NEW.tipo_id')} NOT IN ${principal}
    BEGIN
      SELECT RAISE(ABORT, 'Escolha uma etiqueta de sessão, avaliação ou exame.');
    END;

    CREATE TRIGGER appointments_categoria_nova
    AFTER INSERT ON appointments
    BEGIN
      UPDATE appointments SET categoria = ${categoriaDe('coalesce(NEW.tipo_id, 1)')}
      WHERE id = NEW.id;
    END;

    CREATE TRIGGER appointments_categoria_troca
    AFTER UPDATE OF tipo_id ON appointments
    WHEN NEW.tipo_id IS NOT OLD.tipo_id
    BEGIN
      UPDATE appointments SET categoria = ${categoriaDe('NEW.tipo_id')} WHERE id = NEW.id;
    END;

    CREATE TRIGGER waitlist_entries_etiqueta_principal
    BEFORE INSERT ON waitlist_entries
    WHEN NEW.tipo_id IS NOT NULL AND ${categoriaDe('NEW.tipo_id')} NOT IN ${principal}
    BEGIN
      SELECT RAISE(ABORT, 'Escolha uma etiqueta de sessão, avaliação ou exame.');
    END;

    CREATE TRIGGER waitlist_entries_etiqueta_principal_troca
    BEFORE UPDATE OF tipo_id ON waitlist_entries
    WHEN NEW.tipo_id IS NOT NULL AND ${categoriaDe('NEW.tipo_id')} NOT IN ${principal}
    BEGIN
      SELECT RAISE(ABORT, 'Escolha uma etiqueta de sessão, avaliação ou exame.');
    END;

    CREATE TRIGGER appointment_tags_marca
    BEFORE INSERT ON appointment_tags
    WHEN ${categoriaDe('NEW.tag_id')} IS NOT 'marca'
    BEGIN
      SELECT RAISE(ABORT, 'Só uma etiqueta de marca entra nas marcas da sessão.');
    END;

    CREATE TRIGGER commitments_etiqueta_compromisso
    BEFORE INSERT ON commitments
    WHEN ${categoriaDe('NEW.etiqueta_id')} IS NOT 'compromisso'
    BEGIN
      SELECT RAISE(ABORT, 'Escolha uma etiqueta de compromisso.');
    END;

    CREATE TRIGGER commitments_etiqueta_compromisso_troca
    BEFORE UPDATE OF etiqueta_id ON commitments
    WHEN ${categoriaDe('NEW.etiqueta_id')} IS NOT 'compromisso'
    BEGIN
      SELECT RAISE(ABORT, 'Escolha uma etiqueta de compromisso.');
    END;
    `)
    }
  },
  `
  ALTER TABLE term_requests ADD COLUMN codigo TEXT;
  ALTER TABLE confirmation_requests ADD COLUMN codigo TEXT;
  `,
  {
    semChavesEstrangeiras: (db) => {
      const principal = `('sessao', 'avaliacao', 'exame')`
      db.exec('DROP TABLE appointment_tags')
      const gatilhos = db
        .prepare(
          `SELECT name, sql FROM sqlite_master
           WHERE type = 'trigger' AND tbl_name <> 'appointment_types'
             AND sql LIKE '%appointment_types%'`
        )
        .all() as { name: string; sql: string }[]
      for (const { name } of gatilhos) db.exec(`DROP TRIGGER ${name}`)
      db.exec(`
    CREATE TABLE etiquetas_sem_marca (
      id           INTEGER PRIMARY KEY,
      nome         TEXT NOT NULL CHECK (length(trim(nome)) > 0),
      categoria    TEXT NOT NULL
        CHECK (categoria IN ('sessao', 'avaliacao', 'exame', 'compromisso')),
      cor          TEXT NOT NULL
        CHECK (cor GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
      duracao      INTEGER NOT NULL CHECK (duracao BETWEEN 15 AND 240 AND duracao % 15 = 0),
      sistema      TEXT UNIQUE CHECK (sistema IN ('reserva')),
      arquivado_em TEXT,
      created_at   TEXT NOT NULL DEFAULT ${NOW},
      CHECK (sistema IS NULL OR categoria = 'compromisso')
    );

    INSERT INTO etiquetas_sem_marca
      (id, nome, categoria, cor, duracao, sistema, arquivado_em, created_at)
    SELECT id, nome, categoria, cor, duracao, sistema, arquivado_em, created_at
    FROM appointment_types WHERE categoria <> 'marca';

    DROP TABLE appointment_types;
    ALTER TABLE etiquetas_sem_marca RENAME TO appointment_types;

    CREATE TRIGGER appointment_types_no_delete
    BEFORE DELETE ON appointment_types
    BEGIN
      SELECT RAISE(ABORT, 'Uma etiqueta não pode ser apagada: arquive.');
    END;

    CREATE TRIGGER appointment_types_categoria_em_uso
    BEFORE UPDATE OF categoria ON appointment_types
    WHEN NEW.categoria IS NOT OLD.categoria AND (
      (NEW.categoria NOT IN ${principal} AND (
        EXISTS (SELECT 1 FROM appointments WHERE tipo_id = OLD.id)
        OR EXISTS (SELECT 1 FROM waitlist_entries WHERE tipo_id = OLD.id)))
      OR (NEW.categoria <> 'compromisso' AND EXISTS (SELECT 1 FROM commitments WHERE etiqueta_id = OLD.id))
    )
    BEGIN
      SELECT RAISE(ABORT, 'Esta etiqueta está em uso e não pode mudar para essa categoria.');
    END;
    `)
      for (const { sql } of gatilhos) db.exec(sql)
    }
  },
  (db) => {
    const principal = `('sessao', 'avaliacao', 'exame')`
    const padrao = `(SELECT id FROM appointment_types WHERE categoria IN ${principal}
      ORDER BY categoria <> 'sessao', id LIMIT 1)`
    db.exec(`
    DROP TRIGGER appointment_types_no_delete;
    DELETE FROM appointment_types
    WHERE arquivado_em IS NOT NULL AND sistema IS NULL
      AND NOT EXISTS (SELECT 1 FROM appointments WHERE tipo_id = appointment_types.id)
      AND NOT EXISTS (SELECT 1 FROM waitlist_entries WHERE tipo_id = appointment_types.id)
      AND NOT EXISTS (SELECT 1 FROM commitments WHERE etiqueta_id = appointment_types.id);
    `)
    const chave = (nome: string): string => nome.trim().toLocaleLowerCase('pt-BR')
    const ativos = (
      db.prepare('SELECT nome FROM appointment_types WHERE arquivado_em IS NULL').all() as {
        nome: string
      }[]
    ).map((r) => chave(r.nome))
    const arquivadas = db
      .prepare('SELECT id, nome FROM appointment_types WHERE arquivado_em IS NOT NULL ORDER BY id')
      .all() as { id: number; nome: string }[]
    const renomear = db.prepare('UPDATE appointment_types SET nome = ? WHERE id = ?')
    for (const { id, nome } of arquivadas) {
      let final = nome
      for (let n = 1; ativos.includes(chave(final)); n++) {
        final = `${nome.trim()} (arquivada${n > 1 ? ` ${n}` : ''})`
      }
      if (final !== nome) renomear.run(final, id)
      ativos.push(chave(final))
    }
    db.exec(`
    ALTER TABLE appointment_types DROP COLUMN arquivado_em;

    CREATE TRIGGER appointment_types_reserva_fica
    BEFORE DELETE ON appointment_types
    WHEN OLD.sistema IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'A Reserva não pode ser excluída.');
    END;

    DROP TRIGGER appointments_signed_locked;
    CREATE TRIGGER appointments_signed_locked
    BEFORE UPDATE OF patient_id, inicio, fim, tipo_id, presenca ON appointments
    WHEN (
      NEW.patient_id IS NOT OLD.patient_id OR NEW.inicio IS NOT OLD.inicio
      OR NEW.fim IS NOT OLD.fim OR NEW.presenca IS NOT OLD.presenca
      OR (OLD.tipo_id IS NOT NULL AND NEW.tipo_id IS NOT OLD.tipo_id
        AND EXISTS (SELECT 1 FROM appointment_types WHERE id = OLD.tipo_id))
    )
    AND EXISTS (
      SELECT 1 FROM attendance_signatures s
      WHERE s.appointment_id = OLD.id
        AND s.id NOT IN (SELECT signature_id FROM attendance_voids)
    )
    BEGIN
      SELECT RAISE(ABORT, 'A chegada desta sessão foi assinada: paciente, horário, tipo e presença não mudam mais.');
    END;

    DROP TRIGGER appointments_tipo_padrao;
    CREATE TRIGGER appointments_tipo_padrao
    AFTER INSERT ON appointments
    WHEN NEW.tipo_id IS NULL
    BEGIN
      UPDATE appointments SET tipo_id = ${padrao} WHERE id = NEW.id;
    END;

    DROP TRIGGER appointments_categoria_nova;
    CREATE TRIGGER appointments_categoria_nova
    AFTER INSERT ON appointments
    BEGIN
      UPDATE appointments SET categoria = (SELECT categoria FROM appointment_types
        WHERE id = coalesce(NEW.tipo_id, ${padrao}))
      WHERE id = NEW.id;
    END;

    DROP TRIGGER waitlist_entries_tipo_padrao;
    CREATE TRIGGER waitlist_entries_tipo_padrao
    AFTER INSERT ON waitlist_entries
    WHEN NEW.tipo_id IS NULL
    BEGIN
      UPDATE waitlist_entries SET tipo_id = ${padrao} WHERE id = NEW.id;
    END;
    `)
  }
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
    const chaves = db.pragma('foreign_keys', { simple: true }) as number
    if (typeof migration === 'object') db.pragma('foreign_keys = OFF')
    try {
      db.transaction(() => {
        if (typeof migration === 'string') db.exec(migration)
        else if (typeof migration === 'function') migration(db)
        else {
          migration.semChavesEstrangeiras(db)
          if ((db.pragma('foreign_key_check') as unknown[]).length > 0) {
            throw new Error('A atualização do banco deixaria referências quebradas.')
          }
        }
        db.pragma(`user_version = ${version + 1}`)
      })()
    } finally {
      if (typeof migration === 'object') db.pragma(`foreign_keys = ${chaves}`)
    }
  }
}

export const SCHEMA_VERSION = MIGRATIONS.length
