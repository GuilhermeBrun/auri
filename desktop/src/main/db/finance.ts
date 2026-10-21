import { addDays, format } from 'date-fns'
import { parseIsoDate, toIsoDate } from '../../shared/dates'
import { consomePacote, mesmoNome } from '../../shared/tipos'
import {
  FORA_DO_PACOTE,
  FORMAS_PAGAMENTO,
  type Billing,
  type BillingInput,
  type ChargeEntry,
  type ChargeInput,
  type Contratar,
  type Estorno,
  type FinanceCatalog,
  type FinanceInsurer,
  type FinanceOverview,
  type FinancePlan,
  type FinanceService,
  type InsurerInput,
  type Lancamento,
  type MotivoCobranca,
  type PackageInput,
  type PackageUseEntry,
  type PatientFinance,
  type PatientPackage,
  type PaymentEntry,
  type PaymentInput,
  type PendingSession,
  type PlanInput,
  type Renovacao,
  type SaldoConvenio,
  type ServiceInput,
  type SessionPayStatus,
  type SituacaoCobranca
} from '../../shared/finance'
import { getAppointment } from './appointments'
import { assertUnchanged } from './concurrency'
import type { Db } from './connection'
import { getPatient } from './patients'
import { TIPO_JOIN } from './tipos'

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"

type VoidColumns = {
  estornado_em: string | null
  estorno_motivo: string | null
  estorno_computador: string | null
}

function estorno(row: VoidColumns): Estorno {
  return row.estornado_em === null
    ? null
    : {
        em: row.estornado_em,
        motivo: row.estorno_motivo ?? '',
        computador: row.estorno_computador ?? ''
      }
}

function withoutVoid<T extends VoidColumns>(row: T): Omit<T, keyof VoidColumns> {
  const { estornado_em: _, estorno_motivo: __, estorno_computador: ___, ...rest } = row
  return rest
}

type Archivable = { arquivado_em: string | null }

function archived<T extends Archivable>({
  arquivado_em,
  ...row
}: T): Omit<T, 'arquivado_em'> & {
  arquivado: boolean
} {
  return { ...row, arquivado: arquivado_em !== null }
}

const CATALOG = {
  service: { table: 'finance_services', columns: ['nome', 'valor_centavos'], name: 'Serviço' },
  plan: {
    table: 'finance_plans',
    columns: ['nome', 'sessoes', 'valor_centavos', 'validade_dias'],
    name: 'Pacote'
  },
  insurer: {
    table: 'finance_insurers',
    columns: ['nome', 'valor_sessao_centavos'],
    name: 'Convênio'
  }
} as const

type CatalogKind = keyof typeof CATALOG

function catalogRow(db: Db, kind: CatalogKind, id: number): Record<string, unknown> & Archivable {
  const { table, columns, name } = CATALOG[kind]
  const row = db
    .prepare(`SELECT id, ${columns.join(', ')}, arquivado_em FROM ${table} WHERE id = ?`)
    .get(id) as (Record<string, unknown> & Archivable) | undefined
  if (!row) throw new Error(`${name} não encontrado`)
  return row
}

