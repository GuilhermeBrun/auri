// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { toIsoDate } from '@shared/dates'
import { fakePatient, renderRoute } from '@renderer/testing'
import { AniversariantesHoje, BoloAniversario } from './Aniversariantes'

const hoje = new Date()
const nascimento = toIsoDate(new Date(hoje.getFullYear() - 8, hoje.getMonth(), hoje.getDate()))
const ontem = toIsoDate(new Date(hoje.getFullYear() - 5, hoje.getMonth(), hoje.getDate() - 1))

function comPacientes(...pacientes: ReturnType<typeof fakePatient>[]): ReturnType<typeof vi.fn> {
  const list = vi.fn(async () => pacientes)
  Object.assign(window, { api: { patients: { list } } })
  return list
}

afterEach(cleanup)

describe('aniversariantes na agenda', () => {
  it('não mostra nada sem aniversariante hoje', async () => {
    const list = comPacientes(fakePatient({ data_nascimento: ontem }))
    renderRoute('/agenda', '/agenda', <AniversariantesHoje />)
    await vi.waitFor(() => expect(list).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Aniversariantes de hoje' })).toBeNull()
  })

  it('lista nome e idade e abre a ficha ao clicar', async () => {
    comPacientes(
      fakePatient({ id: 7, nome: 'Helena Fictícia Andrade', data_nascimento: nascimento }),
      fakePatient({ id: 8, nome: 'Bruno Fictício', data_nascimento: ontem })
    )
    renderRoute('/agenda', '/agenda', <AniversariantesHoje />)
    await userEvent.click(await screen.findByRole('button', { name: 'Aniversariantes de hoje' }))
    const helena = await screen.findByRole('button', { name: /Helena Fictícia Andrade/ })
    expect(helena.textContent).toContain('8 anos')
    expect(screen.queryByText('Bruno Fictício')).toBeNull()
    await userEvent.click(helena)
    expect(await screen.findByText('Outra tela')).toBeTruthy()
  })

  it('marca o card só quando a sessão cai no aniversário', async () => {
    comPacientes(fakePatient({ id: 7, data_nascimento: nascimento }))
    renderRoute(
      '/agenda',
      '/agenda',
      <>
        <BoloAniversario patientId={7} dia={hoje} />
        <BoloAniversario patientId={7} dia={new Date(hoje.getTime() + 86_400_000)} />
        <BoloAniversario patientId={9} dia={hoje} />
      </>
    )
    expect(await screen.findAllByRole('img', { name: 'Faz 8 anos neste dia' })).toHaveLength(1)
  })
})
