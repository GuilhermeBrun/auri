import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import handler from '../api/erros.ts'

const port = Number(process.env.PORT ?? 8080)

const server = createServer(async (req, res) => {
  if (req.url === '/saude') return res.writeHead(200).end()
  if (req.url !== '/api/erros') return res.writeHead(404).end()
  try {
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers))
      if (typeof value === 'string') headers.set(name, value)
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const response = await handler.fetch(
      new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers,
        body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
        duplex: 'half'
      })
    )
    res.writeHead(response.status, Object.fromEntries(response.headers)).end()
  } catch (error) {
    console.error(`[erros] ${(error as Error).message}`)
    if (!res.headersSent) res.writeHead(503)
    res.end()
  }
}).listen(port, () => console.log(`[erros] ouvindo na porta ${port}`))

process.on('SIGTERM', () => server.close(() => process.exit(0)))
