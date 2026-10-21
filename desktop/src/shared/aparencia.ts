export const TEXT_SIZES = [1, 1.1, 1.2, 1.3] as const

export type TextSize = (typeof TEXT_SIZES)[number]

export const MIN_WINDOW = { width: 1000, height: 640 }

export function largestTextSize(area: { width: number; height: number }): TextSize {
  return (
    TEXT_SIZES.findLast(
      (size) => area.width >= MIN_WINDOW.width * size && area.height >= MIN_WINDOW.height * size
    ) ?? 1
  )
}

export const COLOR_ROLES = [
  { token: 'surface', label: 'Fundo das telas', group: 'Telas' },
  { token: 'sidebar', label: 'Barra lateral', group: 'Telas' },
  { token: 'sidebar-ink', label: 'Texto da barra lateral', group: 'Telas' },
  { token: 'raised', label: 'Menus e diálogos', group: 'Telas' },
  { token: 'canvas', label: 'Blocos de apoio', group: 'Telas' },
  { token: 'line', label: 'Linhas e grade', group: 'Telas' },
  { token: 'control', label: 'Contorno dos campos', group: 'Telas' },
  { token: 'ink', label: 'Texto', group: 'Texto' },
  { token: 'ink-soft', label: 'Texto secundário', group: 'Texto' },
  { token: 'ink-faint', label: 'Texto apagado', group: 'Texto' },
  { token: 'solid', label: 'Botão principal', group: 'Ações' },
  { token: 'on-solid', label: 'Texto do botão principal', group: 'Ações' },
  { token: 'accent', label: 'Foco e seleção', group: 'Ações' },
  { token: 'accent-soft', label: 'Realce suave', group: 'Ações' },
  { token: 'now', label: 'Linha de agora', group: 'Agenda' },
  { token: 'danger', label: 'Erro e exclusão', group: 'Avisos' },
  { token: 'warning', label: 'Atenção', group: 'Avisos' }
] as const

export type ColorRole = (typeof COLOR_ROLES)[number]['token']

export const ROLE_TOKENS = COLOR_ROLES.map((r) => r.token) as [ColorRole, ...ColorRole[]]

export type RoleOverrides = Partial<Record<ColorRole, string>>

export type ThemeColors = {
  accent: string | null
  canvas: string | null
  overrides: Record<Scheme, RoleOverrides>
}

export const DEFAULT_COLORS: ThemeColors = {
  accent: null,
  canvas: null,
  overrides: { light: {}, dark: {} }
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/

export type Scheme = 'light' | 'dark'

type Oklch = { l: number; c: number; h: number }

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toLinear = (c: number): number => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const fromLinear = (v: number): number =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function toOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

function linearRgb({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180)
  const B = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ]
}

const inGamut = (color: Oklch): boolean =>
  linearRgb(color).every((v) => v >= -0.0001 && v <= 1.0001)

