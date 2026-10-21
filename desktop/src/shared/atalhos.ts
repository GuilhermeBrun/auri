export type Tecla = { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; code: string }

export type Plataforma = 'mac' | 'pc'

export const GRUPOS_DE_ATALHO = [
  { id: 'geral', titulo: 'Geral' },
  { id: 'ir', titulo: 'Ir para' },
  { id: 'agenda', titulo: 'Agenda' },
  { id: 'pacientes', titulo: 'Pacientes' }
] as const

export type GrupoDeAtalho = (typeof GRUPOS_DE_ATALHO)[number]['id']

const atalho = <const Id extends string>(
  id: Id,
  grupo: GrupoDeAtalho,
  nome: string,
  mac: string,
  pc: string = mac
): { id: Id; grupo: GrupoDeAtalho; nome: string; mac: string; pc: string } => ({
  id,
  grupo,
  nome,
  mac,
  pc
})

export const ATALHOS = [
  atalho(
    'barra-lateral',
    'geral',
    'Mostrar ou ocultar a barra lateral',
    'Ctrl+Meta+KeyS',
    'Ctrl+KeyB'
  ),
  atalho('configuracoes', 'geral', 'Abrir as Configurações', 'Meta+Comma', 'Ctrl+Comma'),
  atalho('buscar-paciente', 'geral', 'Buscar paciente', 'Meta+KeyK', 'Ctrl+KeyK'),
  atalho('salvar', 'geral', 'Salvar a tela aberta', 'Meta+KeyS', 'Ctrl+KeyS'),
  atalho('voltar', 'geral', 'Voltar', 'Meta+BracketLeft', 'Alt+ArrowLeft'),
  atalho('avancar', 'geral', 'Avançar', 'Meta+BracketRight', 'Alt+ArrowRight'),
  atalho('ir-agenda', 'ir', 'Agenda', 'Meta+Digit1', 'Ctrl+Digit1'),
  atalho('ir-pacientes', 'ir', 'Pacientes', 'Meta+Digit2', 'Ctrl+Digit2'),
  atalho('ir-financeiro', 'ir', 'Financeiro', 'Meta+Digit3', 'Ctrl+Digit3'),
  atalho('ir-clinica', 'ir', 'Clínica', 'Meta+Digit4', 'Ctrl+Digit4'),
  atalho('ir-whatsapp', 'ir', 'WhatsApp', 'Meta+Digit5', 'Ctrl+Digit5'),
  atalho('agenda-novo', 'agenda', 'Novo agendamento', 'KeyN'),
  atalho('agenda-hoje', 'agenda', 'Ir para hoje', 'KeyT'),
  atalho('agenda-anterior', 'agenda', 'Período anterior', 'ArrowLeft'),
  atalho('agenda-proximo', 'agenda', 'Próximo período', 'ArrowRight'),
  atalho('agenda-dia', 'agenda', 'Ver o dia', 'KeyD'),
  atalho('agenda-semana', 'agenda', 'Ver a semana', 'KeyS'),
  atalho('agenda-mes', 'agenda', 'Ver o mês', 'KeyM'),
  atalho('paciente-novo', 'pacientes', 'Novo paciente', 'KeyN'),
  atalho('paciente-aba-proxima', 'pacientes', 'Próxima aba do paciente', 'Ctrl+Tab'),
  atalho('paciente-aba-anterior', 'pacientes', 'Aba anterior do paciente', 'Ctrl+Shift+Tab')
] as const

export type AtalhoId = (typeof ATALHOS)[number]['id']

export type Atalho = (typeof ATALHOS)[number]

export type TeclasDosAtalhos = Record<AtalhoId, Tecla | null>

export const ATALHOS_FIXOS = [
  { nome: 'Aumentar o texto', mac: ['⌘', '+'], pc: ['Ctrl', '+'] },
  { nome: 'Diminuir o texto', mac: ['⌘', '−'], pc: ['Ctrl', '−'] },
  { nome: 'Texto no tamanho padrão', mac: ['⌘', '0'], pc: ['Ctrl', '0'] },
  { nome: 'Salvar no agendamento', mac: ['⌘', '↵'], pc: ['Ctrl', '↵'] },
  { nome: 'Fechar a janela ou o menu aberto', mac: ['Esc'], pc: ['Esc'] }
] as const

const MODIFICADORES = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

export function lerTecla(texto: string): Tecla | null {
  const partes = texto.split('+')
  const code = partes.pop()
  if (!code || partes.some((p) => !(MODIFICADORES as readonly string[]).includes(p))) return null
  return {
    ctrl: partes.includes('Ctrl'),
    alt: partes.includes('Alt'),
    shift: partes.includes('Shift'),
    meta: partes.includes('Meta'),
    code
  }
}

