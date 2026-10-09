// O visual comum a todo campo e a toda lista que abre dele (paciente, data, hora, duração): um campo
// só muda no que tem dentro, nunca no contorno, no foco ou na lista flutuante.

/**
 * Campos com o fundo do conteúdo e contorno de 3:1 (WCAG 1.4.11). No foco o contorno vira grafite com um anel
 * suave; no erro, vermelho, com um tremor curto ao ser recusado (e a mensagem, com ícone, aparece abaixo).
 */
export const controlClass =
  'w-full rounded-control border border-control bg-surface px-3 text-[13px] text-ink transition-[background-color,border-color,box-shadow] placeholder:text-ink-faint hover:border-ink-soft focus:border-ink focus:ring-[3px] focus:ring-ink/10 focus:outline-none aria-[invalid=true]:animate-nudge aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger/[0.03] aria-[invalid=true]:focus:ring-danger/15 disabled:border-line disabled:bg-canvas disabled:text-ink-faint pointer-coarse:text-base'

/** O mesmo contorno do foco, enquanto a lista do campo está aberta (o foco já foi para a lista). */
export const openClass = 'border-ink ring-[3px] ring-ink/10'

/** Ícone à direita do campo (calendário, relógio, seta). */
export const trailingIconClass = 'size-4 stroke-[1.75] text-ink-soft'

/** Lista flutuante: sólida e com sombra, é a única coisa que flutua sobre a folha. */
export const popupClass = 'rounded-card bg-raised p-1 shadow-pop'

/** Uma opção da lista; o destaque (mouse ou setas) é o atributo `data-highlighted`, como no Radix. */
export const optionClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-control px-2 text-[13px] text-ink outline-none select-none data-[highlighted]:bg-fill-hover pointer-coarse:h-11'
