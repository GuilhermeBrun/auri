import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'

const renderers = new Map<number, { contents: WebContents; url: string }>()

function documentUrl(value: string): string {
  const url = new URL(value)
  url.hash = ''
  return url.href
}

export function trustRenderer(contents: WebContents, url: string): void {
  renderers.set(contents.id, { contents, url: documentUrl(url) })
  contents.once('destroyed', () => renderers.delete(contents.id))
}

export function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): void {
  const trusted = renderers.get(event.sender.id)
  const frame = event.senderFrame
  if (
    !trusted ||
    trusted.contents !== event.sender ||
    event.sender.isDestroyed() ||
    !frame ||
    frame !== event.sender.mainFrame ||
    documentUrl(frame.url) !== trusted.url
  ) {
    throw new Error('Origem da chamada não autorizada')
  }
}