function saveCatalog(
  db: Db,
  kind: CatalogKind,
  id: number | null,
  input: Record<string, unknown>
): number {
  const { table, columns } = CATALOG[kind]
  const params = Object.fromEntries(columns.map((c) => [c, input[c] ?? null]))
  if (id === null) {
    const result = db
      .prepare(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((c) => `@${c}`).join(', ')})`
      )
      .run(params)
    return Number(result.lastInsertRowid)
  }
  catalogRow(db, kind, id)
  db.prepare(
    `UPDATE ${table} SET ${columns.map((c) => `${c} = @${c}`).join(', ')}, updated_at = ${NOW}
     WHERE id = @id`
  ).run({ ...params, id })
  return id
}

function archiveCatalog(db: Db, kind: CatalogKind, id: number, arquivado: boolean): void {
  catalogRow(db, kind, id)
  db.prepare(
    `UPDATE ${CATALOG[kind].table}
     SET arquivado_em = ${arquivado ? `coalesce(arquivado_em, ${NOW})` : 'NULL'}, updated_at = ${NOW}
     WHERE id = ?`
  ).run(id)
}

export const getService = (db: Db, id: number): FinanceService =>
  archived(catalogRow(db, 'service', id)) as unknown as FinanceService
export const getPlan = (db: Db, id: number): FinancePlan =>
  archived(catalogRow(db, 'plan', id)) as unknown as FinancePlan
export const getInsurer = (db: Db, id: number): FinanceInsurer =>
  archived(catalogRow(db, 'insurer', id)) as unknown as FinanceInsurer

export function getCatalog(db: Db): FinanceCatalog {
  const list = (table: string): (Record<string, unknown> & Archivable)[] =>
    db
      .prepare(`SELECT * FROM ${table} ORDER BY arquivado_em IS NOT NULL, nome COLLATE NOCASE, id`)
      .all() as (Record<string, unknown> & Archivable)[]
  const clean = <T>(row: Record<string, unknown> & Archivable): T => {
    const { created_at: _, updated_at: __, ...rest } = archived(row)
    return rest as T
  }
  return {
    services: list('finance_services').map((r) => clean<FinanceService>(r)),
    plans: list('finance_plans').map((r) => clean<FinancePlan>(r)),
    insurers: list('finance_insurers').map((r) => clean<FinanceInsurer>(r))
  }
}

export function saveService(db: Db, id: number | null, input: ServiceInput): FinanceService {
  return getService(db, saveCatalog(db, 'service', id, input))
}

export function savePlan(db: Db, id: number | null, input: PlanInput): FinancePlan {
  return getPlan(db, saveCatalog(db, 'plan', id, input))
}

export function saveInsurer(db: Db, id: number | null, input: InsurerInput): FinanceInsurer {
  return getInsurer(db, saveCatalog(db, 'insurer', id, input))
}

export function archiveService(db: Db, id: number, arquivado: boolean): FinanceService {
  archiveCatalog(db, 'service', id, arquivado)
  return getService(db, id)
}

export function archivePlan(db: Db, id: number, arquivado: boolean): FinancePlan {
  archiveCatalog(db, 'plan', id, arquivado)
  return getPlan(db, id)
}

export function archiveInsurer(db: Db, id: number, arquivado: boolean): FinanceInsurer {
  archiveCatalog(db, 'insurer', id, arquivado)
  return getInsurer(db, id)
}

type BillingRow = {
  forma: Billing['forma']
  service_id: number | null
  insurer_id: number | null
  plan_id: number | null
  plan_nome: string | null
  plan_sessoes: number | null
  plan_valor: number | null
  carteirinha: string | null
  desde: string
  updated_at: string
  service_nome: string | null
  service_valor: number | null
  insurer_nome: string | null
  insurer_valor: number | null
}

export function getBilling(db: Db, patientId: number): Billing | null {
  const row = db
    .prepare(
      `SELECT b.forma, b.service_id, b.insurer_id, b.plan_id, b.carteirinha, b.desde, b.updated_at,
              s.nome AS service_nome, s.valor_centavos AS service_valor,
              i.nome AS insurer_nome, i.valor_sessao_centavos AS insurer_valor,
              p.nome AS plan_nome, p.sessoes AS plan_sessoes, p.valor_centavos AS plan_valor
       FROM finance_billing b
       LEFT JOIN finance_services s ON s.id = b.service_id
       LEFT JOIN finance_insurers i ON i.id = b.insurer_id
       LEFT JOIN finance_plans p ON p.id = b.plan_id
       WHERE b.patient_id = ?`
    )
    .get(patientId) as BillingRow | undefined
  if (!row) return null
  return {
    forma: row.forma,
    service_id: row.service_id,
    insurer_id: row.insurer_id,
    plan_id: row.plan_id,
    carteirinha: row.carteirinha ?? '',
    desde: row.desde,
    updated_at: row.updated_at,
    service:
      row.service_id === null
        ? null
        : { nome: row.service_nome ?? '', valor_centavos: row.service_valor ?? 0 },
    insurer:
      row.insurer_id === null
        ? null
        : { nome: row.insurer_nome ?? '', valor_sessao_centavos: row.insurer_valor ?? 0 },
    plan:
      row.plan_id === null
        ? null
        : {
            nome: row.plan_nome ?? '',
            sessoes: row.plan_sessoes ?? 0,
            valor_centavos: row.plan_valor ?? 0
          }
  }
}

export function setBilling(
  db: Db,
  patientId: number,
  input: BillingInput,
  expected?: string,
  contratar: (NonNullable<Contratar> & { computador: string }) | null = null
): Billing {
  return db.transaction((): Billing => {
    saveBilling(db, patientId, input, expected)
    const billing = getBilling(db, patientId)!
    if (contratar && billing.forma === 'pacote' && billing.plan_id !== null)
      contractPackage(
        db,
        patientId,
        { plan_id: billing.plan_id, inicio: contratar.inicio },
        contratar.computador
      )
    return billing
  })()
}

function saveBilling(db: Db, patientId: number, input: BillingInput, expected?: string): void {
  getPatient(db, patientId)
  const current = getBilling(db, patientId)
  if (current && expected !== undefined) assertUnchanged(current.updated_at, expected)
  const service_id = input.service_id
  const insurer_id = input.forma === 'convenio' ? input.insurer_id : null
  const plan_id = input.forma === 'pacote' ? (input.plan_id ?? null) : null
  if (plan_id !== null && getPlan(db, plan_id).arquivado && plan_id !== current?.plan_id)
    throw new Error('Este pacote está arquivado.')
  if (
    service_id !== null &&
    getService(db, service_id).arquivado &&
    service_id !== current?.service_id
  )
    throw new Error('Este valor está arquivado.')
  if (
    insurer_id !== null &&
    getInsurer(db, insurer_id).arquivado &&
    insurer_id !== current?.insurer_id
  )
    throw new Error('Este convênio está arquivado.')
  const params = {
    patient_id: patientId,
    forma: input.forma,
    service_id,
    insurer_id,
    plan_id,
    carteirinha: input.forma === 'convenio' && input.carteirinha !== '' ? input.carteirinha : null,
    desde: input.desde
  }
  db.prepare(
    `INSERT INTO finance_billing (patient_id, forma, service_id, insurer_id, plan_id, carteirinha,
       desde)
     VALUES (@patient_id, @forma, @service_id, @insurer_id, @plan_id, @carteirinha, @desde)
     ON CONFLICT (patient_id) DO UPDATE SET forma = excluded.forma,
       service_id = excluded.service_id, insurer_id = excluded.insurer_id,
       plan_id = excluded.plan_id, carteirinha = excluded.carteirinha, desde = excluded.desde,
       updated_at = ${NOW}`
  ).run(params)
}

type PackageRow = Omit<PatientPackage, 'em_vigor' | 'estorno'> &
  VoidColumns & { patient_id: number; plan_id: number | null }

function packageRows(db: Db, patientId: number): PackageRow[] {
  return db
    .prepare(
      `SELECT k.id, k.patient_id, k.plan_id, k.nome, k.sessoes, k.valor_centavos, k.inicio, k.validade,
              k.estornado_em, k.estorno_motivo, k.estorno_computador,
              (SELECT count(*) FROM finance_package_uses u
               WHERE u.package_id = k.id AND u.estornado_em IS NULL) AS usadas
       FROM finance_packages k WHERE k.patient_id = ? ORDER BY k.inicio, k.id`
    )
    .all(patientId) as PackageRow[]
}

function usedCount(db: Db, packageId: number): number {
  const row = db
    .prepare(
      'SELECT count(*) AS n FROM finance_package_uses WHERE package_id = ? AND estornado_em IS NULL'
    )
    .get(packageId) as { n: number }
  return row.n
}

function toPackage(row: PackageRow, today: string): PatientPackage {
  const { patient_id: _, plan_id: __, ...rest } = withoutVoid(row)
  return {
    ...rest,
    em_vigor:
      row.estornado_em === null &&
      row.usadas < row.sessoes &&
      (row.validade === null || row.validade >= today),
    estorno: estorno(row)
  }
}

function insertCharge(
  db: Db,
  charge: {
    patient_id: number
    data: string
    descricao: string
    valor_centavos: number
    motivo: MotivoCobranca
    appointment_id?: number | null
    package_id?: number | null
    insurer_id?: number | null
  },
  computador: string
): number {
  const result = db
    .prepare(
      `INSERT INTO finance_charges (patient_id, data, descricao, valor_centavos, motivo,
         appointment_id, package_id, insurer_id, computador)
       VALUES (@patient_id, @data, @descricao, @valor_centavos, @motivo, @appointment_id,
         @package_id, @insurer_id, @computador)`
    )
    .run({
      appointment_id: null,
      package_id: null,
      insurer_id: null,
      ...charge,
      computador
    })
  return Number(result.lastInsertRowid)
}

export function contractPackage(
  db: Db,
  patientId: number,
  input: PackageInput,
  computador: string
): number {
  return db.transaction(() => {
    getPatient(db, patientId)
    const plan = getPlan(db, input.plan_id)
    if (plan.arquivado) throw new Error('Este pacote está arquivado.')
    const validade =
      plan.validade_dias === null
        ? null
        : toIsoDate(addDays(parseIsoDate(input.inicio), plan.validade_dias - 1))
    const result = db
      .prepare(
        `INSERT INTO finance_packages (patient_id, plan_id, nome, sessoes, valor_centavos, inicio,
           validade, computador)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        patientId,
        plan.id,
        plan.nome,
        plan.sessoes,
        plan.valor_centavos,
        input.inicio,
        validade,
        computador
      )
    const packageId = Number(result.lastInsertRowid)
    insertCharge(
      db,
      {
        patient_id: patientId,
        data: input.inicio,
        descricao: plan.nome.includes(String(plan.sessoes))
          ? `Pacote ${plan.nome}`
          : `Pacote ${plan.nome} · ${plan.sessoes} ${plan.sessoes === 1 ? 'sessão' : 'sessões'}`,
        valor_centavos: plan.valor_centavos,
        motivo: 'pacote',
        package_id: packageId
      },
      computador
    )
    absorverForaDoPacote(db, patientId, packageId, input.inicio, validade, plan.sessoes, computador)
    return packageId
  })()
}

