import { createServer } from 'node:http'
import handler from '../api/erros.ts'
import contract from '../contrato/relatorio-de-erro.json' with { type: 'json' }

const port = Number(process.env.PORT ?? 8080)

const server = createServer(async (req, res) => {
  if (req.url === '/saude') return res.writeHead(200).end()
  if (req.url !== '/api/erros') return res.writeHead(404).end()
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > contract.maxBytes) return res.writeHead(413).end()
    chunks.push(chunk)
  }
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers))
    if (typeof value === 'string') headers.set(name, value)
  const response = await handler.fetch(
    new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks)
    })
  )
  res.writeHead(response.status, Object.fromEntries(response.headers)).end()
}).listen(port, () => console.log(`[erros] ouvindo na porta ${port}`))

process.on('SIGTERM', () => server.close(() => process.exit(0)))