function toHex(color: Oklch): string {
  let fitted = { ...color, l: clamp(color.l, 0, 1) }
  if (!inGamut(fitted)) {
    let low = 0
    let high = fitted.c
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2
      if (inGamut({ ...fitted, c: mid })) low = mid
      else high = mid
    }
    fitted = { ...fitted, c: low }
  }
  return `#${linearRgb(fitted)
    .map((v) => Math.round(clamp(fromLinear(clamp(v, 0, 1)), 0, 255)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

function untilContrast(color: Oklch, against: string[], ratio: number, step: number): string {
  let next = color
  for (let i = 0; i < 100; i++) {
    const hex = toHex(next)
    if (against.every((other) => contrast(hex, other) >= ratio)) return hex
    if (next.l <= 0 || next.l >= 1) return hex
    next = { ...next, l: clamp(next.l + step, 0, 1) }
  }
  return toHex(next)
}

const SURFACE_TOKENS = [
  'canvas',
  'surface',
  'raised',
  'selected',
  'subtle',
  'sidebar',
  'line',
  'line-strong',
  'session',
  'accent-soft'
] as const

const INK_TOKENS = ['ink', 'ink-soft', 'ink-faint', 'control'] as const

const SOLID_TOKENS = ['accent', 'solid', 'solid-hover', 'solid-active', 'on-solid'] as const

const STATUS_TOKENS = [
  'danger',
  'danger-soft',
  'danger-soft-hover',
  'warning',
  'warning-soft',
  'attention',
  'now'
] as const

type Token =
  | (typeof SURFACE_TOKENS)[number]
  | (typeof INK_TOKENS)[number]
  | (typeof SOLID_TOKENS)[number]
  | (typeof STATUS_TOKENS)[number]

export const BASE_TOKENS: Record<Scheme, Record<Token, string>> = {
  light: {
    canvas: '#f4f4f7',
    surface: '#ffffff',
    raised: '#ffffff',
    selected: '#ffffff',
    subtle: '#f8f8fa',
    sidebar: '#f4f4f7',
    line: '#e6e6ec',
    'line-strong': '#c9c9d4',
    session: '#e6e6ec',
    'accent-soft': '#eeeef3',
    ink: '#1b1b22',
    'ink-soft': '#5b5b68',
    'ink-faint': '#6e6e7c',
    control: '#8e8e9c',
    accent: '#1b1b22',
    solid: '#1b1b22',
    'solid-hover': '#34343f',
    'solid-active': '#000000',
    'on-solid': '#ffffff',
    danger: '#c4271b',
    'danger-soft': '#fdeeec',
    'danger-soft-hover': '#f9d5d1',
    warning: '#8a5300',
    'warning-soft': '#fdf3dc',
    attention: '#e5484d',
    now: '#e5484d'
  },
  dark: {
    canvas: '#212128',
    surface: '#17171c',
    raised: '#212128',
    selected: '#36363f',
    subtle: '#1c1c22',
    sidebar: '#101014',
    line: '#2a2a32',
    'line-strong': '#42424d',
    session: '#2f2f38',
    'accent-soft': '#2a2a32',
    ink: '#ececf1',
    'ink-soft': '#a9a9b7',
    'ink-faint': '#8a8a98',
    control: '#6c6c7a',
    accent: '#ececf1',
    solid: '#42424d',
    'solid-hover': '#4b4b57',
    'solid-active': '#55555f',
    'on-solid': '#ececf1',
    danger: '#f0675b',
    'danger-soft': '#3a1b1a',
    'danger-soft-hover': '#562826',
    warning: '#f1b54a',
    'warning-soft': '#33270f',
    attention: '#ff5a5f',
    now: '#ff5a5f'
  }
}

export const BASE_HIGH_CONTRAST: Record<Scheme, Partial<Record<Token, string>>> = {
  light: {
    'ink-soft': '#3f3f4a',
    'ink-faint': '#54545f',
    line: '#8e8e9c',
    'line-strong': '#6e6e7c',
    control: '#5b5b68',
    danger: '#a8190f',
    warning: '#6e4200'
  },
  dark: {
    'ink-soft': '#c4c4d0',
    'ink-faint': '#b0b0be',
    line: '#6c6c7a',
    'line-strong': '#8a8a98',
    control: '#9c9caa',
    danger: '#ff8a80',
    warning: '#ffc966'
  }
}

const BASE_SELECTION: Record<Scheme, string> = { light: '#dcdce5', dark: '#3a3a46' }

const ALPHAS: Record<Scheme, Record<string, number>> = {
  light: {
    '--color-fill': 0.055,
    '--color-fill-hover': 0.09,
    '--scrollbar': 0.3,
    '--grid-faint': 0.07,
    '--session-edge': 0.12,
    '--slot-selection': 0.08
  },
  dark: {
    '--color-fill': 0.06,
    '--color-fill-hover': 0.1,
    '--scrollbar': 0.25,
    '--grid-faint': 0.06,
    '--session-edge': 0.08,
    '--slot-selection': 0.08
  }
}

const SURFACE_LIGHTNESS: Record<Scheme, [number, number]> = {
  light: [0.94, 1],
  dark: [0.14, 0.27]
}

export type Tint = { shift: number; chroma: number; inkChroma: number; hue: number }

export function canvasTint(canvas: string | null, scheme: Scheme): Tint | null {
  if (!canvas) return null
  const pick = toOklch(canvas)
  const base = toOklch(BASE_TOKENS[scheme].surface).l
  const [min, max] = SURFACE_LIGHTNESS[scheme]
  const ownScheme = scheme === 'light' ? pick.l >= 0.5 : pick.l < 0.5
  return {
    shift: ownScheme ? clamp(pick.l, min, max) - base : 0,
    chroma: Math.min(pick.c, 0.045),
    inkChroma: Math.min(pick.c, 0.04) * 0.6,
    hue: pick.h
  }
}

export function tintSurface(hex: string, tint: Tint | null): string {
  if (!tint) return hex
  const { l } = toOklch(hex)
  return toHex({ l: l + tint.shift, c: tint.chroma, h: tint.hue })
}

function tintInk(hex: string, tint: Tint | null): string {
  if (!tint) return hex
  return toHex({ l: toOklch(hex).l, c: tint.inkChroma, h: tint.hue })
}

function rgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgb(hex).join(', ')}, ${alpha})`
}

