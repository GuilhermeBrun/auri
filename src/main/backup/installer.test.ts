import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { exeSignedBy, parseMountPoint, pkgSignedBy, verifyExe, verifyPkg } from './installer'

// Saídas reais (hdiutil e pkgutil no macOS, com o instalador oficial do Google Drive).
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
    await expect(verifyExe('C:\\Windows\\explorer.exe', 'onedrive')).resolves.toBeUndefined()
    await expect(verifyExe('C:\\Windows\\explorer.exe', 'google')).rejects.toThrow()
    const fake = join(mkdtempSync(join(tmpdir(), 'auri-')), "Setup d'Auri.exe")
    writeFileSync(fake, 'não é um executável')
    await expect(verifyExe(fake, 'onedrive')).rejects.toThrow()
  }, 30_000)
})

describe.runIf(process.platform === 'darwin')('assinatura no Mac de verdade', () => {
  it('recusa um pacote sem assinatura', async () => {
    const fake = join(mkdtempSync(join(tmpdir(), 'auri-')), 'Falso.pkg')
    writeFileSync(fake, 'não é um pacote')
    await expect(verifyPkg(fake, 'google')).rejects.toThrow()
  })
})
