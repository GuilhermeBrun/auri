import { readFileSync } from 'node:fs'
import { connect } from '../api/erros.ts'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Informe DATABASE_URL (o endereço do dono do banco).')
  process.exit(1)
}
const sql = connect(url, { max: 1, onnotice: () => {} })
try {
  await sql.unsafe(readFileSync(new URL('../db/erros.sql', import.meta.url), 'utf8'))
  console.log('[erros] tabela pronta')
} finally {
  await sql.end()
}