function shade(hex: string, delta: number, on: string): string {
  const color = toOklch(hex)
  const away = luminance(on) > 0.5 ? -0.02 : 0.02
  return untilContrast({ ...color, l: color.l + delta }, [on], 4.5, away)
}

function accentTokens(
  accent: string,
  scheme: Scheme,
  surfaces: string[],
  ink: string,
  surface: string
): Record<string, string> {
  const pick = toOklch(accent)
  if (scheme === 'light') {
    const focus = untilContrast(pick, surfaces, 3, -0.02)
    const onWhite = contrast(accent, '#ffffff') >= 4.5
    const onInk = !onWhite && contrast(accent, ink) >= 4.5
    const solid = onWhite || onInk ? accent : untilContrast(pick, ['#ffffff'], 4.5, -0.02)
    const on = onInk ? ink : '#ffffff'
    return {
      accent: focus,
      solid,
      'solid-hover': shade(solid, -0.05, on),
      'solid-active': shade(solid, -0.1, on),
      'on-solid': on,
      'accent-soft': toHex({
        l: 0.955 + Math.min(0, toOklch(surface).l - 1),
        c: Math.min(pick.c, 0.035),
        h: pick.h
      })
    }
  }
  const focus = untilContrast({ ...pick, l: Math.max(pick.l, 0.7) }, surfaces, 3, 0.02)
  const base = { ...pick, l: clamp(pick.l, 0.45, 0.72) }
  const baseHex = toHex(base)
  const on = contrast(baseHex, '#ffffff') >= contrast(baseHex, surface) ? '#ffffff' : surface
  const solid = untilContrast(base, [on], 4.5, on === '#ffffff' ? -0.02 : 0.02)
  const lift = on === '#ffffff' ? 1 : -1
  return {
    accent: focus,
    solid,
    'solid-hover': shade(solid, 0.04 * lift, on),
    'solid-active': shade(solid, 0.08 * lift, on),
    'on-solid': on,
    'accent-soft': toHex({ l: 0.3, c: Math.min(pick.c, 0.06), h: pick.h })
  }
}

export type Palette = Record<string, string>

function readableOn(background: string, hue: number): string {
  const { c } = toOklch(background)
  const light = toHex({ l: 0.97, c: Math.min(c, 0.02), h: hue })
  const dark = toHex({ l: 0.22, c: Math.min(c, 0.03), h: hue })
  return contrast(light, background) >= contrast(dark, background) ? light : dark
}

