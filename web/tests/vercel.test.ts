import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vite-plus/test'

type Regra = { source: string; headers: { key: string; value: string }[] }
type Reescrita = { source: string; destination: string }

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: Regra[]
  rewrites: Reescrita[]
}

function cabecalhos(caminho: string): Map<string, string[]> {
  const encontrados = new Map<string, string[]>()
  for (const { source, headers } of vercel.headers) {
    if (!new RegExp(`^${source}$`).test(caminho)) continue
    for (const { key, value } of headers)
      encontrados.set(key, [...(encontrados.get(key) ?? []), value])
  }
  return encontrados
}

describe('cabeçalhos da Vercel', () => {
  test.each(['/assinar', '/assinar/', '/assinar/index.html', '/recebido', '/recebido/'])(
    '%s: CSP própria, sem conexão nenhuma, e fora da busca',
    (caminho) => {
      const csp = cabecalhos(caminho).get('Content-Security-Policy')
      expect(csp).toHaveLength(1)
      expect(csp?.[0]).toContain("connect-src 'none'")
      expect(csp?.[0]).toContain("default-src 'none'")
      expect(csp?.[0]).not.toContain('unsafe-inline')
      expect(cabecalhos(caminho).get('X-Robots-Tag')).toEqual(['noindex'])
      expect(cabecalhos(caminho).get('Referrer-Policy')).toEqual(['no-referrer'])
    }
  )

  test.each(['/', '/index.html', '/api/erros'])('%s: continua com a CSP do site', (caminho) => {
    const csp = cabecalhos(caminho).get('Content-Security-Policy')
    expect(csp).toHaveLength(1)
    expect(csp?.[0]).toContain("connect-src 'self'")
    expect(cabecalhos(caminho).get('X-Robots-Tag')).toBeUndefined()
  })

  test('as páginas abrem sem a barra no fim', () => {
    expect(vercel.rewrites).toEqual(
      expect.arrayContaining([
        { source: '/assinar', destination: '/assinar/index.html' },
        { source: '/recebido', destination: '/recebido/index.html' }
      ])
    )
  })
})
