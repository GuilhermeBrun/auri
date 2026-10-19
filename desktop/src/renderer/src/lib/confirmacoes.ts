import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { useEffect, useSyncExternalStore } from 'react'
import type { Vaga } from '@shared/confirmacao'
import { parseIsoLocalDateTime } from '@shared/dates'

type Loja<T> = {
  get: () => T
  set: (value: T) => void
  use: () => T
}

function loja<T>(inicial: T): Loja<T> {
  let atual = inicial
  const ouvintes = new Set<() => void>()
  return {
    get: () => atual,
    set: (value) => {
      atual = value
      for (const ouvinte of ouvintes) ouvinte()
    },
    use: () =>
      useSyncExternalStore(
        (ouvinte) => {
          ouvintes.add(ouvinte)
          return () => ouvintes.delete(ouvinte)
        },
        () => atual
      )
  }
}

type Recebendo = { id: number; texto: string } | null

const recebendo = loja<Recebendo>(null)
let fila: string[] = []
let proximo = 1

export function abrirResposta(texto = ''): void {
  const atual = recebendo.get()
  if (atual) {
    if (texto && atual.texto !== texto && !fila.includes(texto)) fila.push(texto)
    return
  }
  recebendo.set({ id: proximo++, texto })
}

export function fecharResposta(): void {
  const seguinte = fila.shift()
  recebendo.set(seguinte ? { id: proximo++, texto: seguinte } : null)
}

export const useRecebendo = recebendo.use

let encaixePendente: Vaga | null = null
let atenderEncaixe: ((vaga: Vaga) => void) | null = null

export function pedirEncaixe(vaga: Vaga): void {
  if (atenderEncaixe) atenderEncaixe(vaga)
  else encaixePendente = vaga
}

export function aoPedirEncaixe(atender: (vaga: Vaga) => void): () => void {
  atenderEncaixe = atender
  const pendente = encaixePendente
  encaixePendente = null
  if (pendente) queueMicrotask(() => atender(pendente))
  return () => {
    if (atenderEncaixe === atender) atenderEncaixe = null
  }
}

export function useIncomingConfirmacoes(): void {
  useEffect(() => {
    const retirar = (): void => {
      void window.api.confirmacoes
        .takeIncoming()
        .then((lista) => lista.forEach((texto) => abrirResposta(texto)))
    }
    retirar()
    return window.api.confirmacoes.onIncoming(retirar)
  }, [])
}

export function quandoCurto(inicio: string): string {
  return format(parseIsoLocalDateTime(inicio), "EEE dd/MM 'às' HH:mm", { locale: ptBR })
}

export const horaDe = (iso: string): string => format(new Date(iso), 'HH:mm')