export function escreverTecla(tecla: Tecla): string {
  return [
    tecla.ctrl && 'Ctrl',
    tecla.alt && 'Alt',
    tecla.shift && 'Shift',
    tecla.meta && 'Meta',
    tecla.code
  ]
    .filter(Boolean)
    .join('+')
}

export function mesmaTecla(a: Tecla | null, b: Tecla | null): boolean {
  return a !== null && b !== null && escreverTecla(a) === escreverTecla(b)
}

export function teclasDosAtalhos(
  plataforma: Plataforma,
  trocas: Record<string, string | null>
): TeclasDosAtalhos {
  return Object.fromEntries(
    ATALHOS.map((a) => {
      const troca = trocas[a.id]
      if (troca === null) return [a.id, null]
      return [a.id, (troca !== undefined && lerTecla(troca)) || lerTecla(a[plataforma])]
    })
  ) as TeclasDosAtalhos
}

export function padraoDoAtalho(id: AtalhoId, plataforma: Plataforma): Tecla | null {
  const a = ATALHOS.find((item) => item.id === id)
  return a ? lerTecla(a[plataforma]) : null
}

const RESERVADAS: Record<Plataforma, string[]> = {
  mac: [
    'Meta+KeyQ',
    'Meta+KeyW',
    'Meta+KeyH',
    'Alt+Meta+KeyH',
    'Meta+KeyM',
    'Meta+KeyA',
    'Meta+KeyC',
    'Meta+KeyV',
    'Meta+KeyX',
    'Meta+KeyZ',
    'Shift+Meta+KeyZ',
    'Meta+Equal',
    'Shift+Meta+Equal',
    'Meta+Minus',
    'Meta+Digit0',
    'Meta+Enter',
    'Meta+Tab',
    'Meta+Space'
  ],
  pc: [
    'Ctrl+KeyA',
    'Ctrl+KeyC',
    'Ctrl+KeyV',
    'Ctrl+KeyX',
    'Ctrl+KeyZ',
    'Ctrl+KeyY',
    'Ctrl+Equal',
    'Ctrl+Shift+Equal',
    'Ctrl+Minus',
    'Ctrl+Digit0',
    'Ctrl+Enter',
    'Alt+F4',
    'Alt+Tab'
  ]
}

const SOZINHAS_PROIBIDAS = ['Escape', 'Tab', 'Enter', 'NumpadEnter', 'Space', 'Backspace', 'Delete']

function semModificador(tecla: Tecla): boolean {
  return !tecla.ctrl && !tecla.alt && !tecla.meta
}

function escopoCruza(a: GrupoDeAtalho, b: GrupoDeAtalho): boolean {
  const global = (g: GrupoDeAtalho): boolean => g === 'geral' || g === 'ir'
  return global(a) || global(b) || a === b
}

export type ProblemaDoAtalho =
  | { tipo: 'reservada' }
  | { tipo: 'sozinha' }
  | { tipo: 'em-uso'; nome: string }

export function problemaDoAtalho(
  id: AtalhoId,
  tecla: Tecla,
  plataforma: Plataforma,
  atuais: TeclasDosAtalhos
): ProblemaDoAtalho | null {
  const texto = escreverTecla(tecla)
  if (RESERVADAS[plataforma].includes(texto)) return { tipo: 'reservada' }
  if (semModificador(tecla) && SOZINHAS_PROIBIDAS.includes(tecla.code)) return { tipo: 'sozinha' }
  const meu = ATALHOS.find((a) => a.id === id)
  const outro = ATALHOS.find(
    (a) =>
      a.id !== id &&
      meu !== undefined &&
      escopoCruza(a.grupo, meu.grupo) &&
      mesmaTecla(atuais[a.id], tecla)
  )
  return outro ? { tipo: 'em-uso', nome: outro.nome } : null
}

const ACELERADOR: Record<string, string> = {
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Enter: 'Return',
  Tab: 'Tab',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown'
}

export function paraAcelerador(tecla: Tecla | null): string | undefined {
  if (!tecla) return undefined
  const tecla1 = /^Key([A-Z])$/.exec(tecla.code)?.[1]
  const digito = /^Digit(\d)$/.exec(tecla.code)?.[1]
  const funcao = /^F\d{1,2}$/.test(tecla.code) ? tecla.code : undefined
  const nome = tecla1 ?? digito ?? funcao ?? ACELERADOR[tecla.code]
  if (!nome) return undefined
  return [
    tecla.ctrl && 'Control',
    tecla.alt && 'Alt',
    tecla.shift && 'Shift',
    tecla.meta && 'Command',
    nome
  ]
    .filter(Boolean)
    .join('+')
}