function absorverForaDoPacote(
  db: Db,
  patientId: number,
  packageId: number,
  inicio: string,
  validade: string | null,
  vagas: number,
  computador: string
): void {
  const fora = db
    .prepare(
      `SELECT id, appointment_id FROM finance_charges
       WHERE patient_id = ? AND motivo = 'sessao' AND insurer_id IS NULL AND estornado_em IS NULL
         AND descricao LIKE ? AND data >= ? AND (? IS NULL OR data <= ?)
       ORDER BY data, id LIMIT ?`
    )
    .all(patientId, `%${FORA_DO_PACOTE}`, inicio, validade, validade, vagas) as {
    id: number
    appointment_id: number
  }[]
  for (const charge of fora) {
    estornar(db, 'charge', charge.id, 'Passou para o pacote', computador)
    db.prepare(
      'INSERT INTO finance_package_uses (package_id, appointment_id, computador) VALUES (?, ?, ?)'
    ).run(packageId, charge.appointment_id, computador)
  }
}

function lastPackage(rows: PackageRow[]): PackageRow | null {
  return rows.filter((p) => p.estornado_em === null).at(-1) ?? null
}

function renovacaoFrom(
  billing: Billing | null,
  rows: PackageRow[],
  plans: (id: number) => FinancePlan | null,
  today: string
): Renovacao | null {
  if (billing?.forma !== 'pacote') return null
  const last = lastPackage(rows)
  if (!last) return null
  const vigentes = rows.map((r) => toPackage(r, today)).filter((p) => p.em_vigor)
  const restantes = vigentes.reduce((sum, p) => sum + p.sessoes - p.usadas, 0)
  if (restantes > 1) return null
  const plan = plans(billing.plan_id ?? last.plan_id ?? 0)
  if (!plan || plan.arquivado) return null
  return {
    plan_id: plan.id,
    nome: plan.nome,
    valor_centavos: plan.valor_centavos,
    situacao: restantes === 1 ? 'acabando' : last.usadas >= last.sessoes ? 'acabou' : 'venceu',
    restantes
  }
}

