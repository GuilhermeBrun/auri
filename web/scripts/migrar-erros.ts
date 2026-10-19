import { connect } from '../api/erros.ts'
import { migrate } from '../db/migrar.ts'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Informe DATABASE_URL (o endereço do dono do banco).')
  process.exit(1)
}
const sql = connect(url, { max: 1, onnotice: () => {} })
try {
  const applied = await migrate(sql)
  console.log(
    applied.length > 0
      ? `[erros] migrações aplicadas: ${applied.join(', ')}`
      : '[erros] banco já está na última migração'
  )
} finally {
  await sql.end()
}