function towards(ink: string, background: string, amount: number, minimum: number): string {
  const a = toOklch(ink)
  const b = toOklch(background)
  const step = a.l > b.l ? 0.01 : -0.01
  return untilContrast({ ...a, l: a.l + (b.l - a.l) * amount }, [background], minimum, step)
}

function softFrom(color: string, l: number): string {
  const { c, h } = toOklch(color)
  return toHex({ l, c: Math.min(c, 0.06), h })
}

function surfaceTint(surface: string, scheme: Scheme): Tint {
  const pick = toOklch(surface)
  return {
    shift: pick.l - toOklch(BASE_TOKENS[scheme].surface).l,
    chroma: Math.min(pick.c, 0.045),
    inkChroma: Math.min(pick.c, 0.04) * 0.6,
    hue: pick.h
  }
}

const minimumFor = (highContrast: boolean): number => (highContrast ? 7 : 4.5)

function tokensFor(colors: ThemeColors, scheme: Scheme, highContrast: boolean) {
  const overrides = colors.overrides?.[scheme] ?? {}
  const tint = overrides.surface
    ? surfaceTint(overrides.surface, scheme)
    : canvasTint(colors.canvas, scheme)
  const base = { ...BASE_TOKENS[scheme], ...(highContrast ? BASE_HIGH_CONTRAST[scheme] : {}) }
  const tokens: Record<string, string> = {}
  for (const token of SURFACE_TOKENS) tokens[token] = tintSurface(base[token], tint)
  for (const token of SOLID_TOKENS) tokens[token] = tintInk(base[token], tint)
  for (const token of INK_TOKENS) tokens[token] = tintInk(base[token], tint)
  for (const token of STATUS_TOKENS) tokens[token] = base[token]
  for (const token of ['surface', 'sidebar', 'raised', 'canvas'] as const) {
    if (overrides[token]) tokens[token] = overrides[token]
  }
  const ownSidebar = Boolean(overrides.sidebar || overrides['sidebar-ink'])
  const backgrounds = [tokens.surface, tokens.canvas, tokens.raised, tokens.subtle]
  if (!ownSidebar) backgrounds.push(tokens.sidebar)
  if (overrides.ink) tokens.ink = overrides.ink
  else if (contrast(tokens.ink, tokens.surface) < minimumFor(highContrast)) {
    tokens.ink = readableOn(tokens.surface, toOklch(tokens.surface).h)
  }
  const step = toOklch(tokens.ink).l < toOklch(tokens.surface).l ? -0.01 : 0.01
  const minimum = minimumFor(highContrast)
  for (const token of ['ink-soft', 'ink-faint'] as const) {
    tokens[token] = untilContrast(toOklch(tokens[token]), backgrounds, minimum, step)
  }
  tokens.control = untilContrast(toOklch(tokens.control), [tokens.surface, tokens.raised], 3, step)
  if (colors.accent) {
    Object.assign(
      tokens,
      accentTokens(colors.accent, scheme, backgrounds, tokens.ink, tokens.surface)
    )
  } else if (tint) {
    tokens['on-solid'] = scheme === 'light' ? tokens.surface : tokens.ink
  }
  for (const [token, value] of Object.entries(overrides)) {
    if (token !== 'sidebar-ink') tokens[token] = value
  }
  if (overrides.solid) {
    const on = overrides['on-solid'] ?? readableOn(overrides.solid, toOklch(overrides.solid).h)
    tokens['on-solid'] = on
    const lift = luminance(on) > 0.5 ? (scheme === 'light' ? -1 : 1) : -1
    tokens['solid-hover'] = shade(overrides.solid, 0.04 * lift, on)
    tokens['solid-active'] = shade(overrides.solid, 0.08 * lift, on)
  }
  if (overrides.danger) {
    tokens['danger-soft'] = softFrom(overrides.danger, scheme === 'light' ? 0.96 : 0.27)
    tokens['danger-soft-hover'] = softFrom(overrides.danger, scheme === 'light' ? 0.91 : 0.33)
  }
  if (overrides.warning) {
    tokens['warning-soft'] = softFrom(overrides.warning, scheme === 'light' ? 0.96 : 0.27)
  }
  if (overrides.now) tokens.attention = overrides.now
  return { tokens, tint, ownSidebar, overrides, minimum }
}