function planOrNull(db: Db): (id: number) => FinancePlan | null {
  return (id) => {
    const row = db.prepare('SELECT id FROM finance_plans WHERE id = ?').get(id)
    return row ? getPlan(db, id) : null
  }
}

export function renovarPacote(
  db: Db,
  patientId: number,
  computador: string,
  today: string = toIsoDate(new Date())
): number {
  return db.transaction(() => {
    getPatient(db, patientId)
    const rows = packageRows(db, patientId)
    const renovacao = renovacaoFrom(getBilling(db, patientId), rows, planOrNull(db), today)
    if (!renovacao) throw new Error('Não há pacote para renovar.')
    const fora = db
      .prepare(
        `SELECT min(data) AS data FROM finance_charges
         WHERE patient_id = ? AND motivo = 'sessao' AND insurer_id IS NULL
           AND estornado_em IS NULL AND descricao LIKE ? AND data >= ?`
      )
      .get(patientId, `%${FORA_DO_PACOTE}`, lastPackage(rows)!.inicio) as { data: string | null }
    const inicio = fora.data !== null && fora.data < today ? fora.data : today
    return contractPackage(db, patientId, { plan_id: renovacao.plan_id, inicio }, computador)
  })()
}

export function addCharge(
  db: Db,
  patientId: number,
  input: ChargeInput,
  computador: string
): number {
  getPatient(db, patientId)
  return insertCharge(
    db,
    {
      patient_id: patientId,
      data: input.data,
      descricao: input.descricao,
      valor_centavos: input.valor_centavos,
      motivo: 'avulsa'
    },
    computador
  )
}

export function addPayment(
  db: Db,
  patientId: number,
  input: PaymentInput,
  computador: string
): number {
  getPatient(db, patientId)
  if (input.insurer_id !== null) getInsurer(db, input.insurer_id)
  const result = db
    .prepare(
      `INSERT INTO finance_payments (patient_id, data, valor_centavos, forma, insurer_id,
         observacao, computador)
       VALUES (@patient_id, @data, @valor_centavos, @forma, @insurer_id, @observacao, @computador)`
    )
    .run({
      patient_id: patientId,
      ...input,
      observacao: input.observacao === '' ? null : input.observacao,
      computador
    })
  return Number(result.lastInsertRowid)
}

function activeEntry(db: Db, appointmentId: number): { kind: 'charge' | 'use'; id: number } | null {
  const charge = db
    .prepare('SELECT id FROM finance_charges WHERE appointment_id = ? AND estornado_em IS NULL')
    .get(appointmentId) as { id: number } | undefined
  if (charge) return { kind: 'charge', id: charge.id }
  const use = db
    .prepare(
      'SELECT id FROM finance_package_uses WHERE appointment_id = ? AND estornado_em IS NULL'
    )
    .get(appointmentId) as { id: number } | undefined
  return use ? { kind: 'use', id: use.id } : null
}

const sessionDay = (inicio: string): string => inicio.slice(0, 10)

function hasSignature(db: Db, appointmentId: number): boolean {
  return (
    db
      .prepare('SELECT 1 FROM attendance_signatures WHERE appointment_id = ?')
      .get(appointmentId) !== undefined
  )
}

export function lancarNaChegada(
  db: Db,
  appointmentId: number,
  computador: string
): LancamentoSessao | null {
  const { patient_id } = getAppointment(db, appointmentId)
  if (!getBilling(db, patient_id) || activeEntry(db, appointmentId)) return null
  try {
    return lancarSessao(db, appointmentId, computador)
  } catch (error) {
    console.error(`[financeiro] sessão ${appointmentId} fica em "A lançar": ${String(error)}`)
    return null
  }
}

