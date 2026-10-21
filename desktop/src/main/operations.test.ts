import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { AgendaNoticeDraft } from '../shared/agenda-notice'
import { emptyPatientInput } from '../shared/schemas'
import { openDatabase, type Db } from './db/connection'
import { runOperation } from './operations'

let db: Db
let patientId: number
let notices: (AgendaNoticeDraft | null)[]

function run(channel: string, ...args: unknown[]): { id: number; updated_at: string } {
  const result = runOperation(db, channel, args, (_, notice) => notices.push(notice))
  if (!result.ok) throw new Error(result.error)
  return result.data as { id: number; updated_at: string }
}

const sessao = (inicio: string, fim: string, extra: object = {}): object => ({
  patient_id: patientId,
  inicio,
  fim,
  observacao: '',
  ...extra
})

beforeEach(() => {
  db = openDatabase(':memory:')
  notices = []
  patientId = run('patients:create', { ...emptyPatientInput(), nome: 'Ana de Souza Lima' }).id
  notices = []
})

describe('avisos da agenda', () => {
  it('marcar, remarcar, desmarcar e excluir viram avisos com o nome curto', () => {
    const a = run('appointments:create', sessao('2025-09-08T14:00', '2025-09-08T14:30'))
    const moved = run(
      'appointments:move',
      a.id,
      { inicio: '2025-09-09T10:00', fim: '2025-09-09T10:30' },
      a.updated_at,
      'Recepção'
    )
    const desmarcada = run(
      'appointments:update',
      a.id,
      sessao('2025-09-09T10:00', '2025-09-09T10:30', { presenca: 'desmarcou' }),
      moved.updated_at,
      'Recepção'
    )
    expect(desmarcada.id).toBe(a.id)
    run('appointments:remove', a.id)
    expect(notices).toEqual(
      [
        { change: 'marcou', kind: 'sessao', nome: 'Ana Souza', inicio: '2025-09-08T14:00' },
        {
          change: 'remarcou',
          kind: 'sessao',
          nome: 'Ana Souza',
          inicio: '2025-09-09T10:00',
          antes: '2025-09-08T14:00'
        },
        { change: 'desmarcou', kind: 'sessao', nome: 'Ana Souza', inicio: '2025-09-09T10:00' },
        { change: 'excluiu', kind: 'sessao', nome: 'Ana Souza', inicio: '2025-09-09T10:00' }
      ].map((n) => expect.objectContaining(n))
    )
  })

  it('escrever só a observação ou a evolução não avisa ninguém', () => {
    const a = run('appointments:create', sessao('2025-09-08T14:00', '2025-09-08T14:30'))
    run(
      'appointments:update',
      a.id,
      sessao('2025-09-08T14:00', '2025-09-08T14:30', { observacao: 'Trazer exames' }),
      a.updated_at,
      'Consultório'
    )
    expect(notices.at(-1)).toBeNull()
  })

  it('compromissos também avisam, e cadastro de paciente não', () => {
    const reuniao = (run('tipos:list') as unknown as { id: number; nome: string }[]).find(
      (t) => t.nome === 'Reunião'
    )!
    const c = run('commitments:create', {
      etiqueta_id: reuniao.id,
      titulo: 'Equipe',
      inicio: '2025-09-08T12:00',
      fim: '2025-09-08T13:00',
      observacao: ''
    })
    run('commitments:remove', c.id)
    run('patients:create', { ...emptyPatientInput(), nome: 'Outra Pessoa' })
    expect(notices).toEqual([
      expect.objectContaining({ change: 'marcou', kind: 'compromisso', nome: 'Reunião: Equipe' }),
      expect.objectContaining({ change: 'excluiu', kind: 'compromisso', nome: 'Reunião: Equipe' }),
      null
    ])
  })
})
