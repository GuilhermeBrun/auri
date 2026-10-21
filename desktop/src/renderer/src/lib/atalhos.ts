import { useEffect, useEffectEvent, useMemo, useSyncExternalStore } from 'react'
import {
  escreverTecla,
  teclasDosAtalhos,
  type AtalhoId,
  type Plataforma,
  type Tecla,
  type TeclasDosAtalhos
} from '@shared/atalhos'
import { isMac } from '@renderer/lib/platform'

export const PLATAFORMA: Plataforma = isMac ? 'mac' : 'pc'

let trocas: Record<string, string | null> = window.prefs.initial?.atalhos ?? {}
let mapa: Map<string, string> | null = null
let watching = false
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  if (!watching) {
    watching = true
    window.prefs.onChange((prefs) => {
      if (JSON.stringify(prefs.atalhos) === JSON.stringify(trocas)) return
      trocas = prefs.atalhos
      notify()
    })
    void (
      navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }
    ).keyboard
      ?.getLayoutMap()
      .then((layout) => {
        mapa = layout
        notify()
      })
      .catch(() => {})
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTrocas(): Record<string, string | null> {
  return useSyncExternalStore(subscribe, () => trocas)
}

export function useTeclas(): TeclasDosAtalhos {
  const atuais = useTrocas()
  return useMemo(() => teclasDosAtalhos(PLATAFORMA, atuais), [atuais])
}

export function salvarAtalho(id: AtalhoId, tecla: Tecla | null | undefined): void {
  const { [id]: _, ...resto } = trocas
  trocas = tecla === undefined ? resto : { ...resto, [id]: tecla && escreverTecla(tecla) }
  window.prefs.save({ atalhos: trocas })
  notify()
}

export function restaurarAtalhos(): void {
  trocas = {}
  window.prefs.save({ atalhos: trocas })
  notify()
}

const NOMES: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Enter: '↵',
  NumpadEnter: '↵',
  Space: 'Espaço',
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: isMac ? '⌦' : 'Del',
  Tab: isMac ? '⇥' : 'Tab',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  Minus: '−',
  Equal: '=',
  Backquote: '`'
}

function nomeDaTecla(code: string): string {
  const doTeclado = mapa?.get(code)?.trim()
  if (doTeclado) return doTeclado.toUpperCase()
  return (
    /^Key([A-Z])$/.exec(code)?.[1] ??
    /^Digit(\d)$/.exec(code)?.[1] ??
    /^Numpad(\d)$/.exec(code)?.[1] ??
    NOMES[code] ??
    code
  )
}

export function partesDaTecla(tecla: Tecla): string[] {
  const mods = isMac
    ? [tecla.ctrl && '⌃', tecla.alt && '⌥', tecla.shift && '⇧', tecla.meta && '⌘']
    : [tecla.ctrl && 'Ctrl', tecla.alt && 'Alt', tecla.shift && 'Shift', tecla.meta && 'Win']
  return [...mods.filter((m): m is string => Boolean(m)), nomeDaTecla(tecla.code)]
}

export function textoDaTecla(tecla: Tecla | null): string | null {
  return tecla ? partesDaTecla(tecla).join(isMac ? '' : '+') : null
}

export function useTextoDoAtalho(id: AtalhoId): string | null {
  return textoDaTecla(useTeclas()[id])
}

export function comAtalho(rotulo: string, atalho: string | null): string {
  return atalho ? `${rotulo} (${atalho})` : rotulo
}

export function teclaDoEvento(e: KeyboardEvent): Tecla {
  return { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, code: e.code }
}

const DIGITANDO = 'input, textarea, select, [contenteditable="true"]'
const WIDGET =
  '[role="menu"], [role="listbox"], [role="radiogroup"], [role="tablist"], [role="grid"], [role="slider"], [role="option"], [role="combobox"]'

function bloqueado(tecla: Tecla, e: KeyboardEvent): boolean {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true
  if (tecla.ctrl || tecla.meta || tecla.alt) return false
  const alvo = e.target instanceof Element ? e.target : null
  return alvo?.closest(`${DIGITANDO}, ${WIDGET}`) != null
}

export function useAtalhos(acoes: Partial<Record<AtalhoId, () => void>>, ativo = true): void {
  const teclas = useTeclas()
  const disparar = useEffectEvent((id: AtalhoId) => acoes[id]?.())
  const ligados = (Object.keys(acoes) as AtalhoId[])
    .flatMap((id) => {
      const tecla = teclas[id]
      return tecla ? [`${escreverTecla(tecla)}=${id}`] : []
    })
    .join(' ')
  useEffect(() => {
    if (!ativo || ligados === '') return
    const porTecla = new Map(
      ligados.split(' ').map((par) => {
        const [tecla, id] = par.split('=')
        return [tecla, id as AtalhoId]
      })
    )
    function onKeyDown(e: KeyboardEvent): void {
      if (e.defaultPrevented) return
      const tecla = teclaDoEvento(e)
      const id = porTecla.get(escreverTecla(tecla))
      if (!id || bloqueado(tecla, e)) return
      e.preventDefault()
      disparar(id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [ligados, ativo])
}