export function estornarFalta(
  db: Db,
  appointmentId: number,
  motivo: string,
  computador: string
): boolean {
  const charge = db
    .prepare(
      `SELECT id FROM finance_charges
       WHERE appointment_id = ? AND motivo = 'falta_cobrada' AND estornado_em IS NULL`
    )
    .get(appointmentId) as { id: number } | undefined
  if (!charge) return false
  estornar(db, 'charge', charge.id, motivo, computador)
  return true
}

export function estornarSessao(
  db: Db,
  appointmentId: number,
  motivo: string,
  computador: string
): boolean {
  const entry = activeEntry(db, appointmentId)
  if (!entry) return false
  estornar(db, entry.kind, entry.id, motivo, computador)
  return true
}

function sessionLabel(tipoNome: string, inicio: string): string {
  const dia = format(parseIsoDate(sessionDay(inicio)), 'dd/MM')
  return `${tipoNome} de ${dia}`
}

function serviceSuffix(nome: string, tipoNome: string): string {
  return mesmoNome(nome, tipoNome) ? '' : ` · ${nome}`
}

function packageFor(db: Db, patientId: number, day: string): PackageRow | null {
  return (
    packageRows(db, patientId).find(
      (p) =>
        p.estornado_em === null &&
        p.inicio <= day &&
        (p.validade === null || p.validade >= day) &&
        p.usadas < p.sessoes
    ) ?? null
  )
}

export type LancamentoSessao = { kind: 'charge' | 'use'; id: number }

export function lancarSessao(
  db: Db,
  appointmentId: number,
  computador: string,
  serviceId: number | null = null
): LancamentoSessao {
  return db.transaction((): LancamentoSessao => {
    const a = getAppointment(db, appointmentId)
    if (a.presenca !== 'presente') throw new Error('Só uma sessão com presença pode ser lançada.')
    if (!a.assinatura && hasSignature(db, appointmentId))
      throw new Error('A assinatura da chegada desta sessão foi anulada.')
    if (activeEntry(db, appointmentId)) throw new Error('Esta sessão já foi lançada.')
    const billing = getBilling(db, a.patient_id)
    if (!billing) throw new Error('Defina a forma de cobrança do paciente antes de lançar.')
    const day = sessionDay(a.inicio)
    const label = sessionLabel(a.tipo_nome, a.inicio)

    if (billing.forma === 'convenio' && serviceId === null && billing.insurer) {
      const id = insertCharge(
        db,
        {
          patient_id: a.patient_id,
          data: day,
          descricao: `${label} · ${billing.insurer.nome}`,
          valor_centavos: billing.insurer.valor_sessao_centavos,
          motivo: 'sessao',
          appointment_id: a.id,
          insurer_id: billing.insurer_id
        },
        computador
      )
      return { kind: 'charge', id }
    }

    let foraDoPacote = false
    if (billing.forma === 'pacote' && serviceId === null && consomePacote(a.categoria)) {
      const pkg = packageFor(db, a.patient_id, day)
      if (pkg) {
        const result = db
          .prepare(
            'INSERT INTO finance_package_uses (package_id, appointment_id, computador) VALUES (?, ?, ?)'
          )
          .run(pkg.id, a.id, computador)
        return { kind: 'use', id: Number(result.lastInsertRowid) }
      }
      foraDoPacote = true
    }

    const chosen = serviceId ?? billing.service_id
    if (chosen === null) throw new Error('Escolha o valor desta sessão.')
    const service = getService(db, chosen)
    const id = insertCharge(
      db,
      {
        patient_id: a.patient_id,
        data: day,
        descricao: `${label}${serviceSuffix(service.nome, a.tipo_nome)}${foraDoPacote ? FORA_DO_PACOTE : ''}`,
        valor_centavos: service.valor_centavos,
        motivo: 'sessao',
        appointment_id: a.id
      },
      computador
    )
    return { kind: 'charge', id }
  })()
}

export function cobrarFalta(db: Db, appointmentId: number, computador: string): number {
  return db.transaction(() => {
    const a = getAppointment(db, appointmentId)
    if (a.presenca !== 'falta' && a.presenca !== 'desmarcou')
      throw new Error('Só uma falta pode ser cobrada.')
    if (activeEntry(db, appointmentId)) throw new Error('Esta sessão já foi lançada.')
    const billing = getBilling(db, a.patient_id)
    if (!billing) throw new Error('Defina a forma de cobrança do paciente antes de cobrar.')
    if (billing.service_id === null || !billing.service)
      throw new Error('Escolha o valor da sessão particular na forma de cobrança.')
    return insertCharge(
      db,
      {
        patient_id: a.patient_id,
        data: sessionDay(a.inicio),
        descricao: `Falta de ${format(parseIsoDate(sessionDay(a.inicio)), 'dd/MM')}${serviceSuffix(billing.service.nome, a.tipo_nome)}`,
        valor_centavos: billing.service.valor_centavos,
        motivo: 'falta_cobrada',
        appointment_id: a.id
      },
      computador
    )
  })()
}

