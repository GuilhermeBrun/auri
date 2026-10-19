import { describe, expect, it } from 'vite-plus/test'
import type { SignedTermRecord } from '../shared/schemas'
import { paraBase64url } from '../../../web/contrato/assinatura/base64url'
import { codificar } from '../../../web/contrato/assinatura/traco'
import { utcLabel } from './document'
import { termBodyHtml, termHtml, termPdfName } from './term-report'

const record: SignedTermRecord = {
  id: 1,
  envio: 'AAECAwQFBgcICQoLDA0ODw',
  titulo: 'Consentimento <b>',
  versao: 2,
  texto: '# Termo\n\nAutorizo **Helena Fictícia**.\n\n- um\n- dois <script>',
  texto_sha256: 'a'.repeat(64),
  clinica: 'Clínica Fictícia',
  profissional: { nome: 'Lara Fictícia', registro: 'CRFa 0-0000' },
  paciente: { nome: 'Helena Fictícia', nascimento: '2019-03-12' },
  nome: 'Marina Fictícia',
  cpf: '12345678909',
  parentesco: 'Mãe',
  traco: paraBase64url(
    codificar([
      [
        [100, 200],
        [300, 120],
        [500, 260]
      ]
    ])
  ),
  assinado_em: Math.floor(Date.UTC(2026, 9, 19, 18, 32) / 1000),
  fuso_minutos: -240,
  recebido_em: '2026-10-19T18:40:00.000Z',
  enviado_em: '2026-10-19T15:00:00.000Z',
  destino_numero: '5565999991234',
  registro_sha256: 'b'.repeat(64),
  logo: ''
}

describe('PDF do termo', () => {
  const html = termHtml(record, { font: 'AAAA' })

  it('desenha o texto do termo sem HTML vindo de fora', () => {
    expect(termBodyHtml(record.texto)).toBe(
      '<h2>Termo</h2><p>Autorizo <strong>Helena Fictícia</strong>.</p><ul><li>um</li><li>dois &lt;script&gt;</li></ul>'
    )
    expect(html).toContain('Consentimento &lt;b&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain("default-src 'none'")
  })

  it('quem assinou, as duas horas e o registro técnico', () => {
    expect(html).toContain('CPF 123.456.789-09 · Mãe')
    expect(html).toContain('Assinado no celular em 19/10/2026 às 14:32 (hora do aparelho, UTC−4)')
    expect(html).toContain('para (65) 99999-1234')
    expect(html).toContain('a'.repeat(64))
    expect(html).toContain('b'.repeat(64))
    expect(html).toContain('Lei 14.063/2020')
    expect(html).toMatch(/<svg class="sig"[^>]*><path d="M/)
  })

  it('fuso e nome do arquivo', () => {
    expect(utcLabel(-180)).toBe('UTC−3')
    expect(utcLabel(330)).toBe('UTC+5:30')
    expect(termPdfName(record)).toBe('Consentimento b - Helena Fictícia - 19-10-2026.pdf')
  })
})