function sidebarTokens(
  tokens: Record<string, string>,
  overrides: RoleOverrides,
  minimum: number,
  scheme: Scheme
): Record<string, string> {
  const background = tokens.sidebar
  const ink =
    overrides['sidebar-ink'] ??
    (contrast(tokens.ink, background) >= 7
      ? tokens.ink
      : readableOn(background, toOklch(background).h))
  return {
    ink,
    'ink-soft': towards(ink, background, 0.3, minimum),
    'ink-faint': towards(ink, background, 0.4, minimum),
    accent: contrast(tokens.accent, background) >= 3 ? tokens.accent : ink,
    fill: rgba(ink, ALPHAS[scheme]['--color-fill']),
    'fill-hover': rgba(ink, ALPHAS[scheme]['--color-fill-hover'])
  }
}

export function palette(colors: ThemeColors, scheme: Scheme, highContrast = false): Palette {
  const { tokens, tint } = tokensFor(colors, scheme, highContrast)
  const out: Palette = {}
  for (const [token, value] of Object.entries(tokens)) out[`--color-${token}`] = value
  for (const [name, alpha] of Object.entries(ALPHAS[scheme])) out[name] = rgba(tokens.ink, alpha)
  out['--selection'] = tintSurface(BASE_SELECTION[scheme], tint)
  return out
}

export function sidebarPalette(
  colors: ThemeColors,
  scheme: Scheme,
  highContrast = false
): Palette | null {
  const { tokens, ownSidebar, overrides, minimum } = tokensFor(colors, scheme, highContrast)
  if (!ownSidebar) return null
  const out: Palette = {}
  for (const [token, value] of Object.entries(sidebarTokens(tokens, overrides, minimum, scheme))) {
    out[`--color-${token}`] = value
  }
  return out
}

export function roleColors(colors: ThemeColors, scheme: Scheme): Record<ColorRole, string> {
  const p = palette(colors, scheme)
  const sidebar = sidebarPalette(colors, scheme)
  const out = {} as Record<ColorRole, string>
  for (const role of ROLE_TOKENS) {
    out[role] =
      role === 'sidebar-ink' ? (sidebar?.['--color-ink'] ?? p['--color-ink']) : p[`--color-${role}`]
  }
  return out
}

const CHECKS: [ColorRole, ColorRole, number, string][] = [
  ['ink', 'surface', 4.5, 'o fundo das telas'],
  ['ink', 'raised', 4.5, 'os menus'],
  ['ink', 'canvas', 4.5, 'os blocos de apoio'],
  ['ink-soft', 'surface', 4.5, 'o fundo das telas'],
  ['ink-soft', 'raised', 4.5, 'os menus'],
  ['ink-faint', 'surface', 4.5, 'o fundo das telas'],
  ['sidebar-ink', 'sidebar', 4.5, 'a barra lateral'],
  ['on-solid', 'solid', 4.5, 'o botão principal'],
  ['solid', 'on-solid', 4.5, 'o texto do botão'],
  ['accent', 'surface', 3, 'o fundo das telas'],
  ['control', 'surface', 3, 'o fundo das telas'],
  ['danger', 'surface', 4.5, 'o fundo das telas'],
  ['warning', 'surface', 4.5, 'o fundo das telas'],
  ['now', 'surface', 3, 'o fundo das telas']
]