const VOID_TABLES: Record<Lancamento, string> = {
  charge: 'finance_charges',
  payment: 'finance_payments',
  package: 'finance_packages',
  use: 'finance_package_uses'
}

export function estornar(
  db: Db,
  kind: Lancamento,
  id: number,
  motivo: string,
  computador: string
): number {
  return db.transaction(() => {
    const table = VOID_TABLES[kind]
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as
      | (VoidColumns & { patient_id?: number; package_id?: number; motivo?: string })
      | undefined
    if (!row) throw new Error('Lançamento não encontrado')
    if (row.estornado_em !== null) throw new Error('Este lançamento já foi estornado.')
    if (kind === 'charge' && row.motivo === 'pacote')
      throw new Error('Estorne o pacote: a cobrança dele sai junto.')
    const run = (t: string, rowId: number): void => {
      db.prepare(
        `UPDATE ${t} SET estornado_em = ${NOW}, estorno_motivo = ?, estorno_computador = ?
         WHERE id = ?`
      ).run(motivo, computador, rowId)
    }
    if (kind === 'package') {
      if (usedCount(db, id) > 0)
        throw new Error('Este pacote tem sessões usadas. Estorne as sessões antes do pacote.')
      const charge = db
        .prepare(
          "SELECT id FROM finance_charges WHERE package_id = ? AND motivo = 'pacote' AND estornado_em IS NULL"
        )
        .get(id) as { id: number } | undefined
      if (charge) run('finance_charges', charge.id)
    }
    run(table, id)
    if (kind === 'use') {
      const pkg = db
        .prepare('SELECT patient_id FROM finance_packages WHERE id = ?')
        .get(row.package_id) as { patient_id: number }
      return pkg.patient_id
    }
    return row.patient_id!
  })()
}

type ChargeRow = Omit<ChargeEntry, 'estorno' | 'situacao' | 'pago_centavos'> &
  VoidColumns & { patient_id: number }
type PaymentRow = Omit<PaymentEntry, 'estorno' | 'observacao'> &
  VoidColumns & { observacao: string | null; patient_id: number }

const SELECT_CHARGES = `
  SELECT c.id, c.patient_id, c.data, c.descricao, c.valor_centavos, c.motivo, c.appointment_id, c.package_id,
         c.insurer_id, i.nome AS insurer_nome, c.computador, c.created_at, c.estornado_em,
         c.estorno_motivo, c.estorno_computador
  FROM finance_charges c
  LEFT JOIN finance_insurers i ON i.id = c.insurer_id`

const SELECT_PAYMENTS = `
  SELECT p.id, p.patient_id, p.data, p.valor_centavos, p.forma, p.insurer_id,
         i.nome AS insurer_nome, p.observacao, p.computador, p.created_at, p.estornado_em,
         p.estorno_motivo, p.estorno_computador
  FROM finance_payments p
  LEFT JOIN finance_insurers i ON i.id = p.insurer_id`

function paymentFromRow(row: PaymentRow): PaymentEntry {
  const { patient_id: _, ...rest } = withoutVoid(row)
  return { ...rest, observacao: row.observacao ?? '', estorno: estorno(row) }
}

const bucket = (insurerId: number | null): string =>
  insurerId === null ? 'familia' : `c${insurerId}`

function allocate(charges: ChargeRow[], payments: PaymentRow[]): ChargeEntry[] {
  const credit = new Map<string, number>()
  for (const p of payments)
    if (p.estornado_em === null)
      credit.set(bucket(p.insurer_id), (credit.get(bucket(p.insurer_id)) ?? 0) + p.valor_centavos)
  const ordered = [...charges].sort((a, b) =>
    a.data === b.data ? a.id - b.id : a.data < b.data ? -1 : 1
  )
  const result = new Map<number, ChargeEntry>()
  for (const c of ordered) {
    let situacao: SituacaoCobranca | null = null
    let pago = 0
    if (c.estornado_em === null) {
      const key = bucket(c.insurer_id)
      const available = credit.get(key) ?? 0
      pago = Math.min(available, c.valor_centavos)
      credit.set(key, available - pago)
      situacao = pago === c.valor_centavos ? 'pago' : pago > 0 ? 'parcial' : 'em_aberto'
    }
    const { patient_id: _, ...rest } = withoutVoid(c)
    result.set(c.id, { ...rest, estorno: estorno(c), situacao, pago_centavos: pago })
  }
  return charges.map((c) => result.get(c.id)!)
}

