import { describe, expect, it } from 'vitest'
import { exeSignedBy, parseMountPoint, pkgSignedBy } from './installer'

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
