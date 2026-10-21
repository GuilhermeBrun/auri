import { Check, ChevronDown, RotateCcw, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { RodaDeCor } from '@renderer/components/ui/roda-de-cor'
import { PageSection, SettingRow, SettingsGroup } from '@renderer/components/ui/section'
import { Segmented } from '@renderer/components/ui/segmented'
import { isMac } from '@renderer/lib/platform'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'
import {
  setTextSize,
  setTheme,
  setThemeColors,
  useLargestTextSize,
  useTextSize,
  useTheme,
  useThemeColors
} from '@renderer/lib/theme'
import { useToast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import {
  BASE_TOKENS,
  canvasTint,
  COLOR_PRESETS,
  COLOR_ROLES,
  contrastIssues,
  roleColors,
  sidebarPalette,
  type ColorRole,
  DEFAULT_COLORS,
  HEX_COLOR,
  hasOverrides,
  isDefault,
  palette,
  sameColors,
  TEXT_SIZE_LABELS,
  TEXT_SIZES,
  tintSurface,
  type Scheme,
  type ThemeColors
} from '@shared/aparencia'
import type { Theme } from '@shared/schemas'

const PREVIEW_COLORS = {
  light: {
    sidebar: '#f4f4f7',
    surface: '#ffffff',
    item: '#e2e2ea',
    active: '#d9d9e2',
    line: '#ececf1',
    session: '#e6e6ee'
  },
  dark: {
    sidebar: '#101014',
    surface: '#17171c',
    item: '#2b2b33',
    active: '#33333c',
    line: '#222229',
    session: '#2c2c35'
  }
} as const

const PREVIEW_SESSIONS = [
  [0, 8, 22],
  [1, 30, 18],
  [2, 4, 18],
  [2, 52, 26],
  [3, 22, 22],
  [4, 62, 18]
] as const

function Miniature({
  scheme,
  style
}: {
  scheme: Scheme
  style?: CSSProperties
}): React.JSX.Element {
  const tint = canvasTint(useThemeColors().canvas, scheme)
  const c = Object.fromEntries(
    Object.entries(PREVIEW_COLORS[scheme]).map(([part, hex]) => [part, tintSurface(hex, tint)])
  ) as Record<keyof (typeof PREVIEW_COLORS)[Scheme], string>
  return (
    <div className="absolute inset-0 flex" style={{ background: c.surface, ...style }}>
      <div
        className="flex w-[28%] flex-col gap-[6%] px-[5%] pt-[9%]"
        style={{ background: c.sidebar }}
      >
        <div className="h-[5%] w-1/2 rounded-[2px]" style={{ background: c.item }} />
        <div className="mt-[6%] h-[9%] rounded-[3px]" style={{ background: c.active }} />
        <div className="h-[5%] w-3/4 rounded-[2px]" style={{ background: c.item }} />
      </div>
      <div className="flex flex-1 flex-col px-[5%] pt-[7%] pb-[6%]">
        <div className="flex items-center justify-between">
          <div className="h-[6px] w-[34%] rounded-[2px]" style={{ background: c.item }} />
          <div className="h-[9px] w-[18%] rounded-[3px]" style={{ background: c.active }} />
        </div>
        <div className="relative mt-[9%] flex flex-1 gap-[4%]">
          {[0, 1, 2, 3, 4].map((col) => (
            <div key={col} className="relative flex-1" style={{ background: c.line }}>
              {PREVIEW_SESSIONS.filter(([day]) => day === col).map(([, top, height]) => (
                <div
                  key={top}
                  className="absolute inset-x-[8%] rounded-[2px]"
                  style={{ top: `${top}%`, height: `${height}%`, background: c.session }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' }
]

function ThemePicker(): React.JSX.Element {
  const theme = useTheme()
  return (
    <fieldset>
      <legend className="sr-only">Tema</legend>
      <div className="grid grid-cols-3 gap-3">
        {THEME_OPTIONS.map(({ value, label }) => {
          const selected = theme === value
          return (
            <label
              key={value}
              className={cn(
                'group cursor-pointer rounded-card p-2 transition-[background-color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                selected
                  ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
                  : 'shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-fill'
              )}
            >
              <input
                type="radio"
                name="tema"
                value={value}
                checked={selected}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="relative block aspect-[16/10] overflow-hidden rounded-control shadow-[0_0_0_1px_var(--color-line)]"
              >
                {value === 'system' ? (
                  <>
                    <Miniature scheme="light" />
                    <Miniature scheme="dark" style={{ clipPath: 'inset(0 0 0 50%)' }} />
                  </>
                ) : (
                  <Miniature scheme={value} />
                )}
              </span>
              <span
                className={cn(
                  'mt-2 flex h-6 items-center justify-center gap-1.5 text-[13px] font-medium',
                  selected ? 'text-ink' : 'text-ink-soft group-hover:text-ink'
                )}
              >
                {selected && (
                  <Check className="size-3.5 animate-fade-in stroke-[2.25]" aria-hidden="true" />
                )}
                {label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function scheme(): Scheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function PresetSwatch({ colors }: { colors: ThemeColors }): React.JSX.Element {
  const light = palette(colors, 'light')
  const dark = palette(colors, 'dark')
  return (
    <span
      aria-hidden="true"
      className="relative flex h-10 overflow-hidden rounded-control shadow-[0_0_0_1px_var(--color-line)]"
    >
      {[light, dark].map((p, i) => (
        <span
          key={i}
          className="flex flex-1 items-end gap-1 p-1.5"
          style={{ background: p['--color-surface'] }}
        >
          <span
            className="h-full w-1/3 rounded-[3px]"
            style={{ background: p['--color-sidebar'] }}
          />
          <span className="h-2.5 flex-1 rounded-[3px]" style={{ background: p['--color-solid'] }} />
        </span>
      ))}
    </span>
  )
}

function PresetPicker(): React.JSX.Element {
  const colors = useThemeColors()
  const apply = useApplyColors()
  const custom = !COLOR_PRESETS.some((p) => sameColors(p.colors, colors))
  return (
    <fieldset>
      <legend className="sr-only">Cores prontas</legend>
      <div className="grid grid-cols-3 gap-2">
        {COLOR_PRESETS.map((preset) => {
          const selected = sameColors(preset.colors, colors)
          return (
            <label
              key={preset.name}
              className={cn(
                'group cursor-pointer rounded-card p-2 transition-[background-color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                selected
                  ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
                  : 'shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-fill'
              )}
            >
              <input
                type="radio"
                name="cores"
                checked={selected}
                onChange={() => apply(preset.colors)}
                className="sr-only"
              />
              <PresetSwatch colors={preset.colors} />
              <span
                className={cn(
                  'mt-2 flex h-5 items-center justify-center gap-1.5 text-[13px] font-medium',
                  selected ? 'text-ink' : 'text-ink-soft group-hover:text-ink'
                )}
              >
                {selected && (
                  <Check className="size-3.5 animate-fade-in stroke-[2.25]" aria-hidden="true" />
                )}
                {preset.name}
              </span>
            </label>
          )
        })}
      </div>
      {custom && <p className="mt-3 text-xs text-ink-soft">Usando cores personalizadas.</p>}
    </fieldset>
  )
}

function ColorField({
  label,
  description,
  value,
  shown,
  onChange,
  onReset,
  open: controlledOpen,
  onOpenChange
}: {
  label: string
  description?: ReactNode
  value: string | null
  shown: string
  onChange: (hex: string) => void
  onReset?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}): React.JSX.Element {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlledOpen ?? ownOpen
  const setOpen = onOpenChange ?? setOwnOpen
  const [text, setText] = useState(value ?? '')
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setText(value ?? '')
  }
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (controlledOpen) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [controlledOpen])
  return (
    <div ref={rowRef} className="scroll-mt-4">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[13px] font-medium">{label}</div>
          {description && <div className="mt-0.5 text-xs text-ink-soft">{description}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`Escolher ${label.toLowerCase()} na roda de cor`}
            title="Roda de cor"
            onClick={() => setOpen(!open)}
            className="size-8 rounded-control shadow-[inset_0_0_0_1px_var(--session-edge)] transition-[scale] active:scale-[0.97]"
            style={{ backgroundColor: value ?? shown }}
          />
          <Input
            aria-label={`Código: ${label.toLowerCase()}`}
            value={text}
            placeholder={shown.toUpperCase()}
            spellCheck={false}
            maxLength={7}
            onChange={(e) => {
              const typed = e.target.value.trim().toLowerCase()
              const hex = typed.startsWith('#') ? typed : `#${typed}`
              setText(e.target.value)
              if (HEX_COLOR.test(hex)) onChange(hex)
            }}
            onBlur={() => setText(value ?? '')}
            className="w-24 font-mono text-xs uppercase"
          />
          {onReset && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Voltar ${label.toLowerCase()} à cor automática`}
              title="Voltar à cor automática"
              disabled={!value}
              onClick={onReset}
            >
              <RotateCcw />
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-4 animate-fade-in">
          <RodaDeCor value={value ?? shown} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

const SCHEME_OPTIONS = [
  ['light', 'Claro'],
  ['dark', 'Escuro']
] as const

function vars(values: Record<string, string> | null): CSSProperties {
  return (values ?? {}) as CSSProperties
}

function ThemePreview({
  colors,
  scheme,
  onPick
}: {
  colors: ThemeColors
  scheme: Scheme
  onPick: (role: ColorRole) => void
}): React.JSX.Element {
  const labels = Object.fromEntries(COLOR_ROLES.map((r) => [r.token, r.label]))
  const part = (role: ColorRole): { 'data-role': ColorRole; title: string } => ({
    'data-role': role,
    title: labels[role]
  })
  return (
    <div
      aria-hidden="true"
      onClick={(e) => {
        const role = (e.target as HTMLElement).closest<HTMLElement>('[data-role]')?.dataset.role
        if (role) onPick(role as ColorRole)
      }}
      style={{
        ...vars({ ...palette(colors, scheme), '--tinta': scheme === 'dark' ? '30%' : '22%' }),
        colorScheme: scheme
      }}
      className="flex h-60 cursor-pointer overflow-hidden rounded-control bg-surface text-xs text-ink shadow-[0_0_0_1px_var(--color-line)] select-none [&_[data-role]]:transition-shadow [&_[data-role]:hover]:shadow-[0_0_0_2px_var(--color-accent)]"
      {...part('surface')}
    >
      <div
        style={vars(sidebarPalette(colors, scheme))}
        className="flex w-36 shrink-0 flex-col gap-1 bg-sidebar p-2 text-ink"
        {...part('sidebar')}
      >
        <span className="px-2 py-1 font-semibold" {...part('sidebar-ink')}>
          auri
        </span>
        <span className="rounded-chip bg-fill-hover px-2 py-1 font-medium" {...part('sidebar-ink')}>
          Agenda
        </span>
        <span className="px-2 py-1 text-ink-soft" {...part('sidebar-ink')}>
          Pacientes
        </span>
        <span className="px-2 py-1 text-ink-soft" {...part('sidebar-ink')}>
          Financeiro
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">
            <span className="text-ink-faint" {...part('ink-faint')}>
              Agenda /{' '}
            </span>
            <span className="font-medium" {...part('ink')}>
              Hoje
            </span>
          </span>
          <span
            className="rounded-chip bg-solid px-2.5 py-1 font-medium text-on-solid"
            {...part('solid')}
          >
            <span {...part('on-solid')}>Agendar</span>
          </span>
        </div>
        <div className="flex gap-2 border-y border-line py-2" {...part('line')}>
          {['Ana Moreira', 'João Pedro'].map((nome, i) => (
            <div
              key={nome}
              className="min-w-0 flex-1 rounded-chip bg-[color-mix(in_oklab,var(--color-control)_var(--tinta),var(--color-surface))] py-1.5 pr-2 pl-2.5 shadow-[inset_4px_0_0_var(--color-control)]"
              {...part('control')}
            >
              <div className="truncate font-medium">{nome}</div>
              <div className="truncate text-ink-soft" {...part('ink-soft')}>
                {i ? '10:00' : '09:00'} · Sessão
              </div>
            </div>
          ))}
        </div>
        <div className="h-0.5 rounded-full bg-now" {...part('now')} />
        <div className="flex items-center gap-2">
          <span
            className="h-7 min-w-0 flex-1 truncate rounded-chip border border-control bg-surface px-2 leading-[26px] text-ink-faint"
            {...part('control')}
          >
            Buscar paciente
          </span>
          <span
            className="h-7 rounded-chip bg-surface px-2 leading-7 outline-2 outline-offset-1 outline-accent"
            {...part('accent')}
          >
            Foco
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-chip bg-danger-soft px-2 py-1 text-danger" {...part('danger')}>
            Excluir
          </span>
          <span
            className="rounded-chip bg-warning-soft px-2 py-1 text-warning"
            {...part('warning')}
          >
            Cópia parada
          </span>
          <span className="rounded-chip bg-accent-soft px-2 py-1" {...part('accent-soft')}>
            Realce
          </span>
          <span className="rounded-chip bg-canvas px-2 py-1 text-ink-soft" {...part('canvas')}>
            Bloco de apoio
          </span>
        </div>
        <div
          className="mt-auto self-end rounded-card bg-raised px-1 py-1 shadow-pop"
          {...part('raised')}
        >
          <span className="block rounded-chip bg-fill-hover px-2 py-1">Remarcar</span>
        </div>
      </div>
    </div>
  )
}

function AdvancedColors(): React.JSX.Element {
  const colors = useThemeColors()
  const [editing, setEditing] = useState<Scheme>(scheme)
  const [active, setActive] = useState<ColorRole | null>(null)
  const own = colors.overrides[editing]
  const current = roleColors(colors, editing)
  const automatic = (role: ColorRole): string => {
    if (!own[role]) return current[role]
    const { [role]: _, ...rest } = own
    return roleColors({ ...colors, overrides: { ...colors.overrides, [editing]: rest } }, editing)[
      role
    ]
  }
  const issues = contrastIssues(colors, editing)
  const setRole = (role: ColorRole, hex: string | null): void => {
    const next = { ...own }
    if (hex) next[role] = hex
    else delete next[role]
    setThemeColors({ ...colors, overrides: { ...colors.overrides, [editing]: next } })
  }
  const groups = [...new Set(COLOR_ROLES.map((r) => r.group))]
  const name = editing === 'light' ? 'claro' : 'escuro'
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Segmented
          label="Tema que está ajustando"
          value={editing}
          options={SCHEME_OPTIONS}
          onChange={(next) => {
            setEditing(next)
            setActive(null)
          }}
        />
        {Object.keys(own).length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setThemeColors({ ...colors, overrides: { ...colors.overrides, [editing]: {} } })
            }
          >
            <RotateCcw />
            Restaurar o {name}
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <ThemePreview colors={colors} scheme={editing} onPick={setActive} />
      </div>
      {groups.map((group) => (
        <section key={group} aria-label={group} className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-ink-soft">{group}</h4>
          {COLOR_ROLES.filter((r) => r.group === group).map(({ token, label }) => (
            <ColorField
              key={`${editing}-${token}`}
              label={label}
              description={
                issues[token] && (
                  <span className="flex items-start gap-1 text-warning">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {issues[token]}
                  </span>
                )
              }
              value={own[token] ?? null}
              shown={automatic(token)}
              onChange={(hex) => setRole(token, hex)}
              onReset={() => setRole(token, null)}
              open={active === token}
              onOpenChange={(open) => setActive(open ? token : null)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function useApplyColors(): (next: ThemeColors) => void {
  const colors = useThemeColors()
  const toast = useToast()
  return (next) => {
    setThemeColors(next)
    if (!hasOverrides(colors) || sameColors(colors, next)) return
    toast({
      title: 'Os ajustes de cada cor saíram',
      action: {
        label: 'Desfazer',
        altText: 'Voltar às cores de antes',
        onClick: () => setThemeColors(colors)
      }
    })
  }
}

function AdvancedSection(): React.JSX.Element {
  const colors = useThemeColors()
  const [open, setOpen] = useState(() => hasOverrides(colors))
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="-m-2 flex w-[calc(100%+16px)] items-center justify-between gap-6 rounded-control p-2 text-left transition-colors hover:bg-fill"
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-medium">Ajustar cada cor</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-ink-soft transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="mt-6 animate-fade-in">
          <AdvancedColors />
        </div>
      )}
    </div>
  )
}

function CustomColors(): React.JSX.Element {
  const colors = useThemeColors()
  const apply = useApplyColors()
  const now = scheme()
  const change = (patch: Partial<ThemeColors>): void => setThemeColors({ ...colors, ...patch })
  return (
    <>
      <ColorField
        label="Destaque"
        description="Botões e seleção."
        value={colors.accent}
        shown={BASE_TOKENS[now].solid}
        onChange={(accent) => change({ accent })}
      />
      <ColorField
        label="Fundo"
        description={
          isDefault(colors) ? (
            'Telas e barra lateral.'
          ) : (
            <>
              Telas e barra lateral.{' '}
              <button
                type="button"
                className="font-medium text-ink underline-offset-2 hover:underline"
                onClick={() => apply(DEFAULT_COLORS)}
              >
                Voltar ao grafite
              </button>
            </>
          )
        }
        value={colors.canvas}
        shown={BASE_TOKENS[now].surface}
        onChange={(canvas) => change({ canvas })}
      />
    </>
  )
}

function TextSizePicker(): React.JSX.Element {
  const size = useTextSize()
  const largest = useLargestTextSize()
  const mod = isMac ? '⌘' : 'Ctrl'
  return (
    <SettingRow
      title="Tamanho"
      description={
        largest < TEXT_SIZES[TEXT_SIZES.length - 1]
          ? 'Os tamanhos maiores não cabem nesta tela.'
          : `Atalho: ${mod} + e ${mod} −.`
      }
    >
      <Segmented
        label="Tamanho do texto"
        value={String(Math.min(size, largest))}
        options={TEXT_SIZES.map((s) => [String(s), TEXT_SIZE_LABELS[s]] as const)}
        disabled={TEXT_SIZES.filter((s) => s > largest).map(String)}
        onChange={(value) => setTextSize(TEXT_SIZES.find((s) => String(s) === value) ?? 1)}
      />
    </SettingRow>
  )
}

export function AppearancePage(): React.JSX.Element {
  return (
    <Page trail={[SETTINGS_CRUMB, { label: 'Aparência' }]}>
      <div className="mx-auto max-w-[720px] px-8 pt-8 pb-16">
        <div className="flex flex-col gap-14">
          <PageSection id="tema" title="Tema">
            <SettingsGroup>
              <ThemePicker />
            </SettingsGroup>
          </PageSection>
          <PageSection id="cores" title="Cores">
            <SettingsGroup rows>
              <PresetPicker />
              <CustomColors />
              <AdvancedSection />
            </SettingsGroup>
          </PageSection>
          <PageSection id="texto" title="Texto">
            <SettingsGroup>
              <TextSizePicker />
            </SettingsGroup>
          </PageSection>
        </div>
      </div>
    </Page>
  )
}
