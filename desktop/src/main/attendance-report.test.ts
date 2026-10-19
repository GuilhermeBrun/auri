import { describe, expect, it } from 'vite-plus/test'
import type { Appointment, AttendanceRecord, AttendanceReport } from '../shared/schemas'
import { paraBase64url } from '../../../web/contrato/assinatura/base64url'
import { codificar } from '../../../web/contrato/assinatura/traco'
import { attendanceReportHtml, attendanceReportName } from './attendance-report'
import { esc, periodLabel } from './document'

const TRACO = paraBase64url(
  codificar([
    [
      [100, 200],
      [300, 120],
      [500, 260]
    ]
  ])
)

const clinic: AttendanceReport['clinic'] = {
  nome: 'Clínica <b>Fictícia</b>',
  documento: '',
  endereco: 'Rua Inventada, 10',
  telefone: '',
  whatsapp: '',
  profissional: 'Lara Fictícia',
  registro: 'CRFa 0-0000',
  logo: '',
  funcionamento: {},
  updated_at: '2026-10-01T00:00:00.000Z'
}

function session(
  id: number,
  inicio: string,
  presenca: Appointment['presenca'],
  records: AttendanceRecord[] = []
): AttendanceReport['sessions'][number] {
  return {
    id,
    patient_id: 7,
    patient_nome: 'Helena Fictícia',
    inicio,
    fim: inicio.replace(':00', ':45'),
    observacao: '',
    tipo_id: 1,
    tipo_nome: 'Sessão',
    tipo_cor: 'grafite',
    categoria: 'sessao',
    etiquetas: [],
    presenca,
    evolucao: '',
    confirmado_em: null,
    assinatura: null,
    created_at: '',
    updated_at: '',
    records
  }
}

function record(
  id: number,
  appointmentId: number,
  extra: Partial<AttendanceRecord> = {}
): AttendanceRecord {
  return {
    id,
    appointment_id: appointmentId,
    inicio: '2026-10-19T14:00',
    fim: '2026-10-19T14:45',
    tipo_nome: 'Sessão',
    categoria: 'sessao',
    signer_nome: 'Marina "Mãe" Fictícia',
    signer_papel: 'mae',
    signer_parentesco: 'Mãe',
    traco: TRACO,
    assinado_em: '2026-10-19T16:52:30.000Z',
    fuso_minutos: -180,
    computador: 'Recepção',
    registro_sha256: 'a'.repeat(64),
    anulada: null,
    ...extra
  }
}

const report: AttendanceReport = {
  clinic,
  patient: { id: 7, nome: 'Helena <Fictícia>', data_nascimento: '2019-03-12' },
  de: '2026-10-01',
  ate: '2026-10-31',
  sessions: [
    session(1, '2026-10-05T14:00', 'falta'),
    session(2, '2026-10-12T14:00', 'presente', [
      record(10, 2, {
        signer_nome: 'Avó Fictícia',
        anulada: {
          motivo: 'Assinou na sessão errada',
          anulado_em: '2026-10-12T17:10:00.000Z',
          computador: 'Recepção'
        }
      })
    ]),
    session(3, '2026-10-19T14:00', 'presente', [record(11, 3)])
  ]
}

const NOW = new Date(2026, 9, 31, 18, 0)

describe('relatório de presença em HTML', () => {
  const html = attendanceReportHtml(report, { font: 'AAAA', now: NOW })

  it('escapa o texto vindo do banco', () => {
    expect(html).toContain('Clínica &lt;b&gt;Fictícia&lt;/b&gt;')
    expect(html).toContain('Helena &lt;Fictícia&gt;')
    expect(html).toContain('Marina &quot;Mãe&quot; Fictícia')
    expect(html).not.toContain('<b>Fictícia</b>')
    expect(esc(`<a href='x'>&`)).toBe('&lt;a href=&#39;x&#39;&gt;&amp;')
  })

  it('soma o período', () => {
    expect(html).toContain('<span>3 sessões</span>')
    expect(html).toContain('<span>2 presenças</span>')
    expect(html).toContain('<span>1 chegada assinada</span>')
    expect(html).toContain('<span>1 falta</span>')
    expect(html).not.toContain('desmarcada')
  })

  it('mostra a hora da assinatura no fuso de quem assinou', () => {
    expect(html).toContain('Mãe · 13:52')
    expect(html).toContain('19/10/2026 13:52')
  })

  it('mantém a assinatura anulada com o motivo', () => {
    expect(html).toContain('Assinatura de Avó Fictícia anulada em')
    expect(html).toContain('Assinou na sessão errada')
    expect(html).toContain('<span class="status">anulada</span>')
  })

  it('desenha a assinatura em SVG e leva o código de cada registro', () => {
    expect(html).toMatch(/<svg class="sig" viewBox="0 0 1000 400"[^>]*><path d="M/)
    expect(html.match(/a{64}/g)).toHaveLength(2)
  })

  it('não carrega nada de fora', () => {
    expect(html).toContain("default-src 'none'")
    expect(html).not.toMatch(/(src|href)="https?:/)
  })

  it('cabeçalho com o mês, idade e profissional', () => {
    expect(html).toContain('<p>Outubro de 2026</p>')
    expect(html).toContain('12/03/2019 (7 anos e 7 meses)')
    expect(html).toContain('Lara Fictícia · CRFa 0-0000')
    expect(html).toContain('Gerado pelo Auri em 31/10/2026 às 18:00')
  })

  it('período sem sessões', () => {
    const empty = attendanceReportHtml({ ...report, sessions: [] }, { font: '', now: NOW })
    expect(empty).toContain('Nenhuma sessão neste período.')
    expect(empty).not.toContain('Registros das assinaturas')
  })
})

describe('nome e período', () => {
  it('mês inteiro, intervalo e um dia', () => {
    expect(periodLabel('2026-10-01', '2026-10-31')).toBe('outubro de 2026')
    expect(periodLabel('2026-10-01', '2026-11-15')).toBe('01/10/2026 a 15/11/2026')
    expect(periodLabel('2026-10-19', '2026-10-19')).toBe('19/10/2026')
  })

  it('nome do arquivo sem caracteres proibidos', () => {
    expect(attendanceReportName(report)).toBe('Presença - Helena Fictícia - outubro de 2026.pdf')
    expect(attendanceReportName({ ...report, ate: '2026-11-15' })).toBe(
      'Presença - Helena Fictícia - 01-10-2026 a 15-11-2026.pdf'
    )
  })
})