const ratio = (n: number): string => `${(Math.floor(n * 10) / 10).toFixed(1).replace('.', ',')}:1`

export function contrastIssues(
  colors: ThemeColors,
  scheme: Scheme
): Partial<Record<ColorRole, string>> {
  const c = roleColors(colors, scheme)
  const issues: Partial<Record<ColorRole, string>> = {}
  for (const [fg, bg, minimum, where] of CHECKS) {
    const value = contrast(c[fg], c[bg])
    if (value < minimum && !issues[fg]) {
      issues[fg] = `${ratio(value)} sobre ${where}, difícil de ler (mínimo ${ratio(minimum)})`
    }
  }
  return issues
}

export function hasOverrides(colors: ThemeColors): boolean {
  return Object.keys(colors.overrides.light).length + Object.keys(colors.overrides.dark).length > 0
}

export function isDefault(colors: ThemeColors): boolean {
  return !colors.accent && !colors.canvas && !hasOverrides(colors)
}

const block = (vars: Palette): string =>
  Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')

const SIDEBAR_SCOPE = '#sidebar, [data-on-sidebar]'

function schemeCss(colors: ThemeColors, scheme: Scheme, highContrast: boolean): string {
  const sidebar = sidebarPalette(colors, scheme, highContrast)
  return [
    `:root { ${block(palette(colors, scheme, highContrast))} }`,
    sidebar ? `${SIDEBAR_SCOPE} { ${block(sidebar)} }` : ''
  ].join(' ')
}

export function paletteCss(colors: ThemeColors): string {
  if (isDefault(colors)) return ''
  return [
    schemeCss(colors, 'light', false),
    `@media (prefers-color-scheme: dark) { ${schemeCss(colors, 'dark', false)} }`,
    `@media (prefers-contrast: more) { ${schemeCss(colors, 'light', true)} }`,
    `@media (prefers-contrast: more) and (prefers-color-scheme: dark) { ${schemeCss(colors, 'dark', true)} }`
  ].join('\n')
}

export function surfaceColor(colors: ThemeColors, scheme: Scheme): string {
  return palette(colors, scheme)['--color-surface']
}

function simple(accent: string, canvas: string): ThemeColors {
  return { accent, canvas, overrides: { light: {}, dark: {} } }
}

export const COLOR_PRESETS: { name: string; colors: ThemeColors }[] = [
  { name: 'Grafite', colors: DEFAULT_COLORS },
  { name: 'Oceano', colors: simple('#2563eb', '#f4f7fc') },
  { name: 'Íris', colors: simple('#6d4fd6', '#f7f5fd') },
  { name: 'Rosa', colors: simple('#c23d7a', '#fcf5f8') },
  { name: 'Terracota', colors: simple('#bf5530', '#fbf6f2') },
  { name: 'Petróleo', colors: simple('#0e7490', '#f3f8f9') }
]

const sameOverrides = (a: RoleOverrides, b: RoleOverrides): boolean =>
  ROLE_TOKENS.every((role) => a[role] === b[role])

export function sameColors(a: ThemeColors, b: ThemeColors): boolean {
  return (
    a.accent === b.accent &&
    a.canvas === b.canvas &&
    sameOverrides(a.overrides.light, b.overrides.light) &&
    sameOverrides(a.overrides.dark, b.overrides.dark)
  )
}

export function colorsLabel(colors: ThemeColors): string {
  const preset = COLOR_PRESETS.find((p) => sameColors(p.colors, colors))
  if (preset) return preset.name
  const codes = [colors.accent, colors.canvas].filter(Boolean).join(', ').toUpperCase()
  const extra = hasOverrides(colors) ? ' com ajustes por cor' : ''
  return codes ? `Personalizadas (${codes})${extra}` : `Personalizadas${extra}`
}

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  1: 'Padrão',
  1.1: 'Médio',
  1.2: 'Grande',
  1.3: 'Muito grande'
}
