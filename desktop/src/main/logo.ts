import { app, BrowserWindow, dialog, nativeImage, type OpenDialogOptions } from 'electron'
import { LOGO_MAX_BASE64 } from '../shared/schemas'

const LOGO_SIDE = 600

export function logoFromImage(image: Electron.NativeImage): string {
  if (image.isEmpty())
    throw new Error('Não foi possível abrir esta imagem. Use um arquivo PNG ou JPG.')
  const { width, height } = image.getSize()
  const scale = Math.min(1, LOGO_SIDE / Math.max(width, height))
  const resized =
    scale < 1
      ? image.resize({
          width: Math.round(width * scale),
          height: Math.round(height * scale),
          quality: 'best'
        })
      : image
  const png = resized.toPNG().toString('base64')
  if (png.length <= LOGO_MAX_BASE64) return png
  const jpeg = resized.toJPEG(85).toString('base64')
  if (jpeg.length <= LOGO_MAX_BASE64) return jpeg
  throw new Error('Esta imagem é pesada demais para o logo. Use uma versão mais simples.')
}

export async function chooseLogo(): Promise<string | null> {
  const window = BrowserWindow.getFocusedWindow()
  const options: OpenDialogOptions = {
    title: 'Escolher o logo da clínica',
    buttonLabel: 'Escolher',
    defaultPath: app.getPath('pictures'),
    properties: ['openFile'],
    filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg'] }]
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  const file = result.canceled ? undefined : result.filePaths[0]
  return file ? logoFromImage(nativeImage.createFromPath(file)) : null
}
