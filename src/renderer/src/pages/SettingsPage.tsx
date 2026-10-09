import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Page } from '@renderer/components/Layout'
import { isMac } from '@renderer/lib/platform'
import { setTheme, useTheme } from '@renderer/lib/theme'
import { cn } from '@renderer/lib/utils'
import type { Theme } from '@shared/schemas'

/**
 * Cores da miniatura de cada tema. São fixas de propósito: a miniatura do claro tem de parecer clara
 * mesmo com o app no escuro, e vice-versa. Copiam os tokens de main.css. Sem bloco cheio: as ações
 * do cabeçalho não têm fundo, então o botão da miniatura é neutro como o resto.
 */
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

type Scheme = keyof typeof PREVIEW_COLORS

/** Sessões da miniatura da agenda: coluna (0–4), início e altura em % da grade. */
const PREVIEW_SESSIONS = [
  [0, 8, 22],
  [1, 30, 18],
  [2, 4, 18],
  [2, 52, 26],
  [3, 22, 22],
  [4, 62, 18]
] as const

/** Miniatura do Auri num tema: barra lateral com o menu, cabeçalho e a semana com algumas sessões. */
function Miniature({
  scheme,
  style
}: {
  scheme: Scheme
  style?: CSSProperties
}): React.JSX.Element {
  const c = PREVIEW_COLORS[scheme]
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

/**
 * Escolha do tema em cartões com a miniatura do app. São botões de rádio de verdade (escondidos),
 * então as setas trocam a opção e o leitor de tela lê "Tema, Sistema, 1 de 3". "Sistema" mostra as
 * duas metades, como o sistema faz ao longo do dia. A troca vale na hora, sem botão de salvar.
 */
function ThemePicker(): React.JSX.Element {
  const theme = useTheme()
  return (
    <fieldset>
      <legend className="text-[13px] font-medium">Tema</legend>
      <div className="mt-3 grid grid-cols-3 gap-3">
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
      <p className="mt-3 text-xs text-ink-soft">
        Em Sistema, o Auri acompanha a aparência do {isMac ? 'macOS' : 'Windows'}, inclusive quando
        ela muda sozinha ao longo do dia.
      </p>
    </fieldset>
  )
}

/** Passo da trilha que leva à raiz das Configurações (que abre a primeira seção). */
const SETTINGS_CRUMB = { label: 'Configurações', to: '/configuracoes' }

/**
 * Configurações → Aparência. Página comum, de uma coluna: o título fica na trilha do cabeçalho
 * (Configurações / Aparência), como nas outras telas; aqui vêm a descrição e o conteúdo. Seções
 * novas das Configurações ganham rota própria e item na barra lateral (`SETTINGS_ITEMS`).
 */
export function AppearancePage(): React.JSX.Element {
  return (
    <Page trail={[SETTINGS_CRUMB, { label: 'Aparência' }]}>
      <div className="mx-auto max-w-[720px] px-8 pt-8 pb-16">
        <p className="text-[13px] text-ink-soft">Como o Auri aparece neste computador.</p>
        <div className="mt-6">
          <ThemePicker />
        </div>
      </div>
    </Page>
  )
}
