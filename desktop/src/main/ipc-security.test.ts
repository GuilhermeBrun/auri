import { describe, expect, it } from 'vite-plus/test'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { assertTrustedSender, trustRenderer } from './ipc-security'

let id = 0
function renderer(url = 'file:///auri/out/renderer/index.html') {
  const mainFrame = { url }
  let destroyed = false
  let onDestroyed: (() => void) | undefined
  const contents = {
    id: ++id,
    mainFrame,
    isDestroyed: () => destroyed,
    once: (_name: string, callback: () => void) => {
      onDestroyed = callback
    }
  } as unknown as WebContents
  const event = { sender: contents, senderFrame: mainFrame } as IpcMainInvokeEvent
  return {
    contents,
    event,
    destroy: () => {
      destroyed = true
      onDestroyed?.()
    }
  }
}

describe('segurança IPC', () => {
  it('aceita apenas o frame principal registrado na URL exata', () => {
    const r = renderer()
    trustRenderer(r.contents, r.event.senderFrame!.url)
    expect(() => assertTrustedSender(r.event)).not.toThrow()
    Object.defineProperty(r.event.senderFrame, 'url', {
      value: 'file:///auri/out/renderer/index.html#/pacientes'
    })
    expect(() => assertTrustedSender(r.event)).not.toThrow()
  })
  it('recusa janela desconhecida mesmo carregando o arquivo legítimo', () => {
    expect(() => assertTrustedSender(renderer().event)).toThrow('não autorizada')
  })
  it('recusa a janela do WhatsApp Web, que nunca é registrada', () => {
    const main = renderer()
    trustRenderer(main.contents, main.event.senderFrame!.url)
    expect(() =>
      assertTrustedSender(renderer('https://web.whatsapp.com/send?phone=5565900000000').event)
    ).toThrow('não autorizada')
  })
  it('recusa subframe, navegação externa, URL com prefixo parecido e frame ausente', () => {
    const r = renderer()
    const url = r.event.senderFrame!.url
    trustRenderer(r.contents, url)
    for (const frame of [{ url }, { url: 'https://example.com' }, { url: url + '.evil' }, null]) {
      expect(() =>
        assertTrustedSender({ ...r.event, senderFrame: frame } as IpcMainInvokeEvent)
      ).toThrow('não autorizada')
    }
    Object.defineProperty(r.event.senderFrame, 'url', { value: 'https://example.com' })
    expect(() => assertTrustedSender(r.event)).toThrow('não autorizada')
  })
  it('revoga a janela destruída e não confia em outra instância com o mesmo ID', () => {
    const r = renderer()
    trustRenderer(r.contents, r.event.senderFrame!.url)
    const imposter = renderer()
    Object.defineProperty(imposter.contents, 'id', { value: r.contents.id })
    expect(() => assertTrustedSender(imposter.event)).toThrow('não autorizada')
    r.destroy()
    expect(() => assertTrustedSender(r.event)).toThrow('não autorizada')
  })
})