function saldos(
  charges: ChargeRow[],
  payments: PaymentRow[]
): { familia: number; convenios: SaldoConvenio[] } {
  const totals = new Map<string, SaldoConvenio>()
  let familia = 0
  const add = (insurerId: number | null, nome: string | null, value: number): void => {
    if (insurerId === null) {
      familia += value
      return
    }
    const current = totals.get(bucket(insurerId)) ?? {
      insurer_id: insurerId,
      nome: nome ?? '',
      saldo_centavos: 0
    }
    current.saldo_centavos += value
    totals.set(bucket(insurerId), current)
  }
  for (const c of charges)
    if (c.estornado_em === null) add(c.insurer_id, c.insurer_nome, c.valor_centavos)
  for (const p of payments)
    if (p.estornado_em === null) add(p.insurer_id, p.insurer_nome, -p.valor_centavos)
  return { familia, convenios: [...totals.values()] }
}

function packageUses(db: Db, patientId: number): PackageUseEntry[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.package_id, k.nome AS package_nome, k.sessoes, u.appointment_id, a.inicio,
              u.computador, u.created_at, u.estornado_em, u.estorno_motivo, u.estorno_computador
       FROM finance_package_uses u
       JOIN finance_packages k ON k.id = u.package_id
       JOIN appointments a ON a.id = u.appointment_id
       WHERE k.patient_id = ?
       ORDER BY a.inicio, u.id`
    )
    .all(patientId) as (Omit<PackageUseEntry, 'numero' | 'estorno'> & VoidColumns)[]
  const counters = new Map<number, number>()
  return rows.map((row) => {
    let numero: number | null = null
    if (row.estornado_em === null) {
      numero = (counters.get(row.package_id) ?? 0) + 1
      counters.set(row.package_id, numero)
    }
    return { ...withoutVoid(row), numero, estorno: estorno(row) }
  })
}

function pendingSessions(db: Db, patientId: number, desde: string): PendingSession[] {
  return db
    .prepare(
      `SELECT a.id AS appointment_id, a.inicio, t.nome AS tipo_nome,
              coalesce(a.categoria, t.categoria) AS categoria
       FROM appointments a
       ${TIPO_JOIN}
       WHERE a.patient_id = ? AND a.presenca = 'presente' AND substr(a.inicio, 1, 10) >= ?
         AND NOT EXISTS (SELECT 1 FROM finance_charges c
                         WHERE c.appointment_id = a.id AND c.estornado_em IS NULL)
         AND NOT EXISTS (SELECT 1 FROM finance_package_uses u
                         WHERE u.appointment_id = a.id AND u.estornado_em IS NULL)
         AND (NOT EXISTS (SELECT 1 FROM attendance_signatures s WHERE s.appointment_id = a.id)
              OR EXISTS (SELECT 1 FROM attendance_signatures s
                         WHERE s.appointment_id = a.id
                           AND s.id NOT IN (SELECT signature_id FROM attendance_voids)))
       ORDER BY a.inicio`
    )
    .all(patientId, desde) as PendingSession[]
}

function patientLedger(
  db: Db,
  patientId: number
): { charges: ChargeRow[]; payments: PaymentRow[] } {
  return {
    charges: db
      .prepare(`${SELECT_CHARGES} WHERE c.patient_id = ? ORDER BY c.data DESC, c.id DESC`)
      .all(patientId) as ChargeRow[],
    payments: db
      .prepare(`${SELECT_PAYMENTS} WHERE p.patient_id = ? ORDER BY p.data DESC, p.id DESC`)
      .all(patientId) as PaymentRow[]
  }
}

export function getPatientFinance(
  db: Db,
  patientId: number,
  today: string = toIsoDate(new Date())
): PatientFinance {
  getPatient(db, patientId)
  const billing = getBilling(db, patientId)
  const { charges, payments } = patientLedger(db, patientId)
  const saldo = saldos(charges, payments)
  const rows = packageRows(db, patientId)
  return {
    patient_id: patientId,
    billing,
    saldo_centavos: saldo.familia,
    convenios: saldo.convenios.filter((c) => c.saldo_centavos !== 0),
    packages: rows.map((row) => toPackage(row, today)).reverse(),
    charges: allocate(charges, payments),
    payments: payments.map(paymentFromRow),
    uses: packageUses(db, patientId).reverse(),
    pendentes: billing ? pendingSessions(db, patientId, billing.desde) : [],
    renovacao: renovacaoFrom(billing, rows, planOrNull(db), today)
  }
}

export function situacaoSessoes(db: Db, appointmentIds: number[]): SessionPayStatus[] {
  const ledgers = new Map<number, { charges: ChargeEntry[]; uses: PackageUseEntry[] }>()
  return appointmentIds.map((appointmentId): SessionPayStatus => {
    const entry = activeEntry(db, appointmentId)
    if (!entry) return { appointment_id: appointmentId, situacao: 'sem_lancamento' }
    const { patient_id } = getAppointment(db, appointmentId)
    let ledger = ledgers.get(patient_id)
    if (!ledger) {
      const { charges, payments } = patientLedger(db, patient_id)
      ledger = {
        charges: allocate(charges, payments),
        uses: packageUses(db, patient_id)
      }
      ledgers.set(patient_id, ledger)
    }
    if (entry.kind === 'use') {
      const use = ledger.uses.find((u) => u.id === entry.id)!
      return {
        appointment_id: appointmentId,
        situacao: 'pacote',
        package_id: use.package_id,
        numero: use.numero ?? 0,
        sessoes: use.sessoes
      }
    }
    const charge = ledger.charges.find((c) => c.id === entry.id)!
    return {
      appointment_id: appointmentId,
      situacao: charge.situacao ?? 'em_aberto',
      charge_id: charge.id,
      valor_centavos: charge.valor_centavos,
      insurer_nome: charge.insurer_nome
    }
  })
}

type SaldoRow = { patient_id: number; insurer_id: number | null; saldo: number }

function nomesDos(db: Db, ids: number[]): Map<number, string> {
  const rows = db
    .prepare('SELECT id, nome FROM patients WHERE id IN (SELECT value FROM json_each(?))')
    .all(JSON.stringify([...new Set(ids)])) as { id: number; nome: string }[]
  return new Map(rows.map((p) => [p.id, p.nome]))
}

function aRenovar(db: Db, today: string): FinanceOverview['renovar'] {
  const plans = planOrNull(db)
  const pacientes = db
    .prepare(
      `SELECT b.patient_id, p.nome FROM finance_billing b JOIN patients p ON p.id = b.patient_id
       WHERE b.forma = 'pacote' AND p.ativo = 1 ORDER BY p.nome COLLATE NOCASE`
    )
    .all() as { patient_id: number; nome: string }[]
  return pacientes.flatMap(({ patient_id, nome }) => {
    const r = renovacaoFrom(getBilling(db, patient_id), packageRows(db, patient_id), plans, today)
    return r ? [{ ...r, patient_id, patient_nome: nome }] : []
  })
}

export function getOverview(
  db: Db,
  de: string,
  ate: string,
  today: string = toIsoDate(new Date())
): FinanceOverview {
  const saldosRows = db
    .prepare(
      `SELECT patient_id, insurer_id, sum(valor) AS saldo
       FROM (SELECT patient_id, insurer_id, valor_centavos AS valor
             FROM finance_charges WHERE estornado_em IS NULL
             UNION ALL
             SELECT patient_id, insurer_id, -valor_centavos
             FROM finance_payments WHERE estornado_em IS NULL)
       GROUP BY patient_id, insurer_id`
    )
    .all() as SaldoRow[]
  const insurerNames = new Map(
    (
      db.prepare('SELECT id, nome FROM finance_insurers').all() as { id: number; nome: string }[]
    ).map((i) => [i.id, i.nome])
  )

  const convenios = new Map<number, SaldoConvenio>()
  const devedores: { patient_id: number; saldo: number }[] = []
  for (const row of saldosRows) {
    if (row.insurer_id === null) {
      if (row.saldo > 0) devedores.push({ patient_id: row.patient_id, saldo: row.saldo })
      continue
    }
    const current = convenios.get(row.insurer_id) ?? {
      insurer_id: row.insurer_id,
      nome: insurerNames.get(row.insurer_id) ?? '',
      saldo_centavos: 0
    }
    current.saldo_centavos += row.saldo
    convenios.set(row.insurer_id, current)
  }

  const recebidos = db
    .prepare(`${SELECT_PAYMENTS} WHERE p.estornado_em IS NULL AND p.data >= ? AND p.data <= ?`)
    .all(de, ate) as PaymentRow[]
  const names = nomesDos(db, [
    ...devedores.map((d) => d.patient_id),
    ...recebidos.map((p) => p.patient_id)
  ])

  const abertos: FinanceOverview['abertos'] = devedores.map(({ patient_id, saldo }) => {
    const { charges, payments } = patientLedger(db, patient_id)
    const open = allocate(charges, payments)
      .filter((c) => c.estorno === null && c.insurer_id === null && c.situacao !== 'pago')
      .map((c) => c.data)
      .sort()
    return {
      patient_id,
      nome: names.get(patient_id) ?? '',
      saldo_centavos: saldo,
      desde: open[0] ?? ''
    }
  })
  abertos.sort((a, b) => b.saldo_centavos - a.saldo_centavos || a.nome.localeCompare(b.nome))

  const recebimentos = recebidos
    .sort((a, b) => (a.data === b.data ? b.id - a.id : a.data < b.data ? 1 : -1))
    .map((p) => ({
      ...paymentFromRow(p),
      patient_id: p.patient_id,
      patient_nome: names.get(p.patient_id) ?? ''
    }))
  const por_forma = Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, 0])) as Record<
    (typeof FORMAS_PAGAMENTO)[number],
    number
  >
  for (const p of recebimentos) por_forma[p.forma] += p.valor_centavos

  return {
    de,
    ate,
    abertos,
    renovar: aRenovar(db, today),
    convenios: [...convenios.values()]
      .filter((c) => c.saldo_centavos !== 0)
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    recebimentos,
    total_centavos: recebimentos.reduce((sum, p) => sum + p.valor_centavos, 0),
    por_forma
  }
}
