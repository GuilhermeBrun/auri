import fc from 'fast-check'
import { describe, expect, it } from 'vite-plus/test'
import { brDateToIso, isoToBrDate, isIsoDate } from './dates'
import { createPatientSearch, normalizeText } from './search'

const options = { seed: 20261014, numRuns: 300 }

describe('propriedades de conteúdo', () => {
  it('datas válidas mantêm o mesmo dia na conversão brasileira e ISO', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2099 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        (year, month, day) => {
          const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const br = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
          if (isIsoDate(iso)) expect(brDateToIso(isoToBrDate(iso))).toBe(iso)
          else expect(brDateToIso(br)).toBe('')
        }
      ),
      options
    )
  })

  it('busca conserva ordem, não altera pacientes e encontra o nome normalizado', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 40 }), {
          minLength: 1,
          maxLength: 30
        }),
        (names) => {
          const patients = names.map((nome, id) => ({
            id,
            nome,
            mae_nome: '',
            cpf: '',
            mae_cpf: ''
          }))
          const before = structuredClone(patients)
          const search = createPatientSearch(patients)
          for (const patient of patients) {
            const found = search(normalizeText(patient.nome))
            expect(found).toContain(patient)
            expect(found.map((row) => row.id)).toEqual(
              found.map((row) => row.id).sort((a, b) => a - b)
            )
          }
          expect(patients).toEqual(before)
          expect(search('   ')).toEqual(patients)
        }
      ),
      options
    )
  })
})
