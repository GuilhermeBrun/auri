import fc from 'fast-check'
import { expect, it } from 'vite-plus/test'
import { createKeyring, packBackup, unpackBackup } from './archive'

it('backup conserva qualquer payload e recusa alterações em qualquer byte do arquivo', async () => {
  const keyring = await createKeyring('Senha Fictícia', 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ', {
    N: 1024,
    r: 8,
    p: 1
  })
  const meta = {
    createdAt: '2026-10-14T12:00:00.000Z',
    schemaVersion: 1,
    counts: { patients: 2, appointments: 1 }
  }
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 4096 }), fc.nat(), (bytes, position) => {
      const payload = Buffer.from(bytes)
      const packed = packBackup(keyring, meta, payload)
      const restored = unpackBackup(packed, keyring.key)
      expect(restored.database).toEqual(payload)
      expect(restored.header.counts).toEqual(meta.counts)
      const tampered = Buffer.from(packed)
      tampered[position % tampered.length] ^= 1
      expect(() => unpackBackup(tampered, keyring.key)).toThrow()
      expect(() => unpackBackup(packed.subarray(0, packed.length - 1), keyring.key)).toThrow()
    }),
    { seed: 20261014, numRuns: 150 }
  )
})
