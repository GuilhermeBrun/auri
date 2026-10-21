import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import erros from '../api/erros.ts'
import links from '../api/links.ts'

const port = Number(process.env.PORT ?? 8080)

const server = createServer(async (req, res) => {
  if (req.url === '/saude') return res.writeHead(200).end()
  const caminho = (req.url ?? '').split('?')[0]
  const handler = caminho === '/api/erros' ? erros : caminho === '/api/links' ? links : null
  if (!handler) return res.writeHead(404).end()
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
    res
      .writeHead(response.status, Object.fromEntries(response.headers))
      .end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error(`[erros] ${(error as Error).message}`)
    if (!res.headersSent) res.writeHead(503)
    res.end()
  }
}).listen(port, () => console.log(`[erros] ouvindo na porta ${port}`))

process.on('SIGTERM', () => server.close(() => process.exit(0)))
