import { describe, expect, it } from 'vite-plus/test'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, win32 } from 'path'
import {
  authenticode,
  exeSignedBy,
  parseMountPoint,
  pkgSignedBy,
  verifyExe,
  verifyPkg
} from './installer'

const ATTACH = [
  '/dev/disk4          \tApple_partition_scheme         \t',
  '/dev/disk4s1        \tApple_partition_map            \t',
  '/dev/disk4s2        \tApple_HFS                      \t/Volumes/Install Google Drive',
  ''
].join('\n')

const SIGNED = `Package "GoogleDrive.pkg":
   Status: signed by a developer certificate issued by Apple for distribution
   Notarization: trusted by the Apple notary service
   Certificate Chain:
    1. Developer ID Installer: Google LLC (EQHXZ8M8AV)
`

describe('instalador da nuvem', () => {
  it('acha a pasta montada do .dmg, com espaço no nome', () => {
    expect(parseMountPoint(ATTACH)).toBe('/Volumes/Install Google Drive')
    expect(parseMountPoint('hdiutil: attach failed')).toBeNull()
  })

  it('aceita só o pacote assinado pelo fabricante certo', () => {
    expect(pkgSignedBy(SIGNED, 'Google LLC')).toBe(true)
    expect(pkgSignedBy(SIGNED, 'Microsoft Corporation')).toBe(false)
    expect(pkgSignedBy('Status: no signature', 'Google LLC')).toBe(false)
  })

  it('no Windows, exige assinatura válida da empresa certa', () => {
    const subject =
      'CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'
    expect(exeSignedBy(`Valid|${subject}\r\n`, 'Microsoft Corporation')).toBe(true)
    expect(exeSignedBy(`HashMismatch|${subject}`, 'Microsoft Corporation')).toBe(false)
    expect(exeSignedBy(`Valid|${subject}`, 'Google LLC')).toBe(false)
    expect(exeSignedBy('', 'Google LLC')).toBe(false)
  })
})

describe.runIf(process.platform === 'win32')('assinatura no Windows de verdade', () => {
  it('aceita um executável assinado pela Microsoft e recusa um sem assinatura', async () => {
    const dotnet = win32.join(
      process.env.ProgramFiles ?? 'C:\\Program Files',
      'dotnet',
      'dotnet.exe'
    )
    console.log(`[assinatura] dotnet.exe: ${await authenticode(dotnet)}`)
    console.log(`[assinatura] explorer.exe: ${await authenticode('C:\\Windows\\explorer.exe')}`)
    await expect(verifyExe(dotnet, 'onedrive')).resolves.toBeUndefined()
    await expect(verifyExe(dotnet, 'google')).rejects.toThrow()
    const fake = join(mkdtempSync(join(tmpdir(), 'auri-')), "Setup d'Auri.exe")
    writeFileSync(fake, 'não é um executável')
    await expect(verifyExe(fake, 'onedrive')).rejects.toThrow()
  }, 60_000)

  it.runIf(!!process.env.AURI_TESTA_INSTALADORES)(
    'os instaladores oficiais do OneDrive e do Google Drive passam na verificação',
    async () => {
      const folder = mkdtempSync(join(tmpdir(), 'auri-instaladores-'))
      const installers = [
        ['onedrive', 'https://go.microsoft.com/fwlink/?linkid=844652', 'OneDriveSetup.exe'],
        [
          'google',
          'https://dl.google.com/drive-file-stream/GoogleDriveSetup.exe',
          'GoogleDriveSetup.exe'
        ]
      ] as const
      for (const [id, url, name] of installers) {
        const file = join(folder, name)
        writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()))
        console.log(`[assinatura] ${name}: ${await authenticode(file)}`)
        await expect(verifyExe(file, id)).resolves.toBeUndefined()
      }
    },
    600_000
  )
})

describe.runIf(process.platform === 'darwin')('assinatura no Mac de verdade', () => {
  it('recusa um pacote sem assinatura', async () => {
    const fake = join(mkdtempSync(join(tmpdir(), 'auri-')), 'Falso.pkg')
    writeFileSync(fake, 'não é um pacote')
    await expect(verifyPkg(fake, 'google')).rejects.toThrow()
  })
})
