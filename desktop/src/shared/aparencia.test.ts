import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vite-plus/test'
import {
  BASE_HIGH_CONTRAST,
  BASE_TOKENS,
  COLOR_PRESETS,
  colorsLabel,
  contrast,
  contrastIssues,
  DEFAULT_COLORS,
  largestTextSize,
  palette,
  paletteCss,
  sidebarPalette,
  surfaceColor,
  type RoleOverrides,
  type Scheme,
  type ThemeColors
} from './aparencia'

const css = readFileSync(join(__dirname, '../renderer/src/assets/main.css'), 'utf8')

function cssBlock(start: string): string {
  const from = css.indexOf(start)
  return css.slice(from, css.indexOf('}', from))
}

const SCHEMES: Scheme[] = ['light', 'dark']

const cores = (
  accent: string | null,
  canvas: string | null,
  light: RoleOverrides = {},
  dark: RoleOverrides = {}
): ThemeColors => ({ accent, canvas, overrides: { light, dark } })

const STRESS = [
  '#ffeb3b',
  '#00ff00',
  '#000000',
  '#ffffff',
  '#1e3a8a',
  '#f472b6',
  '#7dd3fc',
  '#3f2a14'
]

describe('cores do tema', () => {
  it('parte dos mesmos valores do main.css', () => {
    const light = cssBlock('@theme {')
    const dark = cssBlock('@media (prefers-color-scheme: dark)')
    for (const [token, hex] of Object.entries(BASE_TOKENS.light)) {
      expect(light).toContain(`--color-${token}: ${hex};`)
    }
    for (const [token, hex] of Object.entries(BASE_TOKENS.dark)) {
      expect(dark).toContain(`--color-${token}: ${hex};`)
    }
    const more = cssBlock('@media (prefers-contrast: more) {')
    for (const [token, hex] of Object.entries(BASE_HIGH_CONTRAST.light)) {
      expect(more).toContain(`--color-${token}: ${hex};`)
    }
  })

  it('sem cor escolhida não muda nada', () => {
    expect(paletteCss(DEFAULT_COLORS)).toBe('')
    expect(surfaceColor(DEFAULT_COLORS, 'light')).toBe('#ffffff')
    expect(surfaceColor(DEFAULT_COLORS, 'dark')).toBe('#17171c')
  })

  it('usa o fundo escolhido quando ele é do mesmo tema', () => {
    expect(surfaceColor(cores(null, '#fbf6f2'), 'light')).toBe('#fbf6f2')
    expect(surfaceColor(cores(null, '#1a1b26'), 'dark')).toBe('#1a1b26')
  })

  it('mantém texto, botões e foco legíveis com qualquer cor', () => {
    const colors = [
      ...COLOR_PRESETS.map((p) => p.colors),
      ...STRESS.flatMap((accent) => STRESS.map((canvas) => cores(accent, canvas)))
    ]
    for (const c of colors) {
      for (const scheme of SCHEMES) {
        for (const more of [false, true]) {
          const p = palette(c, scheme, more)
          const backgrounds = ['surface', 'canvas', 'sidebar', 'raised', 'subtle'].map(
            (t) => p[`--color-${t}`]
          )
          for (const bg of backgrounds) {
            expect(contrast(p['--color-ink'], bg)).toBeGreaterThanOrEqual(more ? 7 : 4.5)
            expect(contrast(p['--color-ink-soft'], bg)).toBeGreaterThanOrEqual(more ? 7 : 4.5)
            expect(contrast(p['--color-ink-faint'], bg)).toBeGreaterThanOrEqual(more ? 7 : 4.5)
          }
          expect(contrast(p['--color-control'], p['--color-surface'])).toBeGreaterThanOrEqual(3)
          if (c.accent) {
            for (const solid of ['solid', 'solid-hover', 'solid-active']) {
              expect(contrast(p[`--color-${solid}`], p['--color-on-solid'])).toBeGreaterThanOrEqual(
                4.5
              )
            }
            for (const bg of backgrounds) {
              expect(contrast(p['--color-accent'], bg)).toBeGreaterThanOrEqual(3)
            }
          }
        }
      }
    }
  })

  it('o claro continua claro e o escuro continua escuro', () => {
    for (const canvas of STRESS) {
      expect(contrast(surfaceColor(cores(null, canvas), 'light'), '#000000')).toBeGreaterThan(15)
      expect(contrast(surfaceColor(cores(null, canvas), 'dark'), '#ffffff')).toBeGreaterThan(13)
    }
  })

  it('dá nome às cores prontas e mostra o código das personalizadas', () => {
    expect(colorsLabel(DEFAULT_COLORS)).toBe('Grafite')
    expect(colorsLabel(cores('#2563eb', '#f4f7fc'))).toBe('Oceano')
    expect(colorsLabel(cores('#123456', null))).toBe('Personalizadas (#123456)')
  })

  it('só aumenta o texto até onde a área de 1000×640 ainda cabe na tela', () => {
    expect(largestTextSize({ width: 1920, height: 1040 })).toBe(1.3)
    expect(largestTextSize({ width: 1536, height: 824 })).toBe(1.2)
    expect(largestTextSize({ width: 1366, height: 728 })).toBe(1.1)
    expect(largestTextSize({ width: 1280, height: 680 })).toBe(1)
    expect(largestTextSize({ width: 900, height: 600 })).toBe(1)
  })

  it('no modo avançado usa a cor exata de cada papel e deriva as vizinhas', () => {
    const c = cores('#bf5530', '#fbf6f2', {
      session: '#dbeafe',
      solid: '#0f172a',
      danger: '#7c3aed'
    })
    const p = palette(c, 'light')
    expect(p['--color-session']).toBe('#dbeafe')
    expect(p['--color-session-hover']).not.toBe('#dbeafe')
    expect(p['--color-solid']).toBe('#0f172a')
    expect(contrast(p['--color-on-solid'], '#0f172a')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p['--color-solid-hover'], p['--color-on-solid'])).toBeGreaterThanOrEqual(4.5)
    expect(p['--color-danger']).toBe('#7c3aed')
    expect(contrast(p['--color-danger'], p['--color-danger-soft'])).toBeGreaterThanOrEqual(4.5)
    expect(palette(c, 'dark')['--color-session']).not.toBe('#dbeafe')
  })

  it('barra lateral escura num tema claro ganha texto próprio legível', () => {
    const c = cores(null, null, { sidebar: '#1e2a44' })
    expect(palette(c, 'light')['--color-ink']).toBe(BASE_TOKENS.light.ink)
    const sidebar = sidebarPalette(c, 'light')!
    for (const token of ['ink', 'ink-soft', 'ink-faint']) {
      expect(contrast(sidebar[`--color-${token}`], '#1e2a44')).toBeGreaterThanOrEqual(4.5)
    }
    expect(sidebarPalette(cores('#bf5530', null), 'light')).toBeNull()
    expect(paletteCss(c)).toContain('#sidebar, [data-on-sidebar]')
    expect(contrastIssues(c, 'light')).toEqual({})
  })

  it('avisa quando uma cor escolhida fica difícil de ler', () => {
    const issues = contrastIssues(cores(null, null, { 'ink-soft': '#d0d0d0' }), 'light')
    expect(issues['ink-soft']).toMatch(/^1,\d:1 sobre o fundo das telas/)
    expect(contrastIssues(DEFAULT_COLORS, 'light')).toEqual({})
    expect(contrastIssues(DEFAULT_COLORS, 'dark')).toEqual({})
  })

  it('trocar o fundo das telas leva junto menus, linhas e sessões, e o texto acompanha', () => {
    const navy = palette(cores(null, null, {}, { surface: '#111827' }), 'dark')
    expect(navy['--color-surface']).toBe('#111827')
    for (const token of ['raised', 'line', 'session', 'canvas']) {
      expect(navy[`--color-${token}`]).not.toBe(palette(DEFAULT_COLORS, 'dark')[`--color-${token}`])
    }
    const inverted = palette(cores(null, null, { surface: '#202020' }), 'light')
    expect(contrast(inverted['--color-ink'], '#202020')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(inverted['--color-ink-soft'], '#202020')).toBeGreaterThanOrEqual(4.5)
  })
})
