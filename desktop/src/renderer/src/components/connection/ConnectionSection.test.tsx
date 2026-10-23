// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ConnectionInfo, PairingCode } from '@shared/api'
import { renderRoute } from '@renderer/testing'

const { connection } = vi.hoisted(() => {
  const info: ConnectionInfo = {
    role: 'server',
    name: 'Recepção',
    status: 'local',
    sharing: true,
    sharingError: null,
    keepRunning: true,
    openAtLogin: true,
    remoteAccess: false,
    notices: true,
    remoteReach: null,
    addresses: ['192.168.0.12'],
    devices: [
      {
        publicKey: 'aa',
        name: 'Consultório',
        tipo: 'computador',
        nivel: null,
        online: true,
        lastSeen: null
      },
      {
        publicKey: 'bb',
        name: 'iPhone Fictício',
        tipo: 'celular',
        nivel: 'recepcao',
        online: false,
        lastSeen: null
      }
    ],
    server: null,
    via: null
  }
  const code: PairingCode = {
    code: 'K7Q2 9XMP 3HTA',
    expiresAt: Date.now() + 300_000,
    convite: JSON.stringify({ v: 1, k: 'ab'.repeat(32), c: 'K7Q29XMP3HTA', a: [] })
  }
  const connection = {
    info: vi.fn(() => Promise.resolve(info)),
    onChange: vi.fn(() => () => {}),
    createCode: vi.fn(() => Promise.resolve(code)),
    cancelCode: vi.fn(() => Promise.resolve())
  }
  Object.assign(window, { platform: 'darwin', connection })
  return { connection }
})

import { ConnectionSection } from './ConnectionSection'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Conectar celular', () => {
  it('o nível escolhido no computador vai preso ao código, e o QR abre oculto', async () => {
    const user = userEvent.setup()
    renderRoute('/', '/', <ConnectionSection />)

    expect(await screen.findByText(/Celular da recepção/)).toBeTruthy()
    expect(screen.getByText(/^Computador ·/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Conectar celular' }))
    expect(connection.createCode).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Recepção/ }))
    expect(connection.createCode).toHaveBeenCalledWith({ tipo: 'celular', nivel: 'recepcao' })

    const qr = await screen.findByRole('button', { name: /QR code para o celular: oculto/ })
    expect(qr.getAttribute('aria-pressed')).toBe('false')
    expect(
      screen.getByText(/só conecta com “Permitir acesso de fora da clínica” ligado/)
    ).toBeTruthy()
    await user.click(qr)
    expect(qr.getAttribute('aria-pressed')).toBe('true')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(connection.cancelCode).toHaveBeenCalled()
  })

  it('computador continua com o código digitado, sem QR', async () => {
    const user = userEvent.setup()
    renderRoute('/', '/', <ConnectionSection />)
    await user.click(await screen.findByRole('button', { name: 'Conectar computador' }))
    expect(connection.createCode).toHaveBeenCalledWith({ tipo: 'computador' })
    expect(await screen.findByRole('button', { name: /Código de conexão/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /QR code/ })).toBeNull()
  })
})
