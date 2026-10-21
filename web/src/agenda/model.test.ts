import { describe, expect, test } from 'vite-plus/test'
import { createStore } from './model'

describe('agenda da prévia', () => {
  test('remarcar leva a sessão para o novo dia e tira a confirmação', () => {
    const store = createStore()
    const beatriz = store.day(4).find((session) => session.name === 'Beatriz Melo Dias')!
    expect(beatriz.mark).toBe('waiting')
    const moved = store.move(beatriz.id, 5, 11)
    expect(moved).toMatchObject({ id: beatriz.id, day: 5, start: 11, mark: undefined })
    expect(store.day(4).some((session) => session.id === beatriz.id)).toBe(false)
    expect(store.day(5).find((session) => session.id === beatriz.id)?.start).toBe(11)
  })

  test('desfazer devolve o horário e a marca de antes', () => {
    const store = createStore()
    const beatriz = store.day(4).find((session) => session.name === 'Beatriz Melo Dias')!
    store.move(beatriz.id, 5, 11)
    store.move(beatriz.id, 4, beatriz.start, beatriz.mark)
    expect(store.find(beatriz.id)).toMatchObject({ day: 4, start: 9.5, mark: 'waiting' })
  })

  test('mover para outra semana gera a semana sem perder a sessão', () => {
    const store = createStore()
    const lucas = store.day(3).find((session) => session.name === 'Lucas Nunes Pires')!
    store.move(lucas.id, 10, 9)
    expect(store.day(10).some((session) => session.id === lucas.id)).toBe(true)
  })

  test('compromissos têm a etiqueta e não entram na lista de pacientes', () => {
    const store = createStore()
    const reuniao = store.day(4).find((session) => session.kind === 'reuniao')
    expect(reuniao).toMatchObject({ name: 'Equipe', start: 13, len: 1 })
    expect(store.patients()).not.toContain('Equipe')
  })
})
