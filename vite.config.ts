import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function assistantApi(mode: string): Plugin {
  return { name: 'fitmate-local-assistant', apply: 'serve', configureServer(server) {
    let handler: ((request: Request) => Promise<Response>) | undefined
    server.middlewares.use('/api/explain', async (req, res) => {
      const cancellation = new AbortController()
      res.once('close', () => { if (!res.writableEnded) cancellation.abort() })
      try {
        const chunks: Buffer[] = []
        let length = 0
        for await (const chunk of req) {
          length += chunk.length
          if (length > 8192) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: 'TOO_LARGE', message: '요청 크기를 초과했어요.' })); return }
          chunks.push(Buffer.from(chunk))
        }
        if (!handler) {
          const module = await server.ssrLoadModule('/server/assistant.ts')
          const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
          const address = server.httpServer?.address()
          const port = address && typeof address === 'object' ? address.port : 5173
          handler = module.createAssistantHandler({ env: { ...env, AI_ALLOWED_ORIGINS: env.AI_ALLOWED_ORIGINS || `http://127.0.0.1:${port},http://localhost:${port}` } })
        }
        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
        const response = await handler!(new Request(`http://localhost/api/explain`, { method: req.method, headers, signal: cancellation.signal, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) }))
        res.writeHead(response.status, Object.fromEntries(response.headers))
        res.end(await response.text())
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ code: 'AI_UNAVAILABLE', message: 'AI 서버 연결을 확인해주세요. 규칙 분석은 계속 사용할 수 있어요.' }))
      }
    })
  } }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({ plugins: [react(), assistantApi(mode)] }))
